# SokoShamba — Project Context Handoff

**Purpose:** This file exists so that any future session (or any AI
assistant that has lost conversation context) can resume work on
SokoShamba without re-reading a long chat log. Read this file first.

**Last updated:** 2026-11-19
**Git HEAD at time of writing:** 1fbe899 (chore: ignore pycache and cron.log)

---

## 1. What SokoShamba Is

A dual-sided e-commerce and logistics platform connecting verified
Kenyan farmers directly to urban consumers, eliminating middlemen.

**Name:** Swahili — *Soko* (market) + *Shamba* (farm).
**Launch market:** Kenya (Nairobi first). Expansion: East Africa.
**Revenue model:** 15% commission on the farmer's **subtotal only**
(delivery fee passes entirely to the courier; farmers never pay
commission on delivery).

**The four core components:**
1. Marketplace — farmers list produce; consumers browse openly.
2. Integrated delivery coordination — platform owns delivery
   coordination, not the farmer. Asset-light, point-to-point.
3. Escrow payments — M-Pesa money held until delivery confirmed.
4. Trust infrastructure — hard verification, 30-min SLA with auto
   refund, public reviews, phone masking.

---

## 2. Environment (exact values matter)

| Item | Value |
|------|-------|
| OS | Debian (user: `bona`) |
| Project path | `/home/bona/sokoshamba` |
| Virtualenv | `/home/bona/sokoshamba/venv` |
| Python | 3.13.5 |
| Django | 6.0.6 |
| PostgreSQL | 17 |
| **DB port** | **5433** — NOT 5432 |
| DB name | `sokoshamba_db` |
| DB user | `sokoshamba_user` |
| DB host | `localhost` |
| psql invocation | `PGPASSWORD=$(grep DB_PASSWORD .env \| cut -d= -f2) psql -h localhost -p 5433 -U sokoshamba_user -d sokoshamba_db` |

**Why port 5433 matters:** the default 5432 was occupied/unconfigured
on this machine. Every DB command in this project must specify `-p 5433`.
This was the single most time-wasting bug of the early project.

**Secrets live in `.env`** (git-ignored). Keys include:
`SECRET_KEY`, `FIELD_ENCRYPTION_KEY`, `DB_*`, `MPESA_CONSUMER_KEY`,
`MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`,
`MPESA_ENVIRONMENT` (`sandbox`|`production`), `AT_API_KEY`,
`AT_USERNAME`, `AT_SHORTCODE`, `ADMIN_PHONE`, `NGROK_URL`.

**Never commit `.env`.** `FIELD_ENCRYPTION_KEY` loss = unreadable PII.

---

## 3. Django Apps (7)

