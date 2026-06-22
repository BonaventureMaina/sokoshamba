from django.contrib import admin
from django.urls import path
from marketplace.views import home, product_list, product_detail, cart_detail, add_to_cart, remove_from_cart
from orders.views import checkout, initiate_payment, mpesa_callback

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home, name='home'),
    path('products/', product_list, name='product_list'),
    path('product/<int:product_id>/', product_detail, name='product_detail'),
    path('cart/', cart_detail, name='cart'),
    path('cart/add/', add_to_cart, name='add_to_cart'),
    path('cart/remove/', remove_from_cart, name='remove_from_cart'),
    path('checkout/', checkout, name='checkout'),
    path('checkout/pay/', initiate_payment, name='initiate_payment'),
    path('webhooks/mpesa/callback/', mpesa_callback, name='mpesa_callback'),
]
