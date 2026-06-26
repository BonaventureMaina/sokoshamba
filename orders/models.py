from django.db import models
from encrypted_model_fields.fields import EncryptedCharField


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('farmer_declined', 'Farmer Declined'),
        ('preparing', 'Preparing'),
        ('ready_for_pickup', 'Ready for Pickup'),
        ('pickup_requested', 'Pickup Requested'),
        ('courier_assigned', 'Courier Assigned'),
        ('in_transit', 'In Transit'),
        ('delivered', 'Delivered'),
        ('auto_cancelled', 'Auto Cancelled'),
        ('consumer_cancelled', 'Consumer Cancelled'),
    ]

    consumer = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='orders',
    )
    farmer = models.ForeignKey(
        'accounts.FarmerProfile',
        on_delete=models.CASCADE,
        related_name='orders',
    )
    address = models.ForeignKey(
        'accounts.DeliveryAddress',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    decline_reason = models.TextField(blank=True, null=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    delivery_address_snapshot = models.JSONField()
    consumer_phone_at_order = EncryptedCharField(max_length=15)
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(blank=True, null=True)
    ready_at = models.DateTimeField(blank=True, null=True)
    pickup_requested_at = models.DateTimeField(blank=True, null=True)
    courier_assigned_at = models.DateTimeField(blank=True, null=True)
    in_transit_at = models.DateTimeField(blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)
    auto_cancel_at = models.DateTimeField(blank=True, null=True)
    escalation_sent = models.BooleanField(default=False)
    consumer_cancelled_at = models.DateTimeField(blank=True, null=True)
    farmer_declined_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['consumer', 'status']),
            models.Index(fields=['farmer', 'status']),
            models.Index(fields=['status', 'auto_cancel_at']),
        ]

    def __str__(self):
        return f"Order {self.id} ({self.status})"


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items',
    )
    product = models.ForeignKey(
        'marketplace.Product',
        on_delete=models.CASCADE,
    )
    product_name = models.CharField(max_length=150)
    unit = models.CharField(max_length=50)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} x {self.product_name}"


class MpesaPayment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='mpesa_payments',
    )
    merchant_request_id = models.CharField(max_length=50)
    checkout_request_id = models.CharField(max_length=50, blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    mpesa_receipt_number = models.CharField(max_length=50, blank=True, null=True)
    phone_number = EncryptedCharField(max_length=15)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    result_description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['order', 'status']),
        ]

    def __str__(self):
        return f"Payment {self.id} ({self.status})"


class Payout(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name='payout',
    )
    farmer = models.ForeignKey(
        'accounts.FarmerProfile',
        on_delete=models.CASCADE,
        related_name='payouts',
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    phone_number = EncryptedCharField(max_length=15)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    failure_reason = models.TextField(blank=True, null=True)
    retry_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Payout {self.id} to {self.farmer.farm_name}"


class Refund(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name='refund',
    )
    payment = models.ForeignKey(
        MpesaPayment,
        on_delete=models.CASCADE,
        related_name='refunds',
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    failure_reason = models.TextField(blank=True, null=True)
    retry_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Refund {self.id} for Order {self.order.id}"
