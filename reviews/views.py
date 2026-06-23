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
