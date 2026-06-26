import os
import base64
import requests
from datetime import datetime


# Safaricom's known callback IP ranges (for production)
SAFARICOM_IPS = [
    '196.201.214.200', '196.201.214.206', '196.201.213.114',
    '196.201.214.207', '196.201.214.208', '196.201.213.44',
    '196.201.212.127', '196.201.212.128', '196.201.212.129',
    '196.201.212.130', '196.201.212.131', '196.201.212.132',
    '196.201.212.133', '196.201.212.134', '196.201.212.135',
    '196.201.212.136', '196.201.212.137', '196.201.212.138',
    '196.201.212.139', '196.201.212.140', '196.201.212.141',
    '196.201.212.142', '196.201.212.143', '196.201.212.144',
    '196.201.212.145', '196.201.212.146', '196.201.212.147',
    '196.201.212.148', '196.201.212.149', '196.201.212.150',
    '196.201.212.151', '196.201.212.152', '196.201.212.153',
]


def get_auth_token():
    consumer_key = os.environ.get('MPESA_CONSUMER_KEY')
    consumer_secret = os.environ.get('MPESA_CONSUMER_SECRET')
    if not consumer_key or not consumer_secret:
        raise Exception("M-Pesa credentials not configured in .env")

    auth = base64.b64encode(f"{consumer_key}:{consumer_secret}".encode()).decode()
    headers = {'Authorization': f'Basic {auth}'}
    env = os.environ.get('MPESA_ENVIRONMENT', 'sandbox')
    base_url = 'https://api.safaricom.co.ke' if env == 'production' else 'https://sandbox.safaricom.co.ke'
    response = requests.get(f'{base_url}/oauth/v1/generate?grant_type=client_credentials', headers=headers)
    response.raise_for_status()
    return response.json()['access_token']


def initiate_stk_push(phone, amount, account_reference, callback_url):
    token = get_auth_token()
    shortcode = os.environ.get('MPESA_SHORTCODE', '174379')
    passkey = os.environ.get('MPESA_PASSKEY', 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919')
    env = os.environ.get('MPESA_ENVIRONMENT', 'sandbox')
    base_url = 'https://api.safaricom.co.ke' if env == 'production' else 'https://sandbox.safaricom.co.ke'

    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    password_str = f"{shortcode}{passkey}{timestamp}"
    password = base64.b64encode(password_str.encode()).decode()

    clean_phone = phone.replace('+', '').replace(' ', '')
    if clean_phone.startswith('0'):
        clean_phone = '254' + clean_phone[1:]

    payload = {
        'BusinessShortCode': shortcode,
        'Password': password,
        'Timestamp': timestamp,
        'TransactionType': 'CustomerPayBillOnline',
        'Amount': int(amount),
        'PartyA': clean_phone,
        'PartyB': shortcode,
        'PhoneNumber': clean_phone,
        'CallBackURL': callback_url,
        'AccountReference': account_reference,
        'TransactionDesc': 'SokoShamba order',
    }

    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }

    url = f'{base_url}/mpesa/stkpush/v1/processrequest'
    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    data = response.json()
    return {
        'MerchantRequestID': data['MerchantRequestID'],
        'CheckoutRequestID': data['CheckoutRequestID'],
    }


def verify_callback_signature(request):
    """
    Verify that the callback genuinely originates from Safaricom.
    In production, check the request's IP against Safaricom's known ranges.
    In sandbox, we trust the source (ngrok/localhost).
    """
    env = os.environ.get('MPESA_ENVIRONMENT', 'sandbox')
    if env == 'sandbox':
        return True  # Sandbox callbacks are trusted for development

    # Get the real client IP, accounting for reverse proxies
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        client_ip = x_forwarded_for.split(',')[0].strip()
    else:
        client_ip = request.META.get('REMOTE_ADDR')

    if client_ip in SAFARICOM_IPS:
        return True
    else:
        # Log the suspicious IP
        print(f"[SECURITY] Callback from untrusted IP: {client_ip}")
        return False
