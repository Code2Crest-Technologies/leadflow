# LeadFlow Billing, GST Invoicing, and Payment Tracking

Phase 9 adds a production billing foundation while preserving the existing invoice workflow.

## What Is Implemented

- Company billing profile for legal/GST/bank/payment-term details.
- GST-aware invoice fields for taxable value, CGST/SGST, IGST, Tax/VAT, total amount, amount paid, and amount due.
- Invoice snapshots for company and customer billing details at invoice creation time.
- Project-aware invoices when an invoice is created from a deal linked to a project.
- Public invoice links with hashed tokens.
- Manual payment recording with payment ledger entries.
- Receipt records and receipt PDF download.
- Razorpay order and verification foundation in test mode only.
- Project kickoff readiness now checks recorded advance payments.

## GST Logic

Invoices continue to use the existing tax helper:

- Tamil Nadu customer: CGST + SGST.
- Other Indian state: IGST.
- International customer: Tax/VAT.
- Zero tax: no tax mode.

## Razorpay

This build is intentionally test-mode only.

Required environment variables:

```env
RAZORPAY_MODE=test
RAZORPAY_KEY_ID=rzp_test_replace
RAZORPAY_KEY_SECRET=replace-with-test-secret
RAZORPAY_WEBHOOK_SECRET=replace-with-test-webhook-secret
```

If `RAZORPAY_MODE` is not `test`, LeadFlow rejects Razorpay order creation.

## Public Invoice Links

Public invoice URLs are created from random tokens. Only the token hash is stored in the database. Opening a public invoice updates invoice viewed metadata and marks a `SENT` invoice as `VIEWED`.

## Project Readiness

Advance payment readiness passes when a linked deal/project has an invoice in `PARTIALLY_PAID` or `PAID` status.

## WhatsApp Automation Integration

Phase 10 adds WhatsApp communication hooks for invoice links, due reminders, overdue reminders, and payment confirmations. These automations are off by default and should use approved WhatsApp templates. Payment reminders stop once an invoice is `PAID`, `CANCELLED`, or `VOID`.
