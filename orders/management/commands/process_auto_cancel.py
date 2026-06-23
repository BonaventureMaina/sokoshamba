from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from orders.models import Order, MpesaPayment, Refund


class Command(BaseCommand):
    help = 'Escalate at T+15 and auto-cancel orders that exceed the 30‑minute SLA'

    def handle(self, *args, **options):
        now = timezone.now()
        # Fetch all pending orders with a defined auto_cancel_at that is in the past
        pending_orders = Order.objects.filter(
            status='pending',
            auto_cancel_at__isnull=False,
            auto_cancel_at__lte=now
        ).select_related('farmer', 'consumer')

        for order in pending_orders:
            with transaction.atomic():
                # Lock the order row to prevent concurrent processing
                order = Order.objects.select_for_update().get(pk=order.pk)
                if order.status != 'pending':
                    # Already handled (e.g., farmer accepted in the last millisecond)
                    continue

                # Calculate the escalation time (T+15)
                escalation_deadline = order.created_at + timedelta(minutes=15)

                if now >= escalation_deadline and not order.escalation_sent:
                    # Send escalation (simulate – in production this would call Africa's Talking)
                    order.escalation_sent = True
                    order.save(update_fields=['escalation_sent'])
                    self.stdout.write(self.style.WARNING(
                        f'ESCALATION sent for Order {order.id} (T+15)'
                    ))
                    # Do not cancel yet – let the cron run again at T+30
                    continue

                # If we've reached T+30, auto-cancel the order
                if now >= order.auto_cancel_at:
                    order.status = 'auto_cancelled'
                    order.save(update_fields=['status'])

                    # Find the successful payment to refund
                    payment = order.mpesa_payments.filter(status='completed').first()
                    if payment:
                        # Create a refund record (simulated as completed)
                        Refund.objects.create(
                            order=order,
                            payment=payment,
                            amount=order.total,
                            status='completed'
                        )
                        payment.status = 'failed'  # mark original payment as void
                        payment.save(update_fields=['status'])

                    self.stdout.write(self.style.ERROR(
                        f'AUTO-CANCELLED Order {order.id} (T+30) – refund simulated'
                    ))

        self.stdout.write(self.style.SUCCESS('Auto-cancel sweep completed'))
