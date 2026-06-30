from django.shortcuts import render, redirect
from django_ratelimit.decorators import ratelimit
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from .models import User, OtpCode, ConsumerProfile
from marketplace.templatetags.phone_format import normalize_phone


@ratelimit(key='ip', rate='5/m', block=True)
def login_request(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        phone = normalize_phone(request.POST.get('phone', '').strip())
        if not phone:
            return render(request, 'login.html', {'error': 'Enter your phone number.', 'phone': phone})

        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            return render(request, 'login.html', {'error': 'No account found with that phone number.', 'phone': phone})

        import random
        code = str(random.randint(100000, 999999))
        OtpCode.objects.filter(user=user).delete()

        expires_at = timezone.now() + timezone.timedelta(minutes=5)
        OtpCode.objects.create(user=user, code=code, expires_at=expires_at)

        # Print OTP to console
        print(f"\n>>> OTP for {phone}: {code}\n")

        request.session['login_phone'] = phone
        return redirect('otp_verify')

    return render(request, 'login.html')


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
            del request.session['login_phone']
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

        # Extend session if "Remember me" checked
        if request.POST.get('remember_me'):
            request.session.set_expiry(60 * 60 * 24 * 30)  # 30 days
        login(request, user)
        del request.session['login_phone']

        if user.role == 'farmer':
            return redirect('farmer_order_list')
        return redirect('home')

    return render(request, 'otp_verify.html', {'phone': phone})


def logout_view(request):
    logout(request)
    return redirect('home')

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

        # Handle photo removal
        if request.POST.get('remove_photo') == 'on':
            profile.profile_photo_url.delete(save=False)
            profile.profile_photo_url = None
            profile.save()

        # Handle profile photo upload
        if 'photo' in request.FILES:
            profile.profile_photo_url = request.FILES['photo']
            profile.save()

        return redirect('consumer_profile')

    return render(request, 'consumer_profile.html', {'profile': profile})

def get_verified_farmer(user):
    """Return farmer profile if user is a verified farmer, else None."""
    if user.is_authenticated and user.role == 'farmer':
        try:
            profile = user.farmer_profile
            if profile.verification_status == 'verified' and profile.is_active:
                return profile
        except Exception:
            pass
    return None


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

        # Handle photo removal
        if request.POST.get('remove_photo') == 'on':
            farmer.photo_url.delete(save=False)
            farmer.photo_url = None
            farmer.save()

        # Handle photo upload
        if 'photo' in request.FILES:
            farmer.photo_url = request.FILES['photo']
            farmer.save()

        return redirect('farmer_profile')

    return render(request, 'farmer_profile.html', {'farmer': farmer})
