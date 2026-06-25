from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, phone, password=None, **extra_fields):
        if not phone:
            raise ValueError('The Phone number must be set')
        extra_fields.setdefault('is_active', True)
        user = self.model(phone=phone, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        return self.create_user(phone, password, **extra_fields)


class User(AbstractUser):
    ROLE_CHOICES = [
        ('consumer', 'Consumer'),
        ('farmer', 'Farmer'),
        ('admin', 'Admin'),
    ]

    username = None
    phone = models.CharField(max_length=15, unique=True)
    email = models.EmailField(blank=True, null=True)
    phone_verified = models.BooleanField(default=False)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)

    objects = UserManager()

    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = ['email', 'role']

    def __str__(self):
        return f"{self.phone} ({self.role})"


class ConsumerProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='consumer_profile',
    )
    name = models.CharField(max_length=100)
    profile_photo_url = models.ImageField(upload_to="farmer_photos/", blank=True, null=True)

    def __str__(self):
        return self.name


class FarmerProfile(models.Model):
    VERIFICATION_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='farmer_profile',
    )
    farm_name = models.CharField(max_length=150)
    county = models.CharField(max_length=100)
    sub_county = models.CharField(max_length=100, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    photo_url = models.ImageField(upload_to="farmer_photos/", blank=True, null=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_STATUS_CHOICES,
        default='pending',
    )
    verification_notes = models.TextField(blank=True, null=True)
    verified_at = models.DateTimeField(blank=True, null=True)
    verified_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='verified_farmers',
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.farm_name


class DeliveryAddress(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='delivery_addresses',
    )
    label = models.CharField(max_length=100, blank=True, null=True)
    county = models.CharField(max_length=100)
    area = models.CharField(max_length=150)
    landmark = models.CharField(max_length=200, blank=True, null=True)
    instructions = models.TextField(blank=True, null=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user'],
                condition=models.Q(is_default=True),
                name='one_default_per_user',
            )
        ]

    def __str__(self):
        return f"{self.label or self.area} ({self.user.phone})"


class OtpCode(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='otp_codes',
    )
    code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    attempts = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"OTP for {self.user.phone}"
