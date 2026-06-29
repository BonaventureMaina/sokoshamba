from django.db import models
from django.utils import timezone
from datetime import timedelta
import secrets


class Rider(models.Model):
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    id_number = models.CharField(max_length=20, blank=True, null=True)
    vehicle_type = models.CharField(max_length=50, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.phone})"


class CourierAssignment(models.Model):
    STATUS_CHOICES = [
        ('assigned', 'Assigned'),
        ('en_route', 'En Route'),
        ('picked_up', 'Picked Up'),
        ('delivered', 'Delivered'),
    ]

    order = models.OneToOneField(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='courier_assignment',
    )
    rider = models.ForeignKey(
        Rider,
        on_delete=models.CASCADE,
        related_name='assignments',
    )
    status_link_token = models.CharField(
        max_length=64,
        unique=True,
        default=secrets.token_urlsafe,
    )
    status_link_expires = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='assigned')
    assigned_at = models.DateTimeField(auto_now_add=True)
    picked_up_at = models.DateTimeField(blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.status_link_expires:
            self.status_link_expires = timezone.now() + timedelta(hours=6)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Courier for Order {self.order.id} ({self.status})"
