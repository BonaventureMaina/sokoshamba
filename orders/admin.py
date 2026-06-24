from django.contrib import admin, messages
from .models import Order, OrderItem, MpesaPayment, Payout, Refund


class RefundAdmin(admin.ModelAdmin):
    list_display = ('order', 'amount', 'status', 'retry_count', 'created_at')
    list_filter = ('status',)
    actions = ['retry_refund']

    def retry_refund(self, request, queryset):
        for refund in queryset.filter(status='failed'):
            refund.status = 'completed'
            refund.retry_count += 1
            refund.save()
            self.message_user(request, f'Refund for Order #{refund.order.id} retried successfully.', messages.SUCCESS)
        for refund in queryset.exclude(status='failed'):
            self.message_user(request, f'Refund for Order #{refund.order.id} is not in failed state.', messages.WARNING)
    retry_refund.short_description = "Retry selected refunds"


class PayoutAdmin(admin.ModelAdmin):
    list_display = ('order', 'farmer_name', 'amount', 'status', 'retry_count', 'created_at')
    list_filter = ('status',)
    actions = ['retry_payout']

    def farmer_name(self, obj):
        return obj.farmer.farm_name
    farmer_name.short_description = 'Farmer'

    def retry_payout(self, request, queryset):
        for payout in queryset.filter(status='failed'):
            payout.status = 'completed'
            payout.retry_count += 1
            payout.save()
            self.message_user(request, f'Payout for Order #{payout.order.id} retried successfully.', messages.SUCCESS)
        for payout in queryset.exclude(status='failed'):
            self.message_user(request, f'Payout for Order #{payout.order.id} is not in failed state.', messages.WARNING)
    retry_payout.short_description = "Retry selected payouts"


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'consumer_phone', 'farmer_name', 'status', 'total', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('consumer__phone', 'farmer__farm_name')
    readonly_fields = ('delivery_address_snapshot', 'created_at')

    def consumer_phone(self, obj):
        return obj.consumer.phone
    consumer_phone.short_description = 'Consumer'

    def farmer_name(self, obj):
        return obj.farmer.farm_name
    farmer_name.short_description = 'Farmer'


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product_name', 'quantity', 'price')
    search_fields = ('product_name',)


@admin.register(MpesaPayment)
class MpesaPaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'amount', 'phone_number', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('phone_number', 'mpesa_receipt_number')


# Safely replace the default Payout and Refund admins
for model, admin_class in [(Payout, PayoutAdmin), (Refund, RefundAdmin)]:
    try:
        admin.site.unregister(model)
    except admin.sites.NotRegistered:
        pass
    admin.site.register(model, admin_class)
