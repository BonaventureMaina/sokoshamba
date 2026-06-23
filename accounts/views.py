from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.utils import timezone
from django.views.decorators.http import require_GET
from .models import User, OtpCode


def login_request(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        phone = request.POST.get('phone', '').strip()
        if not phone:
            return render(request, 'login.html', {'error': 'Enter your phone number.'})

        # Find user; if not exist, can't login (consumers are created at checkout)
        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            return render(request, 'login.html', {'error': 'No account found with that phone number.'})

        # Generate a 6-digit OTP
        import random
        code = str(random.randint(100000, 999999))
        # Invalidate previous OTPs for this user
        OtpCode.objects.filter(user=user).delete()

        # Create new OTP, valid 5 minutes
        expires_at = timezone.now() + timezone.timedelta(minutes=5)
        OtpCode.objects.create(user=user, code=code, expires_at=expires_at)

        # Simulate sending OTP: print to console (later replace with Africa's Talking SMS)
        print(f"\n>>> OTP for {phone}: {code}\n")

        # Store phone in session for the verify step
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

        # Check OTP
        otp = OtpCode.objects.filter(user=user, code=code).first()
        if not otp:
            return render(request, 'otp_verify.html', {'error': 'Invalid code.', 'phone': phone})

        if otp.expires_at < timezone.now():
            otp.delete()
            return render(request, 'otp_verify.html', {'error': 'Code expired. Request a new one.', 'phone': phone})

        # Success – log user in
        otp.delete()  # one-time use
        if not user.phone_verified:
            user.phone_verified = True
            user.save(update_fields=['phone_verified'])

        login(request, user)
        del request.session['login_phone']

        # Redirect based on role
        if user.role == 'farmer':
            return redirect('farmer_order_list')
        return redirect('home')

    return render(request, 'otp_verify.html', {'phone': phone})


def logout_view(request):
    logout(request)
    return redirect('home')
