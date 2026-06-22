from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from .models import Category, Product, Cart, CartItem


def home(request):
    return render(request, 'home.html')


def product_list(request):
    categories = Category.objects.filter(is_active=True)
    category_id = request.GET.get('category')
    products = Product.objects.filter(is_active=True, farmer__is_active=True, farmer__verification_status='verified').select_related('farmer__user').prefetch_related('images')
    if category_id:
        products = products.filter(category_id=category_id)
    context = {
        'categories': categories,
        'products': products,
        'active_category': int(category_id) if category_id else None,
    }
    return render(request, 'product_list.html', context)


def product_detail(request, product_id):
    product = Product.objects.filter(
        id=product_id,
        is_active=True,
        farmer__is_active=True,
        farmer__verification_status='verified'
    ).select_related('farmer__user').prefetch_related('images').first()
    if not product:
        from django.http import Http404
        raise Http404("Product not found")
    return render(request, 'product_detail.html', {'product': product})


def get_or_create_cart(request):
    if request.user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(user=request.user)
    else:
        session_key = request.session.session_key
        if not session_key:
            request.session.create()
            session_key = request.session.session_key
        cart, _ = Cart.objects.get_or_create(session_key=session_key)
    return cart


@require_POST
def add_to_cart(request):
    product_id = request.POST.get('product_id')
    quantity = request.POST.get('quantity', 1)

    try:
        quantity = int(quantity)
        if quantity < 1:
            raise ValueError
    except (ValueError, TypeError):
        return JsonResponse({'success': False, 'message': 'Invalid quantity.'}, status=400)

    product = get_object_or_404(
        Product,
        id=product_id,
        is_active=True,
        farmer__is_active=True,
        farmer__verification_status='verified',
    )

    cart = get_or_create_cart(request)

    existing_items = cart.items.select_related('product__farmer').first()
    if existing_items and existing_items.product.farmer_id != product.farmer_id:
        return JsonResponse({
            'success': False,
            'message': f'Your cart contains items from {existing_items.product.farmer.farm_name}. Clear your cart or complete that order before adding from a different farmer.',
        }, status=409)

    cart_item, created = CartItem.objects.get_or_create(
        cart=cart,
        product=product,
        defaults={'quantity': quantity},
    )
    if not created:
        cart_item.quantity = quantity
        cart_item.save()

    cart.save()

    return JsonResponse({
        'success': True,
        'message': f'Added {quantity} x {product.name} to cart.',
        'cart_count': cart.items.count(),
    })


@require_POST
def remove_from_cart(request):
    item_id = request.POST.get('item_id')
    cart = get_or_create_cart(request)
    item = get_object_or_404(CartItem, id=item_id, cart=cart)
    item.delete()
    return JsonResponse({'success': True})


def cart_detail(request):
    cart = get_or_create_cart(request)
    items = cart.items.select_related('product__farmer').all()
    subtotal = 0
    # Attach line totals to items
    for item in items:
        item.line_total = item.product.price * item.quantity
        subtotal += item.line_total
    context = {
        'cart': cart,
        'items': items,
        'subtotal': subtotal,
    }
    return render(request, 'cart.html', context)
