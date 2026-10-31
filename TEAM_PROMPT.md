# Team prompt

Self-contained: it carries the full requirements, the contract and the work split, so teammates need no other file. Paste the block below into your AI coding assistant and change only the first line to your person number.

````text
I am Person [1 / 2 / 3 / 4] on a four-person team building a Subscription Management System. Each of us builds one vertical slice (database, API, UI) independently, and we integrate at the end. Work only inside my slice. Everything below is the complete requirement set: build all of it, and add nothing beyond it.

=====================================================
1. WHAT WE ARE BUILDING
=====================================================
One platform that runs the full life of a subscription business: setting up products and plans, quotations and subscriptions, invoices, payments and revenue reporting. The example company is Brightloop Software. It sells business software billed monthly or yearly, add-ons customers switch on and off, and products with variants. Customers range from small shops on monthly plans to large companies on yearly contracts.

Today the company tracks subscriptions in a spreadsheet, remembers renewals by chance, types invoices by hand, matches payments by scrolling bank statements, and builds revenue reports manually. Renewals get missed and invoices go out wrong. The system replaces all of that.

Roles:
- ADMIN: controls the whole system. Sets up products, plans, taxes and discounts. The only role that can add staff.
- STAFF: internal team, day-to-day work with limited access.
- CUSTOMER: uses a portal; sees and manages only their own subscriptions and invoices.

Performance: every page must respond in under 2 seconds with thousands of subscriptions. Index foreign keys and filtered columns, and paginate every list.

=====================================================
2. REQUIREMENTS (the problem statement)
=====================================================
R1  Signup with email and password. Each email belongs to one account.
R2  Password must be more than eight characters, with an uppercase letter, a lowercase letter and a special character.
R3  Forgotten password: a reset link arrives at the registered email.
R4  Admin controls the whole system; staff have limited access; customers see only their own subscriptions and invoices through a portal.
R5  Only the admin can add a new staff member.
R6  Product (added by admin): name, type, sales price, cost price, notes.
R7  Products come in variants, for example by brand; choosing the Odoo brand adds 560 to the price.
R8  Plan: price, billing period (daily, weekly, monthly or yearly), minimum quantity, dates it is available.
R9  Per plan, the admin decides whether it closes on its own at its end, and whether it can be closed early, paused or renewed.
R10 Quotation templates hold a plan and product lines and stay valid for a set number of days; a sales rep starts a quote from one.
R11 Subscription: its own number, customer, plan, start date, expiry date, payment terms, and lines (product, quantity, unit price, taxes, amount).
R12 Subscription status moves Draft, Quotation, Confirmed, Active, Closed, and anyone on the team can see where it stands.
R13 Invoices are created from subscriptions with customer details, product lines, taxes and totals already filled in. Nobody types them by hand, even with hundreds due at once.
R14 Taxes are calculated automatically from rules the admin sets.
R15 The team can confirm, cancel, send or print any invoice. Invoice status moves Draft, Confirmed, Paid.
R16 Nothing is billed twice or skipped.
R17 Discount rules, created by the admin only: fixed amount or percentage, minimum purchase or quantity, start and end dates, a limit on how many times it can be used.
R18 A discount can apply to specific products or to whole subscriptions.
R19 Once a discount applies, it appears on the next invoice on its own and stops when it expires or runs out.
R20 Record each payment with method, amount, date and a note, against the right invoice.
R21 At any moment the team can see which invoices are paid and which are outstanding, so overdue ones can be chased.
R22 The finance lead gets one place to see active subscriptions, revenue, payments and overdue invoices, with filters and a summary view.
R23 Every page responds in under two seconds with thousands of subscriptions.

=====================================================
3. STACK
=====================================================
Next.js (App Router, TypeScript, Tailwind/shadcn) in /frontend. Node.js, Express, TypeScript in /backend. PostgreSQL with Prisma.

