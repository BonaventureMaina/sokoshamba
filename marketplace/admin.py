from django.contrib import admin
from .models import Category, Product, ProductImage, Cart, CartItem


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'farmer_name', 'category', 'price', 'available_quantity', 'is_active')
    list_filter = ('is_active', 'is_organic', 'category')
    search_fields = ('name', 'farmer__farm_name')

    def farmer_name(self, obj):
        return obj.farmer.farm_name
    farmer_name.short_description = 'Farmer'


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ('product', 'image', 'order')
    search_fields = ('product__name',)


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ('id', 'user_phone', 'session_key', 'updated_at')
    search_fields = ('user__phone', 'session_key')

    def user_phone(self, obj):
        return obj.user.phone if obj.user else 'Guest'
    user_phone.short_description = 'User'


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ('cart', 'product', 'quantity', 'added_at')
    search_fields = ('product__name',)
