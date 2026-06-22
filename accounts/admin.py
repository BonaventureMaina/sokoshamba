from django.contrib import admin
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
            'fields': ('phone', 'email', 'password1', 'password2', 'role'),
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
    list_display = ('farm_name', 'user_phone', 'county', 'verification_status', 'is_active')
    list_filter = ('verification_status', 'is_active', 'county')
    search_fields = ('farm_name', 'user__phone')
    readonly_fields = ('verification_notes', 'verified_at', 'verified_by')

    def user_phone(self, obj):
        return obj.user.phone
    user_phone.short_description = 'Phone'


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