=====================================================
4. CONTRACT (frozen after the first sync; announce any change to the team)
=====================================================
- Code lives in backend/src/modules/<area>/, frontend/app/<area>/, frontend/components/<area>/. Shared helpers live in backend/src/shared/. Edit only my own folders. Areas: auth (P1), catalog (P2), billing (P3), payments (P4).
- One common schema is committed at backend/prisma/schema.prisma, with every model, enum, relation and index already defined. Pull it before starting and read it fully. Each section has an owner; only the owner edits their section, and a change you need in someone else's section goes through them. During development run `npx prisma db push` against your own local database. P1 generates the single migration at integration.
- Table ownership:
  - P1: User (also holds customer details: name, company, phone, billing address).
  - P2: Product, ProductVariant, Plan, QuotationTemplate(+Line), Subscription(+Line).
  - P3: Tax, Discount, DiscountTarget, DiscountUsage, Invoice(+Line).
  - P4: Payment.
- Enums: Role (ADMIN, STAFF, CUSTOMER) · BillingPeriod (DAILY, WEEKLY, MONTHLY, YEARLY) · SubscriptionStatus (DRAFT, QUOTATION, CONFIRMED, ACTIVE, CLOSED) · InvoiceStatus (DRAFT, CONFIRMED, PAID, CANCELLED) · PaymentMethod (CASH, CARD, BANK_TRANSFER, UPI, OTHER) · PaymentTerms (IMMEDIATE, NET_15, NET_30) · DiscountType (FIXED, PERCENTAGE) · DiscountScope (PRODUCT, SUBSCRIPTION).
- UUID ids, Decimal(12,2) money, paths /api/<area>/..., responses { data, error }, lists take ?page=&limit= plus filters.
- Shared helpers, published by their owner within the first hour and stubbed until then so nobody waits:
  - P1: shared/auth.ts with requireAuth and requireRole(...) (stub reads headers x-dev-user-id and x-dev-role; signatures never change). shared/mailer.ts with sendMail({ to, subject, html, attachments? }) via Nodemailer, SMTP settings in .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, APP_URL), Mailtrap or Ethereal in development, console-logging stub. shared/scheduler.ts with registerDailyJob(name, fn). The full role-based menu with every route listed. A useCurrentUser() hook on the frontend, hard-coded until login is wired in.
  - P3: shared/pricing.ts with calculateLine({ quantity, unitPrice, taxRate }). P2 uses it for subscription line amounts. Invoice lines copy the subscription line's unit price as a snapshot.
- Pickers (customer, product, plan, subscription, tax, invoice) use read-only lookups returning [{ id, label }]: P1 GET /api/lookups/customers · P2 GET /api/lookups/products, /plans, /subscriptions · P3 GET /api/lookups/taxes, /invoices. Mock them until they exist. Never call another person's other endpoints.
- Direct database reads: P3 reads Subscription, SubscriptionLine, Plan, Product and User to create invoices. P4 reads Invoice, Subscription and User for lists and the dashboard, and writes only Invoice.amountPaid and Invoice.status when a payment is recorded.
- Volume: I ship seed:<my area> inserting at least 5,000 rows for my tables, and confirm my own pages load in under 2 seconds.

=====================================================
5. ASSUMPTIONS (the statement is silent; change only by team agreement)
=====================================================
- Admin does products, plans, quotation templates, taxes, discounts and adding staff. Staff handle customers, subscriptions, invoices (confirm, cancel, send, print), payments and the dashboard. Customers see only their own data. There is no separate finance-lead role; admin and staff can open the dashboard.
- Pause is a flag on the subscription, not a status. Renew extends the expiry date by the original term. Each plan has admin-set flags autoClose, allowEarlyClose, allowPause, allowRenew, and a customer or staff action is allowed only if the plan permits it.
- Payment terms set the invoice due date. Overdue means due date passed and not fully paid.
- Revenue is payments received. Still owed is invoice totals minus amountPaid on confirmed invoices.
- A PRODUCT discount applies to lines of the listed products. A SUBSCRIPTION discount applies to the subscription total, for the listed subscriptions or all if none are listed. All valid matching discounts apply, each as its own invoice line. One use is counted per invoice, incremented atomically inside the invoice transaction.
- A payment cannot exceed the amount owed or target a cancelled invoice. A partial payment raises amountPaid and leaves the invoice Confirmed. A payment that covers the total makes it PAID.
- Billing creates Draft invoices for ACTIVE, non-paused subscriptions, stops after expiry, catches up on missed periods, and is idempotent through a unique key on subscription + period start. Invoice numbers are unique and sequential. Print is a PDF.

