import re
from django import template

register = template.Library()

def normalize_phone(value):
    """Convert any Kenyan phone input to +254XXXXXXXXX."""
    if not value:
        return value
    # Remove all non-digit characters
    digits = re.sub(r'\D', '', value)
    if len(digits) == 9 and digits.startswith('7'):
        return f'+254{digits}'
    elif len(digits) == 10 and digits.startswith('07'):
        return f'+254{digits[1:]}'
    elif len(digits) == 12 and digits.startswith('254'):
        return f'+{digits}'
    return value  # already canonical or unknown format

@register.filter(name='local_phone')
def local_phone(value):
    """Display +254XXXXXXXXX as 07XX XXX XXX."""
    if not value or not value.startswith('+254'):
        return value
    digits = value[4:]  # remove +254
    return f'07{digits[:2]} {digits[2:5]} {digits[5:]}'
