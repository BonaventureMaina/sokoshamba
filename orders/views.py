from datetime import timedelta
import os
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from marketplace.models import Cart, CartItem, PendingCheckout
from marketplace.views import get_or_create_cart
from accounts.models import User
from .models import Order, OrderItem, MpesaPayment
from .mpesa_service import initiate_stk_push, verify_callback_signature


def get_verified_farmer(user):
    if user.is_authenticated and user.role == 'farmer':
        try:
            profile = user.farmer_profile
            if profile.verification_status == 'verified' and profile.is_active:
                return profile
        except Exception:
            pass
    return None


def checkout(request):
    cart = get_or_create_cart(request)
    items = cart.items.select_related('product__farmer').all()
    if not items:
        return redirect('cart')

    subtotal = 0
    for item in items:
        item.line_total = item.product.price * item.quantity
        subtotal += item.line_total

    delivery_fee = 150
    total = subtotal + delivery_fee

    context = {
        'items': items,
        'subtotal': subtotal,
        'delivery_fee': delivery_fee,
        'total': total,
    }
    return render(request, 'checkout.html', context)


@require_POST
def initiate_payment(request):
    phone = request.POST.get('phone')
    if not phone:
        return JsonResponse({'success': False, 'message': 'Phone number is required.'}, status=400)

    cart = get_or_create_cart(request)
    items = cart.items.select_related('product__farmer').all()
    if not items:
        return JsonResponse({'success': False, 'message': 'Cart empty.'}, status=400)

    subtotal = sum(item.product.price * item.quantity for item in items)
    delivery_fee = 150
    total = subtotal + delivery_fee

    # Build callback URL (uses ngrok if set in .env)
    ngrok_base = os.environ.get('NGROK_URL', '')
    if ngrok_base:
        callback_url = f'{ngrok_base}/webhooks/mpesa/callback/'
    else:
        callback_url = request.build_absolute_uri('/webhooks/mpesa/callback/')

    try:
        result = initiate_stk_push(
            phone=phone,
            amount=int(total),
            account_reference='SokoShamba',
            callback_url=callback_url,
        )
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'M-Pesa request failed: {str(e)}'}, status=500)

    # Store pending checkout so the callback can retrieve cart and phone
    address_snapshot = {
        'county': request.POST.get('county', ''),
        'area': request.POST.get('area', ''),
        'landmark': request.POST.get('landmark', ''),
        'instructions': request.POST.get('instructions', ''),
    }
    PendingCheckout.objects.create(
        checkout_request_id=result['CheckoutRequestID'],
        phone=phone,
        cart_id=cart.id,
        total=total,
        address_snapshot=address_snapshot,
    )

    return JsonResponse({
        'success': True,
        'message': 'Check your phone and enter your M‑Pesa PIN.',
        'checkout_request_id': result['CheckoutRequestID'],
    })


@csrf_exempt
@require_POST
def mpesa_callback(request):
    import json
    try:
        callback_data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON.'}, status=400)

    if not verify_callback_signature(request):
        return JsonResponse({'success': False, 'message': 'Invalid signature.'}, status=403)

    stk_callback = callback_data.get('Body', {}).get('stkCallback', {})
    result_code = stk_callback.get('ResultCode')
    result_desc = stk_callback.get('ResultDesc', '')
    checkout_request_id = stk_callback.get('CheckoutRequestID')

    if result_code != 0:
        # Payment failed – clear pending checkout
        PendingCheckout.objects.filter(checkout_request_id=checkout_request_id).delete()
        return JsonResponse({'success': False, 'message': result_desc}, status=200)

    # Retrieve the pending checkout record
    pending = PendingCheckout.objects.filter(checkout_request_id=checkout_request_id).first()
    if not pending:
        return JsonResponse({'success': False, 'message': 'Unknown checkout request.'}, status=404)

    phone = pending.phone
    cart = Cart.objects.get(pk=pending.cart_id)

    # Extract metadata from callback
    metadata_items = stk_callback.get('CallbackMetadata', {}).get('Item', [])
    metadata = {}
    for item in metadata_items:
        metadata[item['Name']] = item.get('Value')
    mpesa_receipt = metadata.get('MpesaReceiptNumber', '')

    # Create or get user
    user, created = User.objects.get_or_create(
        phone=phone,
        defaults={'role': 'consumer', 'phone_verified': True}
    )
    if created:
        user.set_unusable_password()
        user.save()

    # Merge guest cart into user cart (if guest cart still exists and is different)
    try:
        guest_cart = Cart.objects.get(id=cart.id)
        user_cart, _ = Cart.objects.get_or_create(user=user)
        if guest_cart != user_cart and guest_cart.items.exists():
            for item in guest_cart.items.all():
                existing = CartItem.objects.filter(cart=user_cart, product=item.product).first()
                if existing:
                    existing.quantity = item.quantity
                    existing.save()
                else:
                    item.cart = user_cart
                    item.save()
            guest_cart.delete()
        cart = user_cart
    except Cart.DoesNotExist:
        cart = Cart.objects.get_or_create(user=user)[0]

    items = cart.items.select_related('product__farmer').all()
    if not items:
        PendingCheckout.objects.filter(checkout_request_id=checkout_request_id).delete()
        return JsonResponse({'success': False, 'message': 'Cart empty.'}, status=400)

    farmer = items[0].product.farmer
    subtotal = sum(item.product.price * item.quantity for item in items)
    delivery_fee = 150
    total = subtotal + delivery_fee

    # Use the address saved during checkout, fallback to test address
    address_snapshot = pending.address_snapshot or {
        'county': 'Nairobi',
        'area': 'Test Area',
        'landmark': 'Test Landmark',
        'instructions': '',
    }

    order = Order.objects.create(
        consumer=user,
        farmer=farmer,
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        total=total,
        delivery_address_snapshot=address_snapshot,
        consumer_phone_at_order=phone,
        status='pending',
        auto_cancel_at=timezone.now() + timedelta(minutes=30),
    )

    for item in items:
        OrderItem.objects.create(
            order=order,
            product=item.product,
            product_name=item.product.name,
            unit=item.product.unit,
            price=item.product.price,
            quantity=item.quantity,
        )

    MpesaPayment.objects.create(
        order=order,
        merchant_request_id='real_' + checkout_request_id,
        checkout_request_id=checkout_request_id,
        amount=total,
        phone_number=phone,
        status='completed',
        mpesa_receipt_number=mpesa_receipt,
    )

    cart.items.all().delete()
    PendingCheckout.objects.filter(checkout_request_id=checkout_request_id).delete()

    return JsonResponse({
        'success': True,
        'order_id': order.id,
        'message': 'Payment successful. Your order has been placed.',
    })


