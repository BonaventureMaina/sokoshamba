import random
import os
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from .models import User, OtpCode, ConsumerProfile, FarmerProfile
from marketplace.templatetags.phone_format import normalize_phone


def login_request(request):
    if request.user.is_authenticated:
        return redirect('home')

    next_url = request.GET.get('next', '')
    after_checkout = next_url.startswith('/orders/')

    if request.method == 'POST':
        phone = normalize_phone(request.POST.get('phone', '').strip())
        if not phone:
            return render(request, 'login.html', {
                'error': 'Enter your phone number.',
                'phone': phone,
                'after_checkout': after_checkout,
            })

        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            return render(request, 'login.html', {
                'error': 'No account found with that phone number.',
                'phone': phone,
                'after_checkout': after_checkout,
            })

        code = str(random.randint(100000, 999999))
        OtpCode.objects.filter(user=user).delete()

        expires_at = timezone.now() + timezone.timedelta(minutes=5)
        OtpCode.objects.create(user=user, code=code, expires_at=expires_at)

        if os.environ.get('MPESA_ENVIRONMENT', 'sandbox') == 'sandbox':
            print(f"\n>>> OTP for {phone}: {code}\n")
        else:
            try:
                from notifications.sms_service import send_sms
                send_sms(phone, f'Your SokoShamba OTP code is: {code}')
            except Exception as e:
                print(f'SMS failed for {phone}: {e}. OTP code is: {code}')

        if next_url:
            request.session['login_next'] = next_url
        request.session['login_phone'] = phone
        return redirect('otp_verify')

    return render(request, 'login.html', {'after_checkout': after_checkout})


def otp_verify(request):
    phone = request.session.get('login_phone')
    if not phone:
        return redirect('login_request')

    if request.method == 'POST':
        code = request.POST.get('code', '').strip()
        if not code or len(code) != 6:
            return render(request, 'otp_verify.html', {'error': 'Enter a 6-digit code.', 'phone': phone})

        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            request.session.pop('login_phone', None)
            return redirect('login_request')

        otp = OtpCode.objects.filter(user=user, code=code).first()
        if not otp:
            return render(request, 'otp_verify.html', {'error': 'Invalid code.', 'phone': phone})

        if otp.expires_at < timezone.now():
            otp.delete()
            return render(request, 'otp_verify.html', {'error': 'Code expired. Request a new one.', 'phone': phone})

        otp.delete()
        if not user.phone_verified:
            user.phone_verified = True
            user.save(update_fields=['phone_verified'])

        if request.POST.get('remember_me'):
            request.session.set_expiry(60 * 60 * 24 * 30)

        login(request, user)
        request.session.pop('login_phone', None)

        next_url = request.session.pop('login_next', None)
        if next_url:
            return redirect(next_url)
        if user.role == 'farmer':
            return redirect('farmer_order_list')
        return redirect('home')

    return render(request, 'otp_verify.html', {'phone': phone})


def logout_view(request):
    logout(request)
    return redirect('home')


def get_farmer(user):
    """Return farmer profile if user is a farmer (any verification status)."""
    if user.is_authenticated and user.role == 'farmer':
        try:
            return user.farmer_profile
        except Exception:
            pass
    return None


def get_verified_farmer(user):
    """Return farmer profile only if verified and active."""
    farmer = get_farmer(user)
    if farmer and farmer.verification_status == 'verified' and farmer.is_active:
        return farmer
    return None


@login_required
def consumer_profile(request):
    if request.user.role != 'consumer':
        return redirect('home')

    profile, _ = ConsumerProfile.objects.get_or_create(user=request.user)

    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        email = request.POST.get('email', '').strip()

        profile.name = name
        profile.save()

        if email:
            request.user.email = email
            request.user.save()

        if request.POST.get('remove_photo') == 'on':
            profile.profile_photo_url.delete(save=False)
            profile.profile_photo_url = None
            profile.save()

        if 'photo' in request.FILES:
            profile.profile_photo_url = request.FILES['photo']
            profile.save()

        messages.success(request, 'Profile updated successfully.')
        return redirect('consumer_profile')

    return render(request, 'consumer_profile.html', {'profile': profile})


@login_required
def farmer_profile(request):
    farmer = get_verified_farmer(request.user)
    if not farmer:
        return redirect('home')

    if request.method == 'POST':
        farm_name = request.POST.get('farm_name', '').strip()
        bio = request.POST.get('bio', '').strip()

        if farm_name:
            farmer.farm_name = farm_name
        farmer.bio = bio
        farmer.save()

        if request.POST.get('remove_photo') == 'on':
            farmer.photo_url.delete(save=False)
            farmer.photo_url = None
            farmer.save()

        if 'photo' in request.FILES:
            farmer.photo_url = request.FILES['photo']
            farmer.save()

        messages.success(request, 'Profile updated successfully.')
        return redirect('farmer_profile')

    return render(request, 'farmer_profile.html', {'farmer': farmer})

def register_farmer(request):
    if request.method == 'POST':
        phone = normalize_phone(request.POST.get('phone', '').strip())
        farm_name = request.POST.get('farm_name', '').strip()
        county = request.POST.get('county', '').strip()
        sub_county = request.POST.get('sub_county', '').strip()
        bio = request.POST.get('bio', '').strip()

        if not phone or not farm_name or not county:
            return render(request, 'register_farmer.html', {
                'error': 'Phone, farm name, and county are required.',
                'phone': phone, 'farm_name': farm_name, 'county': county,
                'sub_county': sub_county, 'bio': bio,
            })

        # Check if phone already exists
        if User.objects.filter(phone=phone).exists():
            return render(request, 'register_farmer.html', {
                'error': 'A user with that phone number already exists.',
                'phone': phone, 'farm_name': farm_name, 'county': county,
                'sub_county': sub_county, 'bio': bio,
            })

        # Create user
        user = User.objects.create_user(phone=phone, role='farmer', phone_verified=False)
        user.set_unusable_password()
        user.save()

        # Create farmer profile (pending)
        FarmerProfile.objects.create(
            user=user,
            farm_name=farm_name,
            county=county,
            sub_county=sub_county,
            bio=bio,
            verification_status='pending',
            is_active=True,
        )

        # Handle photo upload
        if 'photo' in request.FILES:
            profile = user.farmer_profile
            profile.photo_url = request.FILES['photo']
            profile.save()

        # Generate and send OTP (same as login)
        import random
        code = str(random.randint(100000, 999999))
        OtpCode.objects.filter(user=user).delete()
        expires_at = timezone.now() + timezone.timedelta(minutes=5)
        OtpCode.objects.create(user=user, code=code, expires_at=expires_at)

        if os.environ.get('MPESA_ENVIRONMENT', 'sandbox') == 'sandbox':
            print(f"\n>>> OTP for {phone}: {code}\n")
        else:
            try:
                from notifications.sms_service import send_sms
                send_sms(phone, f'Your SokoShamba OTP code is: {code}')
            except Exception as e:
                print(f'SMS failed for {phone}: {e}. OTP code is: {code}')

        request.session['login_phone'] = phone
        return redirect('otp_verify')

    return render(request, 'register_farmer.html')