=====================================================
6. THE FOUR SLICES
=====================================================
P1: Auth, users, roles (R1-R5)
- Signup: unique email (case-insensitive); password longer than 8 characters with an uppercase letter, a lowercase letter and a special character; always creates a CUSTOMER.
- Login and logout with JWT; real requireAuth/requireRole behind the stub's signatures.
- Password reset: POST forgot-password always returns the same message. If the account exists, store a hash of a random token (1-hour expiry) and email APP_URL/reset-password?token=... through sendMail. POST reset-password validates the token and the password rules, saves the new password, and invalidates the token. Include both pages.
- Admin-only screen to add staff; nobody else can create staff. Staff screens to list, create and edit customers.
- App shell, role-based menu, customer portal home that hosts the other people's customer pages.
- Publish the shared helpers and the menu in the first hour.

P2: Catalog and subscriptions (R6-R12)
- Products (name, type, sales price, cost price, notes) and variants (for example brand: Odoo adds 560).
- Plans (price, billing period, minimum quantity, available dates, the four action flags).
- Quotation templates (plan and product lines, valid for a set number of days); admin creates, staff starts a subscription from one.
- Subscriptions (own number, customer, plan, start and expiry dates, payment terms, lines with product, quantity, unit price, taxes, amount) with the status flow Draft, Quotation, Confirmed, Active, Closed enforced server-side and visible to the team.
- Close early, pause, resume and renew where the plan allows; a daily job auto-closes expired subscriptions for plans that auto-close.
- Customer "My subscriptions" page offering the actions their plan allows.
- Publish the product, plan and subscription lookups in the first hour.

P3: Billing, taxes, discounts (R13-R19)
- Tax rules (name, rate, active) set by the admin and applied automatically.
- Invoices generated from subscriptions with customer details, lines, taxes and totals pre-filled, by a daily job and an admin "run billing now" button. Hundreds at once; never twice, never skipped.
- Discount rules (admin only): fixed or percentage, minimum purchase or quantity, start and end dates, usage limit, per product or whole subscription. They appear on the next invoice automatically and stop when expired or used up.
- Invoice flow Draft, Confirmed, Paid; staff can confirm, cancel, send (email via sendMail) and print (PDF) any invoice.
- Customer "My invoices" page, with print.
- Publish pricing.ts and the tax and invoice lookups in the first hour.

P4: Payments and reporting (R20-R23)
- Record a payment against the right invoice (method, amount, date, note) under the payment rules.
- Show paid versus outstanding invoices at any moment, with overdue ones highlighted and days overdue.
- One finance dashboard: active subscriptions, revenue, payments, amount still owed and overdue invoices, with filters and a summary view.
- Customer "My payments" page.
- Own the cross-app performance check; seed:all combines every seed script into thousands of subscriptions, invoices and payments.

=====================================================
7. INTEGRATION (all four, at the end)
=====================================================
1. Generate the single migration from the common schema and apply it to the shared database.
2. Mount all route modules, replace the auth stub with real JWT, register both daily jobs (auto-close and billing).
3. Replace the hard-coded frontend user with real login and check the menu per role.
4. Run seed:all, then walk one billing month: sign up, set up product and plan, create and activate a subscription, apply a discount, run billing, send an invoice, record payments, check the dashboard.
5. Measure every page under 2 seconds with the seeded data.
6. Go through R1-R23 and confirm each one works.

=====================================================
8. HOW I WANT YOU TO WORK
=====================================================
1. Read the repo, report what already exists, propose a short plan for my slice, and wait for my approval.
2. Build the backend (models, routes, validation, role checks) and the frontend pages for my slice, with seed data so I can test it alone.
3. Match the existing code style and keep it simple. Add nothing beyond the requirements above.
4. Do not edit files outside my slice. If something outside is needed, tell me instead of changing it.
5. After each feature, say how to test it and which of R1-R23 it covers.
````
