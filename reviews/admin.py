from django.contrib import admin
from .models import Review, OrderIssue


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('order', 'consumer', 'farmer', 'rating', 'created_at')
    list_filter = ('rating',)
    search_fields = ('consumer__phone', 'farmer__farm_name')


@admin.register(OrderIssue)
class OrderIssueAdmin(admin.ModelAdmin):
    list_display = ('order', 'issue_type', 'status', 'created_at')
    list_filter = ('status', 'issue_type')
    search_fields = ('order__id', 'consumer__phone')
