from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Product(models.Model):
    farmer = models.ForeignKey(
        'accounts.FarmerProfile',
        on_delete=models.CASCADE,
        related_name='products',
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='products',
    )
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    unit = models.CharField(max_length=50)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    available_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    is_organic = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='images',
    )
    image_url = models.URLField()
    order = models.IntegerField(default=0)

    def __str__(self):
        return f"Image for {self.product.name}"


class Cart(models.Model):
    user = models.OneToOneField(
        'accounts.User',
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name='cart',
    )
    session_key = models.CharField(
        max_length=40,
        blank=True,
        null=True,
        unique=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(user__isnull=False, session_key__isnull=True)
                    | models.Q(user__isnull=True, session_key__isnull=False)
                ),
                name='cart_exclusive',
            )
        ]

    def __str__(self):
        return f"Cart {self.id}"


class CartItem(models.Model):
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name='items',
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['cart', 'product'],
                name='unique_cart_item',
            )
        ]

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"

class PendingCheckout(models.Model):
    checkout_request_id = models.CharField(max_length=50, unique=True)
    phone = models.CharField(max_length=15)
    cart_id = models.IntegerField()
    total = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
