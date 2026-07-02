import os
from PIL import Image
from django.core.exceptions import ValidationError
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.db.models import Avg
from .models import Category, Product, ProductImage, Cart, CartItem, PendingCheckout
from reviews.models import Review


def validate_product_image(image):
    # Check file size (max 5 MB)
    if image.size > 5 * 1024 * 1024:
        raise ValidationError('Image file too large (max 5 MB).')
    # Check that it's actually an image
    try:
        img = Image.open(image)
        img.verify()
    except Exception:
        raise ValidationError('Invalid image file. Please upload a JPEG or PNG.')


def get_verified_farmer(user):
    if user.is_authenticated and user.role == 'farmer':
        try:
            profile = user.farmer_profile
            if profile.verification_status == 'verified' and profile.is_active:
                return profile
        except Exception:
            pass
    return None


def home(request):
    return render(request, 'home.html')


def product_list(request):
    categories = Category.objects.filter(is_active=True)
    category_id = request.GET.get('category')
    products = Product.objects.filter(
        is_active=True,
        farmer__is_active=True,
        farmer__verification_status='verified'
    ).select_related('farmer__user').prefetch_related('images')
    if category_id:
        products = products.filter(category_id=category_id)
    products = products.annotate(avg_rating=Avg('farmer__reviews__rating'))

    for product in products:
        avg = product.avg_rating
        if avg and avg > 0:
            filled = int(round(avg))
            product.star_display = '★' * filled + '☆' * (5 - filled)
        else:
            product.star_display = '☆' * 5

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
    reviews = Review.objects.filter(farmer=product.farmer).select_related('consumer').order_by('-created_at')[:5]
    context = {'product': product, 'reviews': reviews}
    return render(request, 'product_detail.html', context)


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

    # If item_id is provided, update quantity on existing cart item directly
    item_id = request.POST.get('item_id')
    if item_id:
        cart = get_or_create_cart(request)
        cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
        # Enforce single-farmer check
        existing_items = cart.items.exclude(id=item_id).select_related('product__farmer').first()
        if existing_items and existing_items.product.farmer_id != cart_item.product.farmer_id:
            return JsonResponse({
                'success': False,
                'message': 'Cannot mix products from different farmers.',
            }, status=409)
        cart_item.quantity = quantity
        cart_item.save()
        cart.save()
        return JsonResponse({
            'success': True,
            'message': f'Updated quantity to {quantity}.',
            'cart_count': cart.items.count(),
        })

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
            'message': (
                'Your cart has items from ' + existing_items.product.farmer.farm_name + '. '
                'Each farmer’s products are delivered separately to keep them fresh. '
                'Please complete that order or clear your cart before adding from ' + product.farmer.farm_name + '.'
            ),
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
    for item in items:
        item.line_total = item.product.price * item.quantity
        subtotal += item.line_total
    context = {
        'cart': cart,
        'items': items,
        'subtotal': subtotal,
    }
    return render(request, 'cart.html', context)


@login_required
def farmer_products(request):
    farmer = get_verified_farmer(request.user)
    if not farmer:
        return HttpResponseForbidden("Access denied.")
    products = farmer.products.all()
    return render(request, 'farmer_products.html', {'products': products, 'farmer': farmer})


@login_required
def farmer_product_add(request):
    farmer = get_verified_farmer(request.user)
    if not farmer:
        return HttpResponseForbidden("Access denied.")

    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        category_id = request.POST.get('category')
        unit = request.POST.get('unit', '').strip()
        price = request.POST.get('price', '').strip()
        quantity = request.POST.get('quantity', '').strip()
        description = request.POST.get('description', '').strip()
        is_organic = request.POST.get('is_organic') == 'on'

        if not name or not unit or not price or not quantity:
            return render(request, 'farmer_product_form.html', {
                'error': 'Name, unit, price, and quantity are required.',
                'categories': Category.objects.filter(is_active=True),
                'farmer': farmer,
            })

        try:
            price = float(price)
            quantity = float(quantity)
        except ValueError:
            return render(request, 'farmer_product_form.html', {
                'error': 'Price and quantity must be numbers.',
                'categories': Category.objects.filter(is_active=True),
                'farmer': farmer,
            })

        product = Product.objects.create(
            farmer=farmer,
            name=name,
            unit=unit,
            price=price,
            available_quantity=quantity,
            description=description,
            is_organic=is_organic,
            is_active=True,
        )
        if category_id:
            try:
                product.category = Category.objects.get(pk=category_id, is_active=True)
                product.save()
            except Category.DoesNotExist:
                pass

        # Handle uploaded image
        image_file = request.FILES.get('image')
        if image_file:
            validate_product_image(image_file)
            ProductImage.objects.create(product=product, image=image_file)

        return redirect('farmer_products')

    categories = Category.objects.filter(is_active=True)
    return render(request, 'farmer_product_form.html', {
        'categories': categories,
        'farmer': farmer,
    })


@login_required
def farmer_product_edit(request, product_id):
    farmer = get_verified_farmer(request.user)
    if not farmer:
        return HttpResponseForbidden("Access denied.")

    product = get_object_or_404(Product, id=product_id, farmer=farmer)

    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        category_id = request.POST.get('category')
        unit = request.POST.get('unit', '').strip()
        price = request.POST.get('price', '').strip()
        quantity = request.POST.get('quantity', '').strip()
        description = request.POST.get('description', '').strip()
        is_organic = request.POST.get('is_organic') == 'on'
        is_active = request.POST.get('is_active') == 'on'

        if not name or not unit or not price or not quantity:
            return render(request, 'farmer_product_form.html', {
                'error': 'Name, unit, price, and quantity are required.',
                'categories': Category.objects.filter(is_active=True),
                'farmer': farmer,
                'product': product,
            })

        try:
            price = float(price)
            quantity = float(quantity)
        except ValueError:
            return render(request, 'farmer_product_form.html', {
                'error': 'Price and quantity must be numbers.',
                'categories': Category.objects.filter(is_active=True),
                'farmer': farmer,
                'product': product,
            })

        product.name = name
        product.unit = unit
        product.price = price
        product.available_quantity = quantity
        product.description = description
        product.is_organic = is_organic
        product.is_active = is_active
        if category_id:
            try:
                product.category = Category.objects.get(pk=category_id, is_active=True)
            except Category.DoesNotExist:
                product.category = None
        else:
            product.category = None
        product.save()

        # Handle uploaded image
        image_file = request.FILES.get('image')
        if image_file:
            validate_product_image(image_file)
            product.images.all().delete()
            ProductImage.objects.create(product=product, image=image_file)

        return redirect('farmer_products')

    categories = Category.objects.filter(is_active=True)
    return render(request, 'farmer_product_form.html', {
        'categories': categories,
        'farmer': farmer,
        'product': product,
    })


def terms(request):
    return render(request, 'terms.html')


def privacy(request):
    return render(request, 'privacy.html')
