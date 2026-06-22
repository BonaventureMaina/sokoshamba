from django.contrib import admin
from .models import Order, OrderItem, MpesaPayment, Payout, Refund


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


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = ('order', 'farmer_name', 'amount', 'status', 'retry_count', 'created_at')
    list_filter = ('status',)
    search_fields = ('farmer__farm_name', 'phone_number')

    def farmer_name(self, obj):
        return obj.farmer.farm_name
    farmer_name.short_description = 'Farmer'


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ('order', 'amount', 'status', 'retry_count', 'created_at')
    list_filter = ('status',)
