# YouPI-PG Payment Gateway & PhonePe UPI Integration Guide

## 1. Overview & Architecture

This project integrates the sovereign, self-hosted **YouPI-PG (V2)** Payment Gateway alongside direct PhonePe UPI QR settlement for student library pass memberships and subscriptions.

### Architectural Flow:

```text
  +---------------------------------------------------------------------------------+
  | Student Browser (Mobile / Desktop)                                              |
  | 1. Selects Study Pass (Monthly Standard, Dedicated Seat, Quarterly)             |
  | 2. Backend generates unique Order Reference (LIB-ORD-...)                       |
  | 3. Displays Merchant PhonePe QR (qr/QR.jpeg) with amount & instructions         |
  | 4. Student scans with PhonePe/GPay/Paytm and submits 12-digit UTR reference     |
  +---------------------------------------+-----------------------------------------+
                                          |
                      +-------------------+-------------------+
                      |                                       |
                      v                                       v
         [Local Backend Database]               [YouPI-PG Gateway & Observers]
         - Order status: PENDING                - Android APK / Gmail Observer
         - In-App Admin Notification            - Detects incoming bank credit SMS/Push
                      |                                       |
                      +-------------------+-------------------+
                                          |
                                          v
                      [Authoritative Verification]
                      - Gateway delivers HMAC-SHA256 Signed Webhook to /api/payments/webhook
                      - Or Admin manually approves via /admin/payments ledger
                      - Or Student status-poll queries /api/payments/status/:orderId
                                          |
                                          v
                      [Idempotent Subscription Activation]
                      - Order marked SUCCESS
                      - User membershipStatus: ACTIVE
                      - membershipExpiresAt extended safely (no double grants)
                      - Real-time in-app confirmation notification sent to student
```

---

## 2. Integrated Components & APIs

### Backend Endpoints (`/api/payments`)

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/payments/plans` | Public | Returns available student membership passes |
| `GET` | `/api/payments/qr-image` | Public | Serves the authentic `qr/QR.jpeg` image securely |
| `POST` | `/api/payments/webhook` | Gateway (Public) | Authoritative HMAC-SHA256 signed webhook listener from YouPI-PG |
| `GET` | `/api/payments/my-payments` | Student | Returns logged-in student's active pass & payment history |
| `POST` | `/api/payments/create-order` | Student | Registers a payment order with duplicate prevention |
| `POST` | `/api/payments/submit-utr` | Student | Submits 12-digit UPI reference after scanning the QR |
| `GET` | `/api/payments/status/:orderId`| Authenticated | Queries transaction status (local DB + gateway observer) |
| `GET` | `/api/payments/admin/all` | Admin | Paginated payment ledger with status filters & search |
| `POST` | `/api/payments/admin/verify/:orderId` | Admin | Manual admin approval/rejection for bank reconciliation |

---

## 3. QR Image Configuration

The user's authentic PhonePe merchant QR image is located at:
- File path: `qr/QR.jpeg` (also available as `QR.jpeg` at workspace root).
- Served at: `GET /api/payments/qr-image` or `GET /qr/QR.jpeg`.
- **Integrity Guarantee**: The original QR is served byte-for-byte without regeneration, manipulation, or fake mock QR replacement.
- **QR Nature**: This is a **static PhonePe UPI QR code** registered to merchant **Kunal Kumar**. Because static QRs do not embed unique order IDs into the QR code itself, transactions are identified by:
  1. The exact payment amount (e.g., ₹600.00, ₹1000.00, ₹2700.00).
  2. The 12-digit bank reference number (UTR) submitted by the student.
  3. Real-time bank notification observation parsed by YouPI-PG.

---

## 4. Environment Variables Configuration

Add the following variables to `backend/.env`:

```env
# YouPI-PG Gateway Integration Configuration
YOUPI_API_URL=http://127.0.0.1:6100
YOUPI_MERCHANT_ID=00000000-0000-0000-0000-000000000001
YOUPI_WEBHOOK_SECRET=your_youpi_webhook_secret_here
YOUPI_API_KEY=your_optional_merchant_api_key
```

### Variable Details:
- `YOUPI_API_URL`: The base URL where YouPI-PG's Payment API is running (default `http://127.0.0.1:6100` for local or `https://pay.yourdomain.com` for production).
- `YOUPI_MERCHANT_ID`: The merchant UUID assigned in the YouPI-PG Admin Panel.
- `YOUPI_WEBHOOK_SECRET`: The shared cryptographic secret used to generate and verify `HMAC-SHA256` webhook signatures.
- `YOUPI_API_KEY`: Optional merchant public or private key.

---

## 5. Webhook Security & Verification Specification

YouPI-PG delivers webhooks over HTTPS/HTTP POST to `/api/payments/webhook`.

### Webhook Headers:
- `X-Gateway-Signature: sha256=<64_hex_chars>`: HMAC-SHA256 signature calculated over the unparsed request body.
- `X-Gateway-Delivery-Id: <uuid>`: Unique delivery identifier used to prevent replay attacks and duplicate subscriptions.
- `X-Gateway-Timestamp: <ms>`: Epoch timestamp of the original delivery.

### Verification Implementation:
1. The backend captures `req.rawBody` before JSON parsing using the `express.json` verify callback.
2. The signature is compared using timing-safe buffer comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
3. Timestamp freshness is validated within a 2-hour skew window (covering YouPI-PG's retry schedule).
4. Webhook processing is idempotent: repeated deliveries for the same `deliveryId` or an already `SUCCESS` order return `200 OK` without extending the subscription twice.

---

## 6. How to Run Tests

### Backend Payment Tests:
```bash
cd backend
npx jest src/__tests__/payment.test.ts
```

### Full Regression Backend Suite:
```bash
cd backend
npm test
```

### Frontend Build Verification:
```bash
cd frontend
npm run build
```

---

## 7. Starting the Services in Local Development

### 1. Smart Library Backend:
```bash
cd backend
npm run dev
# Server runs on port 5000 (http://localhost:5000)
```

### 2. Smart Library Frontend:
```bash
cd frontend
npm run dev
# Vite runs on port 5173 (http://localhost:5173)
```

### 3. (Optional) YouPI-PG Sovereign Gateway:
To run the self-hosted YouPI-PG gateway alongside the project:
```bash
cd external/YouPI-PG
npm install
npm run dev
# Payment API runs on port 6100 (http://localhost:6100)
# Merchant Admin runs on port 6001 (http://localhost:6001)
# Checkout Portal runs on port 7000 (http://localhost:7000)
```
*Note: If the YouPI-PG daemon is offline, Smart Library gracefully switches to direct PhonePe UPI QR mode without error.*
