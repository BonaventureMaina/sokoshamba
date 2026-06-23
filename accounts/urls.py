from django.urls import path
from .views import login_request, otp_verify, logout_view

urlpatterns = [
    path('login/', login_request, name='login_request'),
    path('otp-verify/', otp_verify, name='otp_verify'),
    path('logout/', logout_view, name='logout'),
]
