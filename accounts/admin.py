from django.utils import timezone
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, ConsumerProfile, FarmerProfile, DeliveryAddress, OtpCode


class UserAdmin(BaseUserAdmin):
    list_display = ('phone', 'email', 'role', 'is_active', 'is_staff', 'date_joined')
    list_filter = ('role', 'is_active', 'is_staff', 'phone_verified')
    search_fields = ('phone', 'email')
    ordering = ('-date_joined',)

    fieldsets = (
        (None, {'fields': ('phone', 'password')}),
        ('Personal info', {'fields': ('email',)}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'role', 'phone_verified')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone', 'email', 'password1', 'password2', 'role', 'phone_verified'),
        }),
    )


@admin.register(ConsumerProfile)
class ConsumerProfileAdmin(admin.ModelAdmin):
    list_display = ('name', 'user_phone', 'user')
    search_fields = ('name', 'user__phone')

    def user_phone(self, obj):
        return obj.user.phone
    user_phone.short_description = 'Phone'


@admin.register(FarmerProfile)
class FarmerProfileAdmin(admin.ModelAdmin):
    list_display = ('farm_name', 'user_phone', 'county', 'verification_status', 'terms_accepted', 'is_active')
    list_filter = ('verification_status', 'is_active', 'county')
    search_fields = ('farm_name', 'user__phone')
    readonly_fields = ('verified_at',)

    def user_phone(self, obj):
        return obj.user.phone
    user_phone.short_description = 'Phone'

    def get_readonly_fields(self, request, obj=None):
        """Owner only fields – Operator cannot see or change them."""
        fields = super().get_readonly_fields(request, obj)
        if not request.user.is_superuser:
            fields += ('is_active', 'verification_notes', 'verified_by', 'terms_accepted')
        return fields

    def save_model(self, request, obj, form, change):
        """Auto‑set verified_by when verification status changes to verified."""
        if 'verification_status' in form.changed_data and obj.verification_status == 'verified':
            obj.verified_by = request.user
            obj.verified_at = timezone.now()
        # Only superuser can change is_active
        if 'is_active' in form.changed_data and not request.user.is_superuser:
            self.message_user(request, 'Only the Owner can activate or suspend farmers.', messages.ERROR)
            return
        super().save_model(request, obj, form, change)


@admin.register(DeliveryAddress)
class DeliveryAddressAdmin(admin.ModelAdmin):
    list_display = ('label', 'area', 'county', 'user_phone', 'is_default')
    search_fields = ('area', 'user__phone')

    def user_phone(self, obj):
        return obj.user.phone
    user_phone.short_description = 'Phone'


@admin.register(OtpCode)
class OtpCodeAdmin(admin.ModelAdmin):
    list_display = ('user', 'code', 'expires_at', 'attempts', 'created_at')
    readonly_fields = ('created_at',)


admin.site.register(User, UserAdmin)
