from datetime import timedelta
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.conf import settings
from marketplace.models import Cart, CartItem, PendingCheckout
from marketplace.views import get_or_create_cart
from accounts.models import User
from .models import Order, OrderItem, MpesaPayment
from .mpesa_service import initiate_stk_push, verify_callback_signature
import os



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

    # Store essential data in session so the callback can reconstruct the order
    request.session['pending_phone'] = phone
    request.session['pending_total'] = float(total)

    # Build the full callback URL (must be publicly reachable; for sandbox, use localhost or a tunnel)
    ngrok_base = os.environ.get('NGROK_URL', '')
    callback_url = f'{ngrok_base}/webhooks/mpesa/callback/' if ngrok_base else request.build_absolute_uri('/webhooks/mpesa/callback/')

    try:
        result = initiate_stk_push(
            phone=phone,
            amount=int(total),
            account_reference=f'SokoShamba',
            callback_url=callback_url,
        )
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'M-Pesa request failed: {str(e)}'}, status=500)

    # Store the checkout request ID so we can match it later
    request.session['checkout_request_id'] = result['CheckoutRequestID']
    # Store pending checkout for the callback (which has no session)
    PendingCheckout.objects.create(
        checkout_request_id=result['CheckoutRequestID'],
        phone=phone,
        cart_id=cart.id,
        total=total,
    )

    return JsonResponse({
        'success': True,
        'message': 'Check your phone and enter your M‑Pesa PIN.',
        'checkout_request_id': result['CheckoutRequestID'],
    })


@csrf_exempt
@require_POST
def mpesa_callback(request):
    """
    Real Daraja callback. Safaricom sends JSON with the payment result.
    We extract the status, amount, phone, and checkout request ID.
    """
    import json
    try:
        callback_data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON.'}, status=400)

    # Verify signature (optional but recommended)
    if not verify_callback_signature(request):
        return JsonResponse({'success': False, 'message': 'Invalid signature.'}, status=403)

    # Extract relevant fields
    stk_callback = callback_data.get('Body', {}).get('stkCallback', {})
    result_code = stk_callback.get('ResultCode')
    result_desc = stk_callback.get('ResultDesc', '')
    checkout_request_id = stk_callback.get('CheckoutRequestID')
    amount = stk_callback.get('CallbackMetadata', {}).get('Item', [{}])
    # Actually, the metadata items are a list of dicts: [{'Name': 'Amount', 'Value': 100}, ...]
    # We'll extract phone and receipt number below
    metadata_items = stk_callback.get('CallbackMetadata', {}).get('Item', [])
    metadata = {}
    for item in metadata_items:
        metadata[item['Name']] = item.get('Value')

    phone = metadata.get('PhoneNumber', request.session.get('pending_phone', ''))
    mpesa_receipt = metadata.get('MpesaReceiptNumber', '')
    payment_amount = metadata.get('Amount', 0)

    if result_code != 0:
        # Payment failed
        # We could create a failed payment record, but for simplicity just log and respond
        return JsonResponse({'success': False, 'message': result_desc}, status=200)

    # Payment succeeded – create the order exactly like the simulated version did
    # Get or create user
    user, created = User.objects.get_or_create(
        phone=phone,
        defaults={'role': 'consumer', 'phone_verified': True}
    )
    if created:
        user.set_unusable_password()
        user.save()

    # Cart merging
    session_key = request.session.session_key
    guest_cart = None
    if session_key:
        try:
            guest_cart = Cart.objects.get(session_key=session_key)
        except Cart.DoesNotExist:
            pass

    user_cart, _ = Cart.objects.get_or_create(user=user)

    if guest_cart and guest_cart.items.exists():
        for item in guest_cart.items.all():
            existing = CartItem.objects.filter(cart=user_cart, product=item.product).first()
            if existing:
                existing.quantity = item.quantity
                existing.save()
            else:
                item.cart = user_cart
                item.save()
        guest_cart.delete()

    login(request, user)

    cart = user_cart
    items = cart.items.select_related('product__farmer').all()
    if not items:
        return JsonResponse({'success': False, 'message': 'Cart empty.'}, status=400)

    farmer = items[0].product.farmer
    subtotal = sum(item.product.price * item.quantity for item in items)
    delivery_fee = 150
    total = subtotal + delivery_fee

    address_snapshot = {
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

    # Clean up session
    for key in ['pending_phone', 'pending_total', 'checkout_request_id']:
        if key in request.session:
            del request.session[key]

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
