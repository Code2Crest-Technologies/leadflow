export type DashboardActivity = {
  id: string;
  eventType: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  contact?: { firstName: string; lastName?: string | null } | null;
  deal?: { title: string } | null;
};

export const activityIcons: Record<string, string> = {
  DEAL_CREATED: "DC",
  DEAL_STAGE_CHANGED: "SC",
  TASK_CREATED: "TC",
  TASK_COMPLETED: "TD",
  QUOTATION_CREATED: "QC",
  QUOTATION_SENT: "QS",
  INVOICE_CREATED: "IC",
  INVOICE_SENT: "IS",
  INVOICE_PAYMENT_RECORDED: "PR",
  INVOICE_PARTIALLY_PAID: "IP",
  INVOICE_PAID: "PD",
  INVOICE_OVERDUE: "OD",
  INVOICE_CANCELLED: "CN",
  NOTE_CREATED: "NA",
  CONVERSATION_ASSIGNED: "AS",
  CONVERSATION_NOTE_CREATED: "NT",
  DEAL_CREATED_FROM_CHAT: "CD",
};

function contactName(activity: DashboardActivity) {
  const name = [activity.contact?.firstName, activity.contact?.lastName]
    .filter(Boolean)
    .join(" ");
  return name || "a contact";
}

export function formatActivityMessage(activity: DashboardActivity) {
  const metadata = activity.metadata || {};
  const title = typeof metadata.title === "string" ? metadata.title : activity.deal?.title || "";
  const quoteNumber = typeof metadata.quoteNumber === "string" ? metadata.quoteNumber : "";
  const invoiceNumber = typeof metadata.invoiceNumber === "string" ? metadata.invoiceNumber : "";
  const amountReceived =
    typeof metadata.amountReceived === "number" || typeof metadata.amountReceived === "string"
      ? Number(metadata.amountReceived)
      : null;
  const assignedToName = typeof metadata.assignedToName === "string" ? metadata.assignedToName : "";
  const from = typeof metadata.from === "string" ? metadata.from : "";
  const to = typeof metadata.to === "string" ? metadata.to : "";
  const name = contactName(activity);

  switch (activity.eventType) {
    case "DEAL_CREATED":
      return `New deal created for ${name}${title ? `: ${title}` : ""}`;
    case "DEAL_STAGE_CHANGED":
      return `Deal stage changed for ${name}${from && to ? `: ${from} -> ${to}` : ""}`;
    case "TASK_CREATED":
      return `Task created for ${name}${title ? `: ${title}` : ""}`;
    case "TASK_COMPLETED":
      return `Task completed for ${name}${title ? `: ${title}` : ""}`;
    case "QUOTATION_CREATED":
      return `Quotation created for ${name}${quoteNumber ? `: ${quoteNumber}` : ""}`;
    case "QUOTATION_SENT":
      return `Quotation sent for ${name}${quoteNumber ? `: ${quoteNumber}` : ""}`;
    case "INVOICE_CREATED":
      return `Invoice created${invoiceNumber ? `: ${invoiceNumber}` : ` for ${name}`}`;
    case "INVOICE_SENT":
      return `Invoice sent${invoiceNumber ? `: ${invoiceNumber}` : ` to ${name}`}`;
    case "INVOICE_PAYMENT_RECORDED":
      return `Payment recorded${amountReceived ? `: ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amountReceived)}` : ""}${invoiceNumber ? ` for ${invoiceNumber}` : ""}`;
    case "INVOICE_PARTIALLY_PAID":
      return `Invoice partially paid${invoiceNumber ? `: ${invoiceNumber}` : ""}`;
    case "INVOICE_PAID":
      return `Invoice marked paid${invoiceNumber ? `: ${invoiceNumber}` : ""}`;
    case "INVOICE_OVERDUE":
      return `Invoice overdue${invoiceNumber ? `: ${invoiceNumber}` : ""}`;
    case "INVOICE_CANCELLED":
      return `Invoice cancelled${invoiceNumber ? `: ${invoiceNumber}` : ""}`;
    case "NOTE_CREATED":
      return `Note added for ${name}`;
    case "CONVERSATION_ASSIGNED":
      return `Conversation assigned for ${name}${assignedToName ? ` to ${assignedToName}` : ""}`;
    case "CONVERSATION_NOTE_CREATED":
      return `Internal note added for ${name}`;
    case "DEAL_CREATED_FROM_CHAT":
      return `Deal created from chat for ${name}${title ? `: ${title}` : ""}`;
    default:
      return activity.eventType.replace(/_/g, " ").toLowerCase();
  }
}
