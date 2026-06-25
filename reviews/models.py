from django.db import models


class Review(models.Model):
    order = models.OneToOneField(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='review',
    )
    consumer = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='reviews',
    )
    farmer = models.ForeignKey(
        'accounts.FarmerProfile',
        on_delete=models.CASCADE,
        related_name='reviews',
    )
    rating = models.IntegerField(
        choices=[(i, str(i)) for i in range(1, 6)],
    )
    text = models.TextField(blank=True, null=True)
    photo_url = models.URLField(blank=True, null=True)
    response_text = models.TextField(blank=True, null=True)
    responded_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Review by {self.consumer.phone} for Order {self.order.id}"


class OrderIssue(models.Model):
    ISSUE_TYPES = [
        ('missing', 'Missing Items'),
        ('damaged', 'Damaged Items'),
        ('wrong', 'Wrong Items'),
    ]

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('resolved', 'Resolved'),
        ('rejected', 'Rejected'),
    ]

    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='issues',
    )
    consumer = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='reported_issues',
    )
    issue_type = models.CharField(max_length=20, choices=ISSUE_TYPES)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    resolution = models.TextField(blank=True, null=True)
    resolved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='resolved_issues',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Issue {self.id} for Order {self.order.id} ({self.status})"