def order_list(request):
    if not request.user.is_authenticated:
        return redirect('login')
    orders = request.user.orders.select_related('farmer').order_by('-created_at')
    return render(request, 'order_list.html', {'orders': orders})


def order_detail(request, order_id):
    if not request.user.is_authenticated:
        return redirect('login')
    order = get_object_or_404(request.user.orders, id=order_id)
    items = order.items.all()
    return render(request, 'order_detail.html', {'order': order, 'items': items})


@login_required
def farmer_order_list(request):
    farmer = get_verified_farmer(request.user)
    if not farmer:
        return HttpResponseForbidden("Access denied.")

    orders = farmer.orders.select_related('consumer').order_by('-created_at')
    return render(request, 'farmer_order_list.html', {'orders': orders, 'farmer': farmer})


@login_required
def farmer_order_detail(request, order_id):
    farmer = get_verified_farmer(request.user)
    if not farmer:
        return HttpResponseForbidden("Access denied.")

    order = get_object_or_404(farmer.orders, id=order_id)
    items = order.items.all()

    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'accept' and order.status == 'pending':
            order.status = 'confirmed'
            order.confirmed_at = timezone.now()
            order.save()
        elif action == 'decline' and order.status == 'pending':
            order.status = 'farmer_declined'
            order.farmer_declined_at = timezone.now()
            order.decline_reason = request.POST.get('decline_reason', '')
            order.save()
        elif action == 'ready' and order.status == 'confirmed':
            order.status = 'ready_for_pickup'
            order.ready_at = timezone.now()
            order.save()
        elif action == 'request_pickup' and order.status == 'ready_for_pickup':
            order.status = 'pickup_requested'
            order.pickup_requested_at = timezone.now()
            order.save()
        return redirect('farmer_order_detail', order_id=order.id)

    return render(request, 'farmer_order_detail.html', {
        'order': order,
        'items': items,
        'farmer': farmer,
    })

@login_required
def farmer_earnings(request):
    farmer = get_verified_farmer(request.user)
    if not farmer:
        return HttpResponseForbidden("Access denied.")

    payouts = farmer.payouts.select_related('order').order_by('-created_at')
    total_earned = sum(p.amount for p in payouts if p.status == 'completed')
    pending_earned = sum(p.amount for p in payouts if p.status == 'pending')

    return render(request, 'farmer_earnings.html', {
        'farmer': farmer,
        'payouts': payouts,
        'total_earned': total_earned,
        'pending_earned': pending_earned,
    })

@login_required
def reorder(request, order_id):
    order = get_object_or_404(Order, id=order_id, consumer=request.user)
    if order.status not in ['delivered', 'auto_cancelled', 'consumer_cancelled', 'farmer_declined']:
        return JsonResponse({'success': False, 'message': 'Order cannot be reordered.'}, status=400)

    cart = get_or_create_cart(request)

    # Enforce single-farmer: ensure cart is empty or already contains items from the same farmer
    existing = cart.items.select_related('product__farmer').first()
    if existing and existing.product.farmer_id != order.farmer_id:
        return JsonResponse({
            'success': False,
            'message': f'Your cart contains items from {existing.product.farmer.farm_name}. Complete that order first.'
        }, status=409)

    added = 0
    skipped = 0
    for item in order.items.all():
        product = item.product
        if not product.is_active or not product.farmer.is_active or product.farmer.verification_status != 'verified':
            skipped += 1
            continue
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={'quantity': item.quantity}
        )
        if not created:
            cart_item.quantity = item.quantity
            cart_item.save()
        added += 1

    cart.save()

    msg = f'{added} item(s) added to cart.'
    if skipped:
        msg += f' {skipped} item(s) are no longer available.'
    return JsonResponse({'success': True, 'message': msg})
