from django.db import models


class TransactionLog(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)
    actor = models.CharField(max_length=100, blank=True, null=True)
    action = models.CharField(max_length=100)
    details = models.JSONField(blank=True, null=True)
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='transaction_logs',
    )

    def __str__(self):
        return f"{self.action} by {self.actor} at {self.timestamp}"
