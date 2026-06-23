import os
import base64
import requests
from datetime import datetime


def get_auth_token():
    """Obtain OAuth token from Daraja."""
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
    """
    Initiate an STK Push to the customer's phone.
    Returns dict with CheckoutRequestID and MerchantRequestID, or raises on error.
    """
    token = get_auth_token()
    shortcode = os.environ.get('MPESA_SHORTCODE', '174379')
    passkey = os.environ.get('MPESA_PASSKEY', 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919')
    env = os.environ.get('MPESA_ENVIRONMENT', 'sandbox')
    base_url = 'https://api.safaricom.co.ke' if env == 'production' else 'https://sandbox.safaricom.co.ke'

    # Generate timestamp
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    # Generate password (shortcode + passkey + timestamp, base64 encoded)
    password_str = f"{shortcode}{passkey}{timestamp}"
    password = base64.b64encode(password_str.encode()).decode()

    # Clean phone number (remove +, ensure 254XXXXXXXXX)
    clean_phone = phone.replace('+', '').replace(' ', '')
    if clean_phone.startswith('0'):
        clean_phone = '254' + clean_phone[1:]

    payload = {
        'BusinessShortCode': shortcode,
        'Password': password,
        'Timestamp': timestamp,
        'TransactionType': 'CustomerPayBillOnline',
        'Amount': int(amount),  # Must be integer
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


def verify_callback_signature(data):
    """
    Optional: Verify that the callback is genuinely from Safaricom.
    For sandbox, we trust the source. In production, implement IP whitelisting
    or additional verification.
    """
    # In production, compare the callback's IP against Safaricom's known IPs
    # or verify a signature from headers. For now, just pass.
    return True
