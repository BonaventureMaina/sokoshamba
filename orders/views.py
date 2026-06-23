from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import login
from marketplace.models import Cart, CartItem
from marketplace.views import get_or_create_cart
from accounts.models import User
from .models import Order, OrderItem, MpesaPayment


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

    request.session['pending_phone'] = phone
    return JsonResponse({
        'success': True,
        'message': 'Check your phone and enter your M-Pesa PIN.',
        'checkout_request_id': 'simulated_' + phone,
    })


@csrf_exempt
@require_POST
def mpesa_callback(request):
    checkout_request_id = request.POST.get('checkout_request_id', '')
    phone = request.session.get('pending_phone', '')

    if not checkout_request_id or not phone:
        return JsonResponse({'success': False, 'message': 'Invalid callback data.'}, status=400)

    # Create or get user
    user, created = User.objects.get_or_create(
        phone=phone,
        defaults={'role': 'consumer', 'phone_verified': True}
    )
    if created:
        user.set_unusable_password()
        user.save()

    # --- Cart Merging Fix ---
    # Get the current session-based cart (guest cart with items)
    session_key = request.session.session_key
    guest_cart = None
    if session_key:
        try:
            guest_cart = Cart.objects.get(session_key=session_key)
        except Cart.DoesNotExist:
            pass

    # Get or create the user's cart
    user_cart, _ = Cart.objects.get_or_create(user=user)

    # If there's a guest cart with items, transfer them to the user cart
    if guest_cart and guest_cart.items.exists():
        for item in guest_cart.items.all():
            # Check if user cart already has this product
            existing = CartItem.objects.filter(cart=user_cart, product=item.product).first()
            if existing:
                existing.quantity = item.quantity  # Replace with guest quantity
                existing.save()
            else:
                # Move item to user cart
                item.cart = user_cart
                item.save()
        # Delete the now-empty guest cart
        guest_cart.delete()
    # --- End Cart Merging ---

    # Log the user in so they own the order
    login(request, user)

    # Retrieve the user's cart (now contains merged items)
    cart = user_cart
    items = cart.items.select_related('product__farmer').all()
    if not items:
        return JsonResponse({'success': False, 'message': 'Cart empty.'})

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
        auto_cancel_at=None,
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
        merchant_request_id='sim_merchant_' + str(order.id),
        checkout_request_id=checkout_request_id,
        amount=total,
        phone_number=phone,
        status='completed',
        mpesa_receipt_number='SIM' + str(order.id),
    )

    # Clear the cart
    cart.items.all().delete()

    # Clean up session
    if 'pending_phone' in request.session:
        del request.session['pending_phone']

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
    # Prefetch related
    items = order.items.all()
    return render(request, 'order_detail.html', {'order': order, 'items': items})
