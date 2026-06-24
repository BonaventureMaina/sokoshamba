import os
import africastalking
from dotenv import load_dotenv

load_dotenv()

_initialized = False


def _init_sms():
    global _initialized
    if _initialized:
        return
    username = os.environ.get('AT_USERNAME', 'sandbox')
    api_key = os.environ.get('AT_API_KEY')
    if not api_key:
        raise RuntimeError("AT_API_KEY not set in .env")
    africastalking.initialize(username, api_key)
    _initialized = True


def send_sms(phone, message):
    _init_sms()
    sms = africastalking.SMS

    clean_phone = phone.replace('+', '').replace(' ', '')
    if not clean_phone.startswith('254'):
        if clean_phone.startswith('0'):
            clean_phone = '254' + clean_phone[1:]
        else:
            clean_phone = '254' + clean_phone

    recipients = [f'+{clean_phone}']
    response = sms.send(message, recipients)
    if response and isinstance(response, list) and response[0].get('status') == 'Success':
        return True
    else:
        raise Exception(f"SMS API returned unexpected response: {response}")
