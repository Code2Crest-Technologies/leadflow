"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Invoice } from "@/types";

type RecordPaymentModalProps = {
  invoice: Invoice;
  onClose: () => void;
  onSave: (payload: { amountReceived: number; paymentDate: string; notes?: string }) => Promise<void>;
  isSaving?: boolean;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function RecordPaymentModal({
  invoice,
  onClose,
  onSave,
  isSaving = false,
}: RecordPaymentModalProps) {
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const balanceDue = Number(invoice.balanceDue || 0);
  const amount = useMemo(() => Number(amountReceived || 0), [amountReceived]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!paymentDate) {
      setError("Payment date is required.");
      return;
    }

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      setError("Amount received must be greater than zero.");
      return;
    }

    if (amount > balanceDue) {
      setError("Amount received cannot exceed balance due.");
      return;
    }

    await onSave({
      amountReceived: amount,
      paymentDate,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Payment</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Record Payment</h2>
            <p className="mt-1 text-sm text-slate-500">{invoice.invoiceNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="flex justify-between"><span>Grand Total</span><strong>{formatCurrency(invoice.total)}</strong></p>
          <p className="flex justify-between"><span>Already Paid</span><strong>{formatCurrency(invoice.amountPaid)}</strong></p>
          <p className="flex justify-between text-slate-950"><span>Balance Due</span><strong>{formatCurrency(invoice.balanceDue)}</strong></p>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Amount Received
            <input
              className="input-field mt-1"
              type="number"
              min="0.01"
              step="0.01"
              max={balanceDue}
              value={amountReceived}
              onChange={(event) => setAmountReceived(event.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Payment Date
            <input
              className="input-field mt-1"
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              disabled={isSaving}
              required
            />
          </label>
        </div>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Notes optional
          <textarea
            className="input-field mt-1 min-h-24"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={isSaving}
            placeholder="UPI reference, bank transfer note, or internal remarks"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={isSaving}>
            Cancel
          </button>
          <button className="btn-primary" disabled={isSaving || balanceDue <= 0}>
            {isSaving ? "Saving..." : "Save Payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
