from django.utils import timezone
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from orders.models import Order
from .models import Review


@login_required
def submit_review(request, order_id):
    order = get_object_or_404(Order, id=order_id, consumer=request.user)
    if order.status != 'delivered':
        return HttpResponseForbidden("You can only review delivered orders.")
    if hasattr(order, 'review'):
        return redirect('order_detail', order_id=order.id)

    if request.method == 'POST':
        rating = request.POST.get('rating')
        text = request.POST.get('text', '').strip()
        if not rating or not rating.isdigit() or int(rating) < 1 or int(rating) > 5:
            return render(request, 'submit_review.html', {
                'order': order,
                'error': 'Please select a rating from 1 to 5.',
            })
        Review.objects.create(
            order=order,
            consumer=request.user,
            farmer=order.farmer,
            rating=int(rating),
            text=text,
        )
        return redirect('order_detail', order_id=order.id)

    return render(request, 'submit_review.html', {'order': order})
from orders.views import get_verified_farmer


@login_required
def respond_to_review(request, review_id):
    farmer = get_verified_farmer(request.user)
    if not farmer:
        return HttpResponseForbidden("Access denied.")

    review = get_object_or_404(Review, id=review_id, farmer=farmer)

    if request.method == 'POST':
        response_text = request.POST.get('response_text', '').strip()
        if not response_text:
            return render(request, 'respond_to_review.html', {
                'review': review,
                'error': 'Please enter a response.',
            })

        review.response_text = response_text
        review.responded_at = timezone.now()
        review.save()
        return redirect('product_detail', product_id=review.order.items.first().product.id)

    return render(request, 'respond_to_review.html', {'review': review})
