from django.conf import settings
from django.contrib import admin, messages
from .models import Rider, CourierAssignment
from notifications.sms_service import send_sms


@admin.register(Rider)
class RiderAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'vehicle_type', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'phone')


@admin.register(CourierAssignment)
class CourierAssignmentAdmin(admin.ModelAdmin):
    list_display = ('order', 'rider', 'status', 'assigned_at')
    list_filter = ('status',)
    search_fields = ('order__id', 'rider__name')
    readonly_fields = ('status_link_token',)
    exclude = ('status_link_expires',)

    def save_model(self, request, obj, form, change):
        is_new = not obj.pk
        super().save_model(request, obj, form, change)

        if is_new:
            base_url = getattr(settings, 'NGROK_URL', None) or 'http://127.0.0.1:8000'
            courier_url = f'{base_url}/courier/{obj.status_link_token}/'
            message = (
                f'SokoShamba delivery: Order #{obj.order.id} is ready for pickup. '
                f'Tap to update status: {courier_url}'
            )
            try:
                send_sms(obj.rider.phone, message)
                self.message_user(request, f'SMS sent to {obj.rider.name} ({obj.rider.phone}).', messages.SUCCESS)
            except Exception as e:
                self.message_user(request, f'Failed to send SMS to {obj.rider.name}: {e}', messages.ERROR)
