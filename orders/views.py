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

    # Pre-calculate subtotal
    subtotal = 0
    for item in items:
        item.line_total = item.product.price * item.quantity
        subtotal += item.line_total

    delivery_fee = 150  # fixed for now
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
    """Simulate initiating an M‑Pesa STK Push and return a fake checkout request ID."""
    phone = request.POST.get('phone')
    if not phone:
        return JsonResponse({'success': False, 'message': 'Phone number is required.'}, status=400)

    # In production, this would call the Daraja API. Here we just store a placeholder.
    # We'll store the phone in session so the callback can use it.
    request.session['pending_phone'] = phone

    return JsonResponse({
        'success': True,
        'message': 'Check your phone and enter your M‑Pesa PIN.',
        'checkout_request_id': 'simulated_' + phone,
    })


@csrf_exempt
@require_POST
def mpesa_callback(request):
    """
    Simulate the M‑Pesa callback. This would normally be called by Safaricom.
    We'll trigger it manually from the checkout page after the user "pays".
    """
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

    # Log the user in (so they own the order)
    login(request, user)

    # Retrieve their cart
    cart = get_or_create_cart(request)

    # Create the order
    items = cart.items.select_related('product__farmer').all()
    if not items:
        return JsonResponse({'success': False, 'message': 'Cart empty.'})

    farmer = items[0].product.farmer
    subtotal = sum(item.product.price * item.quantity for item in items)
    delivery_fee = 150
    total = subtotal + delivery_fee

    # Snapshot the address (for now, use a placeholder)
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
        auto_cancel_at=None,  # We'll set this later when the farmer confirms
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

    # Record the payment
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
    del request.session['pending_phone']

    return JsonResponse({
        'success': True,
        'order_id': order.id,
        'message': 'Payment successful. Your order has been placed.',
    })
