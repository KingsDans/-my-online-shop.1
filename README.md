# Considered Goods — Luxury Editorial Online Shop

A responsive, luxury-editorial storefront built with Node.js, Express, SQLite and a private admin area. The visual refresh uses warm ivory, stone, charcoal and muted taupe, with refined serif display typography and clean sans-serif interface text. Typography uses system font stacks, so the design does not depend on an external font service.

## Included store features

- Public storefront for physical and digital products
- Responsive editorial homepage, product collection, category filters and product search
- Shopping bag and checkout
- Cash on Delivery for eligible physical orders when enabled
- Manual GCash and Maya payment instructions with image receipt upload
- Private admin login and password change
- Editable store name, tagline, hero image URL, contact email, shipping fee and COD setting
- Product creation, stock fields, hide/unhide via active status, and private digital-file upload
- Order list, receipt review, manual payment verification and fulfilment status updates
- Customer order lookup using order code and checkout email
- `/health` endpoint for deployment checks

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and set unique secrets.
3. For local use, set `DATA_DIR=./persist` (or remove the variable to use the app directory).
4. Run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

The first successful start creates the admin account using `ADMIN_EMAIL` and `ADMIN_PASSWORD`. If the database already contains an admin, changing those environment variables will not reset the existing account; use Admin → Security to change the password.

## Railway deployment — important

This project expects the Railway Volume to be mounted at `/app/persist` and the service variable `DATA_DIR` to be set to `/app/persist`.

1. Keep the GitHub repository **Private**.
2. Upload the contents of this project folder to the repository root, preserving the `public/` directory.
3. Connect the private GitHub repository to Railway.
4. Attach a Railway Volume to the web service with mount path `/app/persist`.
5. Add these Railway variables:
   - `NODE_ENV=production`
   - `DATA_DIR=/app/persist`
   - `ADMIN_EMAIL=your private admin email`
   - `ADMIN_PASSWORD=a unique password of at least 16 characters`
   - `SESSION_SECRET=a separate random secret of at least 32 characters`
6. Deploy and check that the service is Online.
7. Generate a public domain in service Settings → Networking.
8. Test `https://YOUR-DOMAIN/health` and confirm it returns `{"ok":true}`.
9. Sign in at `https://YOUR-DOMAIN/` using the admin email/password configured on the first database initialization. The admin button is in the site header.
10. Test with sample products and test customer information. Redeploy and verify products, orders, sessions and uploads persist.

Do not set `DATA_DIR` to a path that is not the attached Volume mount. Without a mounted persistent volume, the database and private uploads can be lost when the service is recreated.

## Payment and fulfilment behavior

- GCash and Maya are manual wallet transfers. The storefront displays the merchant's instructions, accepts an image receipt, and marks the order `For verification`.
- The store owner must independently verify the transfer in their actual GCash/Maya wallet and then mark payment as `Verified` in the admin area. An uploaded receipt is not proof of payment.
- COD is available only when enabled and the order includes a physical product.
- Shipping is a single flat fee for any order containing a physical item. Set the fee to match actual delivery costs before accepting orders.
- Digital product files are uploaded privately. The current customer delivery flow is limited: the backend download route requires a verified order, order code, checkout email and product ID. It is not yet an automated customer download page or email delivery system.

## Before accepting real orders

This is an upgraded deployable starter, not a fully audited production commerce platform. Before collecting real customer data or payments, complete and test:

- CSRF protection and a full security review of every write endpoint
- Production session configuration, secure cookie behavior and login/session testing
- File content inspection and malware scanning for receipt and digital uploads
- Backup and restore procedures for the SQLite database and private upload volume
- Privacy notice, terms, returns/refunds, customer support and data-retention policies
- Customer email notifications and a user-friendly protected digital-download delivery flow
- Shipping coverage/rules and courier fulfilment process
- Inventory restoration/adjustment for cancelled or rejected orders
- A real end-to-end checkout test using test data only

Keep a single application replica while using SQLite on one Railway Volume. Do not scale horizontally with this database design. Do not commit `.env`, real customer receipts, digital product files, wallet credentials, OTPs or PINs to GitHub. Keep the repository private.

## Project structure

```text
.
├── server.js
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```