| App | Contains |
|-----|----------|
| `accounts` | User (custom), ConsumerProfile, FarmerProfile, DeliveryAddress, OtpCode; auth views |
| `marketplace` | Category, Product, ProductImage, Cart, CartItem, PendingCheckout; browsing + farmer product CRUD |
| `orders` | Order, OrderItem, MpesaPayment, Payout, Refund; checkout, callbacks, farmer orders, earnings |
| `logistics` | Rider, CourierAssignment; courier status link |
| `reviews` | Review, OrderIssue; submit + respond |
| `notifications` | NotificationLog; `sms_service.py` (Africa's Talking) |
| `audit` | TransactionLog |

**21 database tables total.**

---

## 4. The Nine Locked Decisions

These were debated and resolved. Do NOT silently reverse them.
If a new requirement conflicts with one, raise it explicitly.

### D1 — Guest browsing depth: FULL OPEN BROWSING
Prices, farmer names, farmer profiles, reviews are all visible to
guests. No signup wall before value is proven.
*Reason:* brand pillar "Trust Through Transparency"; SEO; WhatsApp
link-sharing means a signup wall kills every shared link.
*Affects:* CR-001 … CR-008.

### D2 — Guest checkout: DEFERRED ACCOUNT CREATION
Consumer can add to cart and check out with no account. The account
is auto-created from the **M-Pesa phone number** at payment. That
number becomes the account identifier. Password optional, set later.
*Reason:* forced signup is the top cart-abandonment driver; STK Push
already requires a KYC'd phone number.
*Affects:* CR-009, CR-009b, CR-025, CR-030, CR-033, CR-033a.

### D3 — Multi-farmer carts: SINGLE-FARMER-PER-ORDER
A cart may hold many products but only from ONE farmer. Adding a
product from a different farmer is blocked with a friendly message.
*Reason:* multi-farmer orders need a consolidation hub (Twiga's
downfall) or multi-stop routing. Point-to-point keeps it asset-light.
*Affects:* CR-031 (P0, hard rule, not a warning).

### D4 — Farmer verification: HARD VERIFICATION, PHONE CALL
No listing or selling until an admin verifies. Verification is a
**phone call**, not document upload. Minimal submission: name,
verified phone, county, farm name, 1–2 photos. No ID scans at V1.
Unverified farmers are invisible to consumers.
*Reason:* financial fraud + food safety risk; trust is the premise.
*Affects:* FR-009, FR-010, FR-013, admin AR-004–AR-010.

### D5 — Order response SLA: 30 MIN, ESCALATE THEN CANCEL (Option C)
T+0 order placed, SMS to farmer.
T+15 escalation SMS ("order auto-cancels in 15 minutes").
T+30 still unconfirmed → auto-cancel, M-Pesa refund, consumer notified.
*Reason:* consumer money is held; indefinite "pending" is the worst
failure mode. 60 min felt too slow for produce; 30 min matches
kiosk/boda expectations. Escalation protects slow-but-honest farmers.
*Affects:* FR-024, FR-024a, FR-024b, CR-042, CR-045.

### D6 — Pickup coordination: HYBRID (farmer triggers, platform assigns)
Farmer presses "Request Pickup"; the platform assigns a courier.
At V1 the assignment is **manual by the ops team** — no dispatch
algorithm, no courier pool integration. The data model and status
flow are built as if automated so automation can slot in later.
*Reason:* fully automatic dispatch is premature infrastructure;
farmer-arranged pickup breaks tracking promises.
*Affects:* FR-027, FR-028, FR-028a, FR-028b, CR-047.

### D7 — Payout trigger: AUTOMATIC PER-ORDER
On delivery confirmation, the farmer's share is pushed automatically
via M-Pesa B2C. No wallet, no manual withdrawal request.
**Payout = subtotal × 0.85.** Delivery fee is NOT included in the
commission base and is NOT part of the farmer's payout.
*Reason:* "fair payment" is the farmer value proposition; instant
payout is the strongest first-sale trust signal. Batching is a
scale problem we don't have yet.
*Affects:* FR-031–FR-035, FR-034a, courier delivery handler.

### D8 — Courier system access: SMS STATUS LINK, NO LOGIN
Courier receives an SMS containing a unique, order-scoped link.
One token per order, valid through the delivery lifecycle, outer
expiry 6 hours from assignment. Each transition is idempotent
(tapping "delivered" twice is a safe no-op, checked against status).
No courier account, no courier app, no courier table of logins.
Consequence: **there is no "Courier" actor section in the SRS.**
The actor model is exactly three: Consumer, Farmer, Admin.
*Reason:* zero-training interaction; less build than even a minimal
login; avoids premature persistent courier relationships.
*Affects:* AR-014a, SYS-001, NFR-001.

### D9 — Admin permissions: TWO TIERS (Owner / Operator)
**Owner** = superuser: account suspension/reinstatement, manual
refunds, payout retries, admin account management, system config.
**Operator** = is_staff, not superuser: farmer verification, courier
assignment, order/dispute review, category/content, dashboard.
*Reason:* the guard costs a boolean plus conditional checks; the
risk (first ops hire with full refund power) is near-term.
The line is drawn where "routine operational judgment" ends and
"irreversible or financially exposed action" begins.
*Affects:* AR-041, AR-042 and gating of AR-018/019/022/031/032/033.

---

## 5. Actors (exactly three)

| Actor | How created | Notes |
|-------|-------------|-------|
| Consumer | Automatically at first successful M-Pesa payment (D2). No public signup page. | Can also be created manually in admin. Logs in via OTP only. |
| Farmer | Self-registration at /farmer/register/ (creates pending) OR admin creation. Must pass phone-call verification (D4) before listing. | Logs in via OTP. Pending farmers see a yellow banner and cannot list products. |
| Admin | Created by Owner in admin panel. | Owner = superuser. Operator = staff only (D9). |

There is no fourth actor. Couriers have no login and no profile (D8).
They exist only as Rider records the admin maintains, and interact
only through an order-scoped SMS link.

---

## 6. Requirement Counts (SRS baseline)

| Set | Count | Range |
|-----|-------|-------|
| Consumer functional | 62 | CR-001 to CR-061 plus CR-033a |
| Farmer functional | 41 | FR-001 to FR-041 |
| Admin functional | 42 | AR-001 to AR-042 |
| Functional total | 145 | (earlier notes say 144; the +1 is CR-033a) |
| Non-functional | 17 | NFR-001 to NFR-017 |
| Database tables | 21 | see section 3 |

Key P0 behaviours worth remembering:
- CR-033a: account auto-created from the paying phone number.
- CR-031: single-farmer cart is a hard rule (D3).
- FR-024a / FR-024b: T+15 escalation, T+30 auto-cancel (D5).
- AR-014a / SYS-001: SMS status link issued on courier assignment (D8).
- FR-034a: automatic payout notification on delivery (D7).

---

## 7. Order State Machine (must not drift)

Happy path:
  pending
    -> confirmed           (farmer accepts)
    -> preparing           (farmer preparing)
    -> ready_for_pickup    (farmer packed the produce)
    -> pickup_requested    (farmer pressed "Request Pickup")
    -> courier_assigned    (admin assigned a rider)
    -> in_transit          (courier tapped "Mark as Picked Up")
    -> delivered           (courier tapped "Mark as Delivered")
                           -> payout created at subtotal * 0.85

Terminal side paths:
  pending -> farmer_declined      (farmer declines)     -> refund
  pending -> consumer_cancelled   (consumer cancels)    -> refund + stock released
  pending -> auto_cancelled       (30-min SLA expires)  -> refund + stock released

Side effects that MUST fire:
- On order creation: stock decremented per item; auto_cancel_at set
  to now + 30 min; notification printed to console in sandbox
  (SMS in production) to the farmer.
- On ANY cancellation: stock released back to the farmer; refund
  record created; consumer notified with the reason.
- On delivered: Payout created at subtotal * 0.85; farmer sees it
  on the Earnings dashboard; consumer sees review + reorder buttons.

Countdown timers:
The farmer must see live time remaining, both on the order list card
and on the order detail page. Implemented in JavaScript. The list-page
version MUST be wrapped in DOMContentLoaded or it never runs (this bug
already happened once).

Status explanations:
Every farmer order status has a plain-language explanation in a pale
green box on the order detail page. All 10 statuses were verified
working. If you add a status, add its explanation too.

---

## 8. Bug Log: Infrastructure and Database

Every entry below was a real failure that cost time. Do not repeat.

### B1. PostgreSQL on port 5433
Symptom: "password authentication failed" even with trust rules and a
verified SCRAM hash. Root cause: the cluster listens on 5433, not 5432.
`pg_lsclusters` revealed it.
Rule: always `psql -p 5433`. Update .env DB_PORT=5433.

### B2. Blank emails rejected as duplicates
Symptom: "User with this Email already exists" when leaving email blank.
Root cause: email was unique=True and two blanks collide.
Fix: dropped the unique constraint; phone is the only unique identifier.

### B3. CheckConstraint used wrong keyword
Symptom: TypeError unexpected keyword argument 'check'.
Fix: Django 6 uses `condition=` not `check=`.

### B4. AbstractUser with username removed
Symptom: LookupError no 'User' model; auth failures.
Fix: custom UserManager, USERNAME_FIELD = 'phone', username = None.
Must keep create_user and create_superuser coherent.

### B5. Migration applied to the wrong model
Symptom: migration named "product_address_snapshot" when we meant
PendingCheckout; later "first_login" landed on FarmerProfile.
Cause: is_active exists on multiple models, so text replacement hit the
first match.
Rule: when patching models, anchor on a field unique to that model,
or rewrite the model file wholesale.

### B6. varchar(10) too short for reference numbers
Symptom: DataError value too long for type character varying(10).
Fix: reference_number max_length=20.

### B7. ImageField needs Pillow
Symptom: fields.E210 Cannot use ImageField because Pillow is not installed.
Fix: pip install Pillow. Also: asking for a one-off default during
migration is expected when adding a non-nullable image field to a
table with existing rows.

### B8. imghdr removed in Python 3.13
Symptom: ModuleNotFoundError No module named 'imghdr'.
Fix: validate with Pillow instead (Image.open + verify inside try/except).

### B9. Decimal times float TypeError
Symptom: unsupported operand type(s) for *: 'decimal.Decimal' and 'float'.
Location: courier delivery payout calculation.
Fix: Decimal("0.85") or Decimal(str(rate)), never a bare float.

---

## 9. Bug Log: Django and Templates

### B10. Circular import marketplace <-> orders
Symptom: ImportError cannot import name 'get_or_create_cart' from
partially initialized module.
Cause: marketplace/views.py imported from orders/views.py and vice versa.
Fix: define get_verified_farmer (and now get_farmer) locally in
marketplace/views.py instead of importing across apps.

### B11. Duplicate view definitions silently shadowing
Symptom: image upload "worked" in code but no ProductImage was ever
created. Cause: farmer_product_add was defined TWICE in the same file;
the second definition (without image handling) won because Python
keeps the last one.
Rule: after any large paste, `grep -n "^def " file.py` and look for
duplicates. If you see the same name twice, rewrite the file.

### B12. render() returning None / UnboundLocalError on next_url
Symptom: "view didn't return an HttpResponse" and then
"cannot access local variable 'next_url'".
Cause: variable assigned only inside the POST branch but referenced
on GET; plus a misplaced line inside an except block.
Fix: full rewrite of accounts/views.py. This is when the two-patch
rule was adopted (see working rules).

### B13. login_required sends users to /accounts/login/ (404)
Symptom: Page not found at /accounts/login/?next=/orders/.
Cause: Django's default LOGIN_URL is /accounts/login/.
Fix: LOGIN_URL = '/login/' in settings.

### B14. NoReverseMatch for 'login'
Symptom: Reverse for 'login' not found.
Cause: redirect('login') but the URL name is 'login_request'.
Fix: use the actual name. Verify with: grep "name=" accounts/urls.py

### B15. The 'next' parameter was ignored after OTP login
Symptom: after paying, consumer lands on login, logs in, and is dumped
on the homepage instead of their order.
Fix: save next in request.session['login_next'] during login_request,
pop and redirect to it after successful OTP verification.

### B16. Inline python -c patches mangle files repeatedly
Symptoms seen: unterminated f-string literals, IndentationError,
misplaced lines inside except blocks, broken triple-quoted strings,
"bash: ! event not found" from history expansion.
Rule: stop using long inline `python3 -c` for anything with quotes,
emojis, arrows, or template syntax. Write a script to /tmp/*.py with a
quoted heredoc, then run it. Or rewrite the whole file.

### B17. New template tag library not found until restart
Symptom: TemplateSyntaxError Invalid filter / not a registered tag
library, even though the file exists.
Cause: Django only discovers tag libraries at startup.
Fix: restart `runserver`. No other change needed.

### B18. Forgot {% load phone_format %} in a template
Symptom: Invalid filter 'mask_phone' or 'display_ref' or 'local_phone'.
Fix: the load tag must come AFTER {% extends %} and BEFORE use.
Checklist of templates that use these filters: order_list,
order_detail, farmer_order_list, farmer_order_detail,
farmer_earnings, courier_status, home, otp_verify,
product_detail, respond_to_review.

### B19. Wrong tag order breaks the whole page
Symptom: "{% extends %} must be the first tag".
Cause: a load tag was placed above extends.
Fix: extends first line, then load tags, then content.

---

## 10. Bug Log: Integrations and UI

### B20. Daraja returned "Invalid Access Token" with a valid token
Cause: the Daraja app had only the "M-Pesa Sandbox" API, not
"M-Pesa Express" (STK Push). The token itself was fine.
Fix: in the Daraja portal, open the app, APIs tab, Add API,
select M-Pesa Express, save. Then retry.

### B21. Real M-Pesa callback has no browser session
Symptom: callback returned "Cart empty" because it could not find the
guest cart or the pending phone number.
Cause: Safaricom calls the webhook server-to-server. No cookies.
Fix: PendingCheckout model keyed on checkout_request_id, storing
phone, cart_id, total and address_snapshot. The callback looks up that
row instead of the session. This is essential architecture, not a patch.

### B22. ngrok free tier returns 404 on the webhook
Symptom: POST to the ngrok URL returns a Werkzeug 404 even though the
same POST works on 127.0.0.1 and 0.0.0.0. Tried the
ngrok-skip-browser-warning header; still 404.
Workaround used for testing: trigger the callback manually with curl
against the local URL, using the checkout_request_id from the DB.
Status: unresolved. Production must use a real domain over HTTPS.
Do not burn time on ngrok again.

### B23. Fake 5-second success screen
Symptom: checkout showed "Order Placed" before the consumer had
entered their M-Pesa PIN.
Cause: a setTimeout placeholder from early development.
Fix: polling. Browser polls /checkout/check/ every second, which
reports success, failure, or not-yet. The success UI only appears
when the server confirms.

### B24. Africa's Talking sandbox never delivers to real phones
The API returns success with a messageId and status 101, but nothing
reaches a handset. The sandbox only shows messages in their web
simulator. This is NOT a bug in our code.
Consequence: sandbox mode prints OTPs to the console instead. The
environment check is: if MPESA_ENVIRONMENT == 'sandbox', print;
else send real SMS. Production needs live credentials and an approved
sender ID.

### B25. Cart total dropped the delivery fee on quantity change
Symptom: changing qty made the total equal the subtotal; reload fixed it.
Cause: recalcCart() set the total to the subtotal only.
Fix: total = subtotal + 150. Also fixed the stale server-side quantity
bug: the cart page was sending item.id to /cart/add/ which expects
product_id. Added an item_id path in add_to_cart, so the cart now
updates the existing line directly.

### B26. Last cart item could not be removed
Symptom: Remove worked until one item was left, then stopped.
Cause: the page reloaded before the server delete completed.
Fix: fetch first, then remove the DOM node, then reload if zero remain.

### B27. Pagination inserted inside the product grid
Symptom: pagination buttons appeared inside each product card; layout
shattered. Happened TWICE.
Fix: full rewrite of product_list.html. The pagination bar must sit
AFTER the closing grid div, not inside it.
Pattern that works (reuse it verbatim): a centered inline-flex pill
with a white background, box-shadow, left chevron, "Page X of Y",
right chevron. Same pattern used on product_list, farmer_products,
farmer_public_profile.

### B28. Fixed 2-column grid broke on mobile
Symptom: horizontal scrolling on phones.
Fix: display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
Use this everywhere products are shown in a grid.

### B29. Responsive photos leaking background
Symptom: pale green bars visible beside product images.
Fix: object-fit: cover on card images; adjust the container so the
image fills it.

### B30. Browser alert() and prompt() in the UI
Symptom: unprofessional popups for add-to-cart and review actions.
Fix: replaced with a toast notification (fade in, auto-dismiss) and
inline forms (e.g., the cancel-order confirmation box). The toast must
also be visibility:hidden when not shown, otherwise its text is
selectable and appears in copied page text.

### B31. Consumer saw a high order number on their first purchase
Symptom: "Order #35" on a first order.
Fix: two-tier references.
- Stored: reference_number = SK-C{consumer_id}-{sequence}
- Consumers see: SK-0001, SK-0002 (per-consumer, via display_ref filter)
- Farmers/riders see: SK-{order.id} (global, unique, auditable)
- Auditors use the raw database id, not any SK string.

### B32. Reviews shown on the wrong product
Symptom: a new product displayed reviews belonging to another product
from the same farmer.
Fix: filter reviews by order__items__product=product, then .distinct().
Farmer reputation can still be aggregated separately if wanted.

### B33. New farmer hit "Access denied" after OTP
Cause: farmer_order_list used get_verified_farmer, so pending farmers
were rejected.
Fix: two helpers.
- get_farmer(user): returns the profile for any farmer role.
- get_verified_farmer(user): returns it only if verified and active.
Read-only pages (order list, product list) use get_farmer so pending
farmers can log in and see the banner. All write/act pages use
get_verified_farmer.
Import note: both helpers live in accounts/views.py, but
marketplace/views.py and orders/views.py each needed their own import
line added; forgetting one produces "name 'get_farmer' is not defined".

### B34. Pending verification banner not appearing
Cause: the banner block was never actually inserted, and later the
wrong <h1> string was matched.
Fix: anchor on the exact heading markup present in the file. Verify
with grep after inserting. Banner appears on farmer orders AND farmer
products pages.

### B35. local_phone produced 0771 234 5678
Cause: wrong slice on the 9-digit remainder.
Fix: for +254712345678 -> digits = 712345678 -> output
"07" + digits[1:3] + " " + digits[3:6] + " " + digits[6:]
i.e. 0712 345 678.

### B36. Farmer console notification inserted in the wrong function
Symptom: IndentationError in initiate_payment; the print landed there
instead of mpesa_callback.
Fix: locate the exact success return inside mpesa_callback (the one
containing order_id: order.id, around line 250) and insert immediately
before it. Notification format:
>>> NEW ORDER {reference_number} for farmer {phone}

---

## 11. Deliberate Deferrals (DO NOT "FIX" THESE)

These are conscious decisions, not oversights. If you are tempted to
implement one, ask first.

### Deferred to production / credentials
- **Real SMS delivery.** Code is written and environment-gated.
  Sandbox prints to console by design. Needs live Africa's Talking
  credentials and an approved sender ID.
- **B2C payout with real money.** Function b2c_payout exists in
  orders/mpesa_service.py. In sandbox it simulates success. Production
  needs the security credential generated from Safaricom's certificate.
- **Real STK Push end-to-end.** Sandbox works when the callback is
  delivered. ngrok is unreliable (B22). Production uses a real domain.
- **HTTPS, DEBUG=False, ALLOWED_HOSTS.** Production settings only.

### Deferred by the founder's choice
- **Rider payouts are manual.** The founder wants to confirm the
  delivery actually happened before releasing the rider's fee.
  Do not automate rider payment.
- **Order dispatch is manual.** Admin assigns couriers by hand (D6).
  Do not build an algorithmic dispatcher.
- **Farmer verification is a phone call.** No self-serve document
  upload, no automated KYC.

### Deferred as post-launch enhancements
- **Dynamic delivery ETA.** Currently a static "Estimated delivery:
  2-4 hours" shown on all non-terminal statuses (pending, confirmed,
  preparing, ready_for_pickup, pickup_requested, courier_assigned,
  in_transit). Hidden for delivered and all cancelled states.
  A dynamic ETA needs real delivery-time data.
- **Rider availability tracking.** No "available" toggle, no live
  rider status. Admin calls to confirm before assigning.
- **Multi-farmer cart.** Blocked by design (D3).
- **In-app messaging / chat.** Not built. Contact happens via support.
- **Pre-purchase consumer signup.** Consumers are created only at
  checkout (D2). No "save my address" account without buying.
- **Password login for consumers.** OTP only. Farmers have passwords
  in the DB but the login form is OTP-only for everyone.

---

## 12. Known Limitations (honest list)

1. **Cold start.** Two-sided marketplace; needs density in a small
   area before it is useful.
2. **Perishability disputes.** No formal quality-dispute policy yet;
   OrderIssue model exists but the resolution flow is admin-manual.
3. **Third-party dependence.** Daraja outage = no payments; Africa's
   Talking outage = no OTP login. No fallback provider.
4. **Single server.** No load balancing or failover at V1.
5. **No monitoring or alerting.** Uptime check is planned, not built.
6. **Manual ops bottleneck.** Verification, dispatch and rider payment
   all depend on the founder's time.
7. **Seed data still in the local DB.** 18 seeded farmers, ~200
   products, ~300 orders. Must be purged before any real launch.
8. **Stock race condition.** available_quantity is decremented on
   order creation but without row-level locking; two simultaneous
   orders for the last unit could both succeed. Fix with
   select_for_update or an atomic UPDATE ... WHERE quantity >= X.

---

## 13. Deployment Checklist (not yet done)

Nothing below has been executed yet. This is the remaining path to live.

### Money required (KES)
- First month: about 3,300 (server 1,300 + domain 1,500 + SMS top-up 500)
- First year: about 19,100
- Free tiers cover: managed PostgreSQL (Supabase), object storage
  (Cloudflare R2, 10 GB), SSL (Let's Encrypt), Daraja API,
  UptimeRobot monitoring.

### Infrastructure steps
1. Provision a cloud server (DigitalOcean 1 GB droplet or similar),
   Ubuntu LTS.
2. Register a domain (.co.ke) and point DNS at the server.
3. Dockerise: Dockerfile, docker-compose.yml, nginx.conf,
   entrypoint.sh (migrations then Gunicorn), .env.production.
   Services: Django+Gunicorn, PostgreSQL, Nginx, cron.
4. Object storage: connect django-storages to R2 or B2 for media.
5. HTTPS via Certbot.
6. Set DEBUG=False, ALLOWED_HOSTS to the domain, fresh SECRET_KEY.
7. Point the Daraja app's callback URL at
   https://<domain>/webhooks/mpesa/callback/
8. Switch MPESA_ENVIRONMENT to production and load live credentials.
9. Load live Africa's Talking credentials and approved sender ID.
10. Verify the cron job for process_auto_cancel runs every minute
    inside the container.
11. Purge all seed data.
12. Create the real Owner account. Do not ship with the dev superuser.

### Must verify before announcing
- One real STK Push, paid with real money, order created by callback.
- One real OTP SMS arriving on a handset.
- One real B2C payout landing in a farmer's M-Pesa.
- One courier SMS with a working status link.
- /health endpoint returns 200 and is monitored.

---

## 14. Proposal Document Gaps (academic, separate from code)

The updated proposal PDF was reviewed. Remaining compliance gaps
against the department guidelines:
1. Contents page (required, on its own page).
2. Gantt chart / timeline appendix (required, one-year breakdown).
3. Budget appendix (required).
4. Two citation brackets in section 1.1: employment share, and the
   share of online food sales.
5. Sections 3.5 and 3.6 are swapped relative to the guideline order
   (guideline: 3.5 Ethical, 3.6 Expected Outcomes).
6. Missing reference years in a few APA entries (AgFunder Taimba,
   Safaricom Daraja docs, both Techpoint entries).
7. Fill in registration number and supervisor name(s) on the cover.
8. Placeholders for architecture/schema and wireframes appendices.

---

## 15. Working Rules (how to collaborate on this project)

These emerged from real friction. Follow them.

### The two-patch rule
If a change needs more than two patches, STOP and rewrite the whole
file. Patch-on-patch produces indentation errors, duplicate functions,
and broken templates. Full rewrites are faster and safer.

### Plan before code
For any non-trivial change, present a short high-level plan first and
wait for approval. Do not jump straight to implementation.

### No long inline python -c
Use a quoted heredoc to write /tmp/something.py, then run it.
Long inline commands with quotes, emojis or template syntax break
(bash history expansion, unterminated strings, mangled indentation).

### ASCII only in heredocs pasted into the terminal
Box-drawing characters, arrows and smart quotes can corrupt a paste
and swallow the EOF terminator. Use plain ASCII.

### One step at a time
Give a single command, wait for the user's output, then continue.
Never bundle a confirmation with the next question.
Never assume a check passed; read the actual output.

### The repository is the source of truth
Not this chat. If recall and repo disagree, read the repo.
After any code change: python3 manage.py check, then the relevant
grep to confirm the edit landed.

### Verify inserts
After any string replacement on a template or model, grep for the
new text. Silent no-op replacements have burned us repeatedly
(banner not inserted, notification in the wrong function, style
attribute duplicated).

### Restart for template tag libraries
New files under templatetags/ require a runserver restart.

---

## 16. How to Use This File

At the start of a new session: read CONTEXT.md completely, then run
`git log --oneline -5` and `python3 manage.py check` to confirm the
code still matches this description. If anything in the repo
contradicts this file, trust the repo and update this file.

