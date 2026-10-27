// Shared display helpers so every page shows dates and statuses the same way.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10-25" or an ISO timestamp -> "25 Oct 2026".
export function formatDate(value) {
  if (!value) return "—";
  const text = String(value);
  // Plain dates are formatted directly to avoid time-zone shifts.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// ISO timestamp -> "25 Oct 2026, 4:55 pm".
export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const time = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${formatDate(value)}, ${time.toLowerCase()}`;
}

const LABELS = {
  CONFIRMED: "Confirmed",
  DRAFT: "Draft",
  CANCELLED: "Cancelled",
  RECEIVED: "Received",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  VOIDED: "Voided",
  VOID: "Voided",
  PURCHASE: "Purchase",
  SALE: "Sale",
  ADJUSTMENT: "Adjustment",
  REVERSAL: "Reversal",
  RETURN: "Returned",
  SALES_RETURN: "Return",
  SALES_ORDER: "Sale",
  MANUAL: "Manual entry",
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Part-paid",
  PAID: "Paid",
  INTRA: "Same state",
  INTER: "Other state",
  NONE: "Without GST",
  IGST: "Other state",
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
  CARD: "Card",
  OTHER: "Other",
  PRIMARY: "Main unit",
  SECONDARY: "Second unit",
  ADMIN: "Admin",
  OWNER: "Owner",
  ACCOUNTANT: "Accountant",
  SALESPERSON: "Salesperson",
  INVENTORY_MANAGER: "Inventory manager",
  VIEWER: "Viewer",
};

// Turns stored codes such as "SALES_ORDER" into words people use.
export function label(code) {
  if (code === null || code === undefined || code === "") return "—";
  const key = String(code).toUpperCase();
  if (LABELS[key]) return LABELS[key];
  const words = String(code).replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Badge for Paid / Part-paid / Unpaid. Uses the shared .pay-badge styles.
export function paymentBadgeClass(status) {
  const key = String(status || "").toUpperCase();
  if (key === "PAID") return "pay-badge pay-badge--paid";
  if (key === "PARTIALLY_PAID") return "pay-badge pay-badge--partial";
  return "pay-badge pay-badge--unpaid";
}
