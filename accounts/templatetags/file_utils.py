import os
from django import template

register = template.Library()

@register.filter(name='filename')
def filename(value):
    """Return only the filename from a full path."""
    if not value:
        return ''
    return os.path.basename(value)
