from django.db import models


class NotificationLog(models.Model):
    CHANNEL_CHOICES = [
        ('sms', 'SMS'),
        ('push', 'Push'),
        ('email', 'Email'),
    ]

    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('delivered', 'Delivered'),
    ]

    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='notification_logs',
    )
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='notification_logs',
    )
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    provider_message_id = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.channel} to {self.user} ({self.status})"
