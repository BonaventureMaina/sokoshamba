from django.contrib import admin
from .models import NotificationLog


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'order', 'channel', 'status', 'created_at')
    list_filter = ('channel', 'status')
    search_fields = ('user__phone', 'order__id')
    readonly_fields = ('created_at',)
