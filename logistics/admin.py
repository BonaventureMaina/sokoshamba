from django.contrib import admin
from .models import Rider, CourierAssignment


@admin.register(Rider)
class RiderAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'vehicle_type', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'phone')


@admin.register(CourierAssignment)
class CourierAssignmentAdmin(admin.ModelAdmin):
    list_display = ('order', 'rider', 'status', 'assigned_at')
    list_filter = ('status',)
    search_fields = ('order__id', 'rider__name')
    readonly_fields = ('status_link_token',)
