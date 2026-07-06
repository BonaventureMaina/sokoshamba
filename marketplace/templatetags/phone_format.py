import re
from django import template

register = template.Library()

def normalize_phone(value):
    """Convert any Kenyan phone input to +254XXXXXXXXX."""
    if not value:
        return value
    digits = re.sub(r'\D', '', value)
    if len(digits) == 9 and digits.startswith('7'):
        return f'+254{digits}'
    elif len(digits) == 10 and digits.startswith('07'):
        return f'+254{digits[1:]}'
    elif len(digits) == 12 and digits.startswith('254'):
        return f'+{digits}'
    return value

@register.filter(name='local_phone')
def local_phone(value):
    """Display +254XXXXXXXXX as 07XX XXX XXX."""
    if not value or not value.startswith('+254'):
        return value
    digits = value[4:]   # e.g., '712345678'
    if len(digits) == 9:
        # digits[0] is '7', digits[1:3] is the operator code
        return f'07{digits[1:3]} {digits[3:6]} {digits[6:]}'
    return value

@register.filter(name='mask_phone')
def mask_phone(value):
    """Show only last 4 digits of a phone number."""
    if not value:
        return value
    if len(value) > 4:
        return '*' * (len(value) - 4) + value[-4:]
    return value

@register.filter(name='display_ref')
def display_ref(value):
    """Extract the user-visible part of a reference number.
    Stored as 'SK-C{consumer_id}-{seq}', display as 'SK-{seq}'."""
    if not value:
        return value
    parts = value.split('-')
    if len(parts) >= 3:
        return f'SK-{parts[2]}'
    return value
