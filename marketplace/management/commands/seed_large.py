import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from accounts.models import User, FarmerProfile, ConsumerProfile
from marketplace.models import Category, Product
from orders.models import Order, OrderItem, MpesaPayment, Payout, Refund
from reviews.models import Review, OrderIssue
from logistics.models import Rider, CourierAssignment

class Command(BaseCommand):
    help = 'Seed the database with large realistic test data'

    def handle(self, *args, **options):
        cats = ['Vegetables', 'Fruits', 'Grains', 'Dairy', 'Herbs']
        categories = {}
        for name in cats:
            cat, _ = Category.objects.get_or_create(name=name, defaults={'is_active': True})
            categories[name] = cat

        farmers = []
        for i in range(1, 21):
            phone = f'+25470001{i:04d}'
            user, _ = User.objects.get_or_create(
                phone=phone,
                defaults={'role': 'farmer', 'phone_verified': True, 'is_active': True}
            )
            user.set_password('FarmerPass123!')
            user.save()
            status = random.choices(['verified', 'pending', 'rejected'], weights=[80, 10, 10])[0]
            profile, _ = FarmerProfile.objects.get_or_create(
                user=user,
                defaults={
                    'farm_name': f'Farm {i}',
                    'county': random.choice(['Kiambu', 'Machakos', 'Nyeri', 'Muranga', 'Nairobi', 'Kisumu']),
                    'sub_county': random.choice(['Ruiru', 'Thika', 'Kikuyu', '', '']),
                    'bio': f'We grow fresh organic produce in {random.choice(["Kiambu","Machakos"])}.',
                    'verification_status': status,
                    'is_active': True,
                }
            )
            if status == 'verified':
                farmers.append(profile)

        consumers = []
        for i in range(1, 51):
            phone = f'+25471001{i:04d}'
            user, _ = User.objects.get_or_create(
                phone=phone,
                defaults={'role': 'consumer', 'phone_verified': True, 'is_active': True}
            )
            user.set_password('ConsumerPass123!')
            user.save()
            ConsumerProfile.objects.get_or_create(user=user, defaults={'name': f'Consumer {i}'})
            consumers.append(user)

        product_names = [
            'Tomatoes', 'Kales', 'Spinach', 'Onions', 'Cabbage', 'Carrots', 'Beans', 'Peas', 'Maize',
            'Bananas', 'Avocados', 'Mangoes', 'Pawpaw', 'Oranges', 'Lemons', 'Sweet Potatoes',
            'Irish Potatoes', 'Arrow Roots', 'Cassava', 'Yams', 'Green Pepper', 'Red Pepper', 'Chillies',
            'Coriander', 'Parsley', 'Mint', 'Rosemary', 'Thyme', 'Sage', 'Dill', 'Lettuce', 'Rocket',
            'Broccoli', 'Cauliflower', 'Zucchini', 'Cucumber', 'Eggplant', 'Okra', 'Pumpkin', 'Butternut'
        ]
        units = ['kg', 'bunch', 'piece', 'bag', 'dozen']
        products = []
        for _ in range(200):
            farmer = random.choice(farmers) if farmers else None
            if not farmer:
                continue
            name = random.choice(product_names)
            price = random.randint(20, 300)
            qty = random.randint(5, 500)
            unit = random.choice(units)
            p = Product.objects.create(
                farmer=farmer,
                name=name,
                price=price,
                available_quantity=qty,
                unit=unit,
                is_organic=random.choice([True, False]),
                is_active=random.choices([True, False], weights=[90, 10])[0],
                description=f'Fresh {name} from {farmer.farm_name}.',
                category=random.choice(list(categories.values()))
            )
            products.append(p)

        riders = []
        for i in range(1, 6):
            rider, _ = Rider.objects.get_or_create(
                phone=f'+25471122233{i}',
                defaults={'name': f'Rider {i}', 'vehicle_type': 'boda', 'is_active': True}
            )
            riders.append(rider)

        statuses = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'pickup_requested',
                    'courier_assigned', 'in_transit', 'delivered', 'auto_cancelled', 'consumer_cancelled', 'farmer_declined']
        for _ in range(300):
            consumer = random.choice(consumers)
            farmer = random.choice(farmers) if farmers else None
            if not farmer:
                continue
            farmer_products = [p for p in products if p.farmer_id == farmer.id and p.is_active]
            if not farmer_products:
                continue
            num_items = random.randint(1, min(4, len(farmer_products)))
            order_products = random.sample(farmer_products, num_items)
            subtotal = sum(prod.price * random.randint(1, 5) for prod in order_products)
            delivery_fee = 150
            total = subtotal + delivery_fee
            status = random.choice(statuses)
            address = {
                'county': random.choice(['Nairobi', 'Mombasa', 'Kisumu']),
                'area': random.choice(['Kilimani', 'Westlands', 'Karen', 'Bamburi', 'Kisumu CBD']),
                'landmark': 'Near the mall',
                'instructions': 'Ring bell',
            }
            order = Order.objects.create(
                consumer=consumer,
                farmer=farmer,
                subtotal=subtotal,
                delivery_fee=delivery_fee,
                total=total,
                delivery_address_snapshot=address,
                consumer_phone_at_order=consumer.phone,
                status=status,
                auto_cancel_at=timezone.now() + timezone.timedelta(minutes=30) if status == 'pending' else None,
                confirmed_at=timezone.now() if status not in ['pending', 'auto_cancelled', 'consumer_cancelled', 'farmer_declined'] else None,
                delivered_at=timezone.now() if status == 'delivered' else None,
            )
            for prod in order_products:
                qty = random.randint(1, 5)
                OrderItem.objects.create(
                    order=order,
                    product=prod,
                    product_name=prod.name,
                    unit=prod.unit,
                    price=prod.price,
                    quantity=qty,
                )
            MpesaPayment.objects.create(
                order=order,
                merchant_request_id=f'SEED{order.id}',
                checkout_request_id=f'SEED{order.id}',
                amount=total,
                phone_number=consumer.phone,
                status='completed',
                mpesa_receipt_number=f'SEED{order.id}',
            )
            if status in ['courier_assigned', 'in_transit', 'delivered']:
                rider = random.choice(riders)
                CourierAssignment.objects.create(
                    order=order,
                    rider=rider,
                    status=random.choice(['assigned', 'picked_up', 'delivered']) if status == 'delivered' else 'assigned',
                    status_link_expires=timezone.now() + timezone.timedelta(hours=6),
                )
            if status == 'delivered':
                Payout.objects.create(
                    order=order,
                    farmer=farmer,
                    amount=total * 0.85,
                    phone_number=farmer.user.phone,
                    status='completed',
                )
            if status == 'delivered' and random.random() < 0.7:
                Review.objects.create(
                    order=order,
                    consumer=consumer,
                    farmer=farmer,
                    rating=random.randint(3, 5),
                    text=random.choice(['Great quality!', 'Very fresh.', 'Will order again.', 'Excellent!', 'Loved it!'])
                )

        self.stdout.write(self.style.SUCCESS(
            f'Seeded: {len(farmers)} verified farmers, {len(consumers)} consumers, {len(products)} products, 300 orders.'
        ))
