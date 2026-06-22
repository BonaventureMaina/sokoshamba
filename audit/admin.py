from django.contrib import admin
from .models import TransactionLog


@admin.register(TransactionLog)
class TransactionLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'actor', 'action', 'order')
    list_filter = ('action',)
    search_fields = ('actor', 'action', 'order__id')
    readonly_fields = ('timestamp',)
