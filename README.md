# Full-stack online shop starter

A Node.js/Express + SQLite ecommerce starter with:
- Public storefront for physical and digital products
- Cart and checkout
- Cash on Delivery for eligible physical orders
- Manual GCash/Maya payment instructions and image receipt upload
- Private admin login, branding settings, product management, stock, shipping fee and order management
- Admin receipt review and payment verification
- Private digital-file upload and gated download endpoint after payment verification
- Order lookup by order code + checkout email

## Run locally
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Set a long random `SESSION_SECRET`, a unique `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` (12+ characters).
4. Run `npm install`
5. Run `npm start`
6. Open `http://localhost:3000`

Admin login uses the email/password from `.env` on first start. Change the password in Admin → Security after signing in. Do not use the demo credentials from the earlier HTML prototype.

## Docker
Copy `.env.example` to `.env`, edit the secrets, then run `docker compose up --build -d`. Persistent SQLite data and private uploads are mounted under `./data` and `./private_uploads`.

## Before public launch — required
This is a deployable starter codebase, not a hosted/live shop. A production launch still needs:
- Hosting with persistent disk or migration to managed PostgreSQL/object storage
- HTTPS and a production session store (the default Express MemoryStore is not suitable for multi-instance/production use)
- A CSRF protection strategy and stricter content-security policy
- Email/SMS notifications and customer support contact
- Merchant-owned GCash/Maya account details entered in Admin settings
- Shipping fee rules, courier booking/tracking integration, and delivery coverage
- Privacy notice, terms, returns/refunds, and consent/retention policy
- Backups, monitoring, malware scanning for uploaded files, and tested restore process
- Review of inventory reservation/stock restoration for cancellations and payment failures

## Payment and fulfillment behavior
- GCash/Maya are manual transfers. The site displays merchant instructions, accepts an image receipt, and marks the order `For verification`. Admin must inspect the transfer in their actual wallet account and explicitly mark payment `Verified`. An uploaded receipt alone is not proof of payment.
- COD is available only when enabled and the cart contains at least one physical product.
- Shipping uses one flat fee configured by admin for any cart containing physical products. Configure this to match actual delivery costs before launch.
- Digital downloads are not automatically emailed. After manual payment is verified, the customer can request a download using the order code, email, and product ID endpoint. A customer-facing download link/email flow should be added before launch.

## File storage and security notes
Receipt and digital files are stored outside `public/` and are served only through admin-guarded or payment-verified routes. For production, use private object storage with malware scanning and expiring signed links. The sample SQLite database is suitable for a small single-instance deployment, not horizontal scaling.

## Important
Do not publish with placeholder shop identity, blank wallet details, sample products, or unreviewed legal/policy text. This project is source code; it does not automatically create a public domain or configure a payment provider.
