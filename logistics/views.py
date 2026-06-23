from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponseForbidden
from django.utils import timezone
from .models import CourierAssignment


def courier_status(request, token):
    assignment = get_object_or_404(CourierAssignment, status_link_token=token)

    if assignment.status_link_expires < timezone.now():
        return HttpResponseForbidden("This link has expired. Please contact support for a new one.")

    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'picked_up' and assignment.status == 'assigned':
            assignment.status = 'picked_up'
            assignment.picked_up_at = timezone.now()
            assignment.save()
            order = assignment.order
            order.status = 'in_transit'
            order.in_transit_at = timezone.now()
            order.save()
        elif action == 'delivered' and assignment.status == 'picked_up':
            assignment.status = 'delivered'
            assignment.delivered_at = timezone.now()
            assignment.save()
            order = assignment.order
            order.status = 'delivered'
            order.delivered_at = timezone.now()
            order.save()
        return redirect('courier_status', token=token)

    context = {
        'assignment': assignment,
        'order': assignment.order,
        'rider': assignment.rider,
    }
    return render(request, 'courier_status.html', context)
