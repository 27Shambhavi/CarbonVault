# CarbonVault — Production Go-Live Checklist & Runbook (Phase 7)

This runbook specifies the step-by-step procedures for switching CarbonVault from Staging / Test Mode to Live Production Mode. **Do not switch to live mode without completing every gate in this document.**

---

## 1. Prerequisites Checklist

| Gate | Requirement | Status | Owner |
|------|-------------|--------|-------|
| 1.1 | Company Entity & Bank Account verified in Razorpay Dashboard | Pending | Finance |
| 1.2 | Razorpay KYC & Settlement activation approved | Pending | Finance |
| 1.3 | GSTIN and PAN configured in Razorpay Profile | Pending | Legal / Tax |
| 1.4 | HTTPS domain and SSL certificates active on frontend and backend | Complete | DevOps |
| 1.5 | Database migrations at head revision on production PostgreSQL | Complete | DevOps |
| 1.6 | All 87+ CI/CD backend and frontend automated tests passing | Complete | CI / GitHub |

---

## 2. Razorpay Dashboard Configuration

Follow these steps directly inside the [Razorpay Merchant Dashboard](https://dashboard.razorpay.com/):

### Step 2.1 — Switch Environment to Live Mode
1. In the top navigation bar, toggle the environment switch from **Test Mode** to **Live Mode**.
2. If prompted, confirm merchant business details and verify the registered two-factor authentication (2FA).

### Step 2.2 — Generate Live API Keys
1. Navigate to **Settings** → **API Keys**.
2. Click **Generate Key** (or **Regenerate Key** if replacing an existing pair).
3. Securely copy:
   - **Key ID**: starts with `rzp_live_...`
   - **Key Secret**: 32-character secret string.
   > [!CAUTION]
   > Download and store the Key Secret in a secure vault (e.g. AWS Secrets Manager or 1Password). Razorpay will never display the secret again.

### Step 2.3 — Configure Webhook Endpoint
1. Navigate to **Settings** → **Webhooks**.
2. Click **Add New Webhook**.
3. Set **Webhook URL** to:
   ```text
   https://carbonvault-api.onrender.com/webhook
   ```
4. Set **Secret** to a high-entropy 32-character alphanumeric secret string (e.g. generated via `openssl rand -hex 24`).
5. Select the following **Active Events**:
   - `payment.captured`
   - `order.paid`
   - `payment.failed`
   - `refund.created`
   - `refund.processed`
6. Click **Save**.

---

## 3. Order of Switching Environment Variables (Render Dashboard)

Update the environment variables on the Render Backend service in this exact sequence:

1. `PAYMENT_MODE=live`
2. `RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx`
3. `RAZORPAY_KEY_SECRET=<Your Live Key Secret>`
4. `RAZORPAY_WEBHOOK_SECRET=<Your Webhook Secret from Step 2.3>`
5. Click **Save Changes** and allow Render to trigger a zero-downtime rolling deployment.

---

## 4. Smoke Test & Post-Switch Verification

Immediately following the live deployment, perform a minimum-unit live test purchase:

1. **Create Order Verification**:
   - Create a test listing at unit price ₹100.
   - Initiate checkout in the frontend Corporate Marketplace.
   - Verify that the Razorpay checkout modal opens with real UPI, Card, and Netbanking rails.
2. **Payment & Webhook Validation**:
   - Complete a ₹100 UPI payment.
   - Verify that Razorpay captures the payment and POSTs to `/webhook`.
   - Inspect backend logs for `Received verified Razorpay webhook event: payment.captured`.
   - Confirm that the HMAC signature passes without error.
3. **Ledger & Certificate Issuance**:
   - Confirm that the transaction is recorded with a unique transaction ID.
   - Confirm that an immutable `Certificate` record is issued with an SHA-256 hash.
   - Confirm that available batch quantity is decremented by the purchased volume.
4. **Refund Test**:
   - In Admin Approvals, execute an admin refund for the ₹100 test transaction.
   - Verify that the transaction is marked `refunded` and corporate wallet is reversed.

---

## 5. Rollback Contingency

If any error occurs during live processing (e.g. signature failure, payment rejection):

1. Immediately switch `PAYMENT_MODE=demo` in the Render dashboard.
2. Revert `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to test keys.
3. Verify that the frontend falls back seamlessly to demo checkout without disruption.
