import { useEffect, useState } from "react";
import {
  getSalesOrderBalance,
  getSalesOrderById,
} from "../../services/api/salesOrderApi";
import { getCustomerById } from "../../services/api/customerApi";
import "./SalesOrderInvoice.css";

const BUSINESS = {
  name: "INDRA VAIBHAV MARBLES",
  address: "Tekuna Farm, Hariharpur, Opp. Aryabhatta Polytechnic College",
  city: "Bodhgaya, Gaya, Bihar",
  phone: "9431062287",
  gstin: "10AEFPP6730F1ZV",
  stateCode: "10",
};

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function numberToWords(value) {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven",
    "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen",
    "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty",
    "Seventy", "Eighty", "Ninety",
  ];

  function underThousand(n) {
    let result = "";
    if (n >= 100) {
      result += `${ones[Math.floor(n / 100)]} Hundred `;
      n %= 100;
    }
    if (n >= 20) {
      result += `${tens[Math.floor(n / 10)]} `;
      n %= 10;
    }
    if (n > 0) result += `${ones[n]} `;
    return result.trim();
  }

  function convert(n) {
    if (n === 0) return "Zero";
    const parts = [];
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    if (crore) parts.push(`${underThousand(crore)} Crore`);
    if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
    if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
    if (n) parts.push(underThousand(n));
    return parts.join(" ");
  }

  const rounded = Math.round((Number(value || 0) + Number.EPSILON) * 100);
  const rupees = Math.floor(rounded / 100);
  const paise = rounded % 100;
  let result = `Rupees ${convert(rupees)}`;
  if (paise) result += ` and ${convert(paise)} Paise`;
  return `${result} Only`;
}

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}-${month}-${year}`;
}

function printInvoice(order, customer, items) {
  // Open the window directly from the button click so the browser allows it.
  const printWindow = window.open("", "_blank", "width=1000,height=800");

  if (!printWindow) {
    window.alert(
      "The print window was blocked. Please allow pop-ups for this site and try again."
    );
    return;
  }

  const itemRows = items.map((item, index) => {
    const gst =
      Number(item.cgstAmount || 0) +
      Number(item.sgstAmount || 0) +
      Number(item.igstAmount || 0);

    return `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${escapeHtml(item.productName || "—")}</td>
        <td class="center">${escapeHtml(item.hsnCode || "—")}</td>
        <td class="number">${Number(item.quantity || 0)}</td>
        <td class="center">${escapeHtml(item.unitCode || "—")}</td>
        <td class="number">${money(item.unitPrice)}</td>
        <td class="number">${money(item.taxableAmount)}</td>
        <td class="number">${money(gst)}</td>
        <td class="number">${money(item.lineTotal)}</td>
      </tr>`;
  }).join("");

  const statusLabel =
    order.status === "DRAFT"
      ? "DRAFT — NOT A FINAL TAX INVOICE"
      : escapeHtml(order.status);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice ${escapeHtml(order.orderNumber)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; color: #111; background: #fff; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; line-height: 1.3; }
    .invoice { width: 100%; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-bottom: 10px; border-bottom: 2px solid #222; }
    .business h1 { margin: 0 0 5px; font-size: 19px; letter-spacing: .3px; }
    .business p { margin: 2px 0; }
    .invoice-title { min-width: 125px; text-align: center; }
    .invoice-title h2 { margin: 0 0 5px; padding: 7px; border: 1px solid #222; font-size: 14px; }
    .status { font-size: 8px; font-weight: bold; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; margin-top: 10px; border-top: 1px solid #333; border-left: 1px solid #333; }
    .meta > div { min-width: 0; padding: 6px; border-right: 1px solid #333; border-bottom: 1px solid #333; overflow-wrap: anywhere; }
    .label { display: block; margin-bottom: 3px; color: #444; font-size: 8px; }
    .value { display: block; font-weight: 600; }
    table { width: 100%; margin-top: 11px; border-collapse: collapse; table-layout: auto; font-size: 8px; }
    th, td { border: 1px solid #333; padding: 5px 4px; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #f0f0f0; text-align: left; }
    .center { text-align: center; }
    .number { text-align: right; white-space: nowrap; }
    .bottom { display: grid; grid-template-columns: 1fr .9fr; gap: 10px; margin-top: 10px; }
    .words, .totals { border: 1px solid #333; padding: 8px; min-width: 0; }
    .words h3 { margin: 0 0 5px; font-size: 9px; }
    .words p { margin: 0 0 12px; overflow-wrap: anywhere; }
    .total-row { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px solid #ddd; }
    .total-row strong { white-space: nowrap; }
    .grand { margin-top: 3px; padding-top: 7px; border-top: 2px solid #222; border-bottom: 0; font-size: 12px; font-weight: bold; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 15px; margin-top: 22px; }
    .footer-note { max-width: 60%; font-size: 8px; }
    .signature { min-width: 160px; text-align: center; }
    .signature-space { height: 35px; }
    .signature strong, .signature span { display: block; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      thead { display: table-header-group; }
      tr, .bottom, .footer, .header, .meta { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="invoice">
    <header class="header">
      <div class="business">
        <h1>${escapeHtml(BUSINESS.name)}</h1>
        <p>${escapeHtml(BUSINESS.address)}</p>
        <p>${escapeHtml(BUSINESS.city)}</p>
        <p>Phone: ${escapeHtml(BUSINESS.phone)}</p>
        <p>GSTIN: ${escapeHtml(BUSINESS.gstin)}</p>
        <p>State Code: ${escapeHtml(BUSINESS.stateCode)}</p>
      </div>
      <div class="invoice-title">
        <h2>TAX INVOICE</h2>
        <div class="status">${statusLabel}</div>
      </div>
    </header>

    <section class="meta">
      <div><span class="label">Order / Reference No.</span><span class="value">${escapeHtml(order.orderNumber)}</span></div>
      <div><span class="label">Order Date</span><span class="value">${escapeHtml(formatDate(order.orderDate))}</span></div>
      <div><span class="label">Customer</span><span class="value">${escapeHtml(customer?.name || order.customerName || "—")}</span></div>
      <div><span class="label">Phone</span><span class="value">${escapeHtml(customer?.phone || "—")}</span></div>
      <div><span class="label">Customer GSTIN</span><span class="value">${escapeHtml(customer?.gstin || "—")}</span></div>
      <div><span class="label">Billing Address</span><span class="value">${escapeHtml(customer?.billingAddress || "—")}</span></div>
      <div><span class="label">Shipping Address</span><span class="value">${escapeHtml(customer?.shippingAddress || "—")}</span></div>
      <div><span class="label">Tax Type</span><span class="value">${order.taxType === "INTRA" ? "CGST + SGST" : "IGST"}</span></div>
    </section>

    <table>
      <thead>
        <tr>
          <th>Sl.</th><th>Description of Goods</th><th>HSN</th><th>Qty.</th>
          <th>Unit</th><th>Rate (₹)</th><th>Taxable Value (₹)</th>
          <th>GST (₹)</th><th>Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || '<tr><td colspan="9" class="center">No items</td></tr>'}
      </tbody>
    </table>

    <section class="bottom">
      <div class="words">
        <h3>Amount in Words</h3>
        <p>${escapeHtml(numberToWords(order.grandTotal))}</p>
        ${order.notes ? `<h3>Notes</h3><p>${escapeHtml(order.notes)}</p>` : ""}
        <h3>Bank / Payment Details</h3>
        <p>Configure bank details in ERP settings.</p>
      </div>
      <div class="totals">
        <div class="total-row"><span>Subtotal</span><strong>${money(order.subtotal)}</strong></div>
        <div class="total-row"><span>CGST</span><strong>${money(order.cgstAmount)}</strong></div>
        <div class="total-row"><span>SGST</span><strong>${money(order.sgstAmount)}</strong></div>
        <div class="total-row"><span>IGST</span><strong>${money(order.igstAmount)}</strong></div>
        <div class="total-row"><span>Total Tax</span><strong>${money(order.totalTax)}</strong></div>
        ${(order.charges || []).map((charge) => `<div class="total-row"><span>${escapeHtml(charge.description)}</span><strong>${money(charge.amount)}</strong></div>`).join("")}
        <div class="total-row grand"><span>Grand Total</span><strong>${money(order.grandTotal)}</strong></div>
      </div>
    </section>

    <footer class="footer">
      <p class="footer-note">This document reflects the saved sales order. Draft orders are not final tax invoices. Verify invoice details and applicable GST requirements before issuing an invoice.</p>
      <div class="signature">
        <strong>For ${escapeHtml(BUSINESS.name)}</strong>
        <div class="signature-space"></div>
        <span>Authorised Signatory</span>
      </div>
    </footer>
  </main>
  <script>
    window.addEventListener("load", () => {
      setTimeout(() => {
        window.focus();
        window.print();
      }, 300);
    });
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export default function SalesOrderInvoice({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadInvoice() {
      setLoading(true);
      setError("");

      try {
        const savedOrder = await getSalesOrderById(orderId);
        let savedBalance = null;
        try {
          savedBalance = await getSalesOrderBalance(orderId);
        } catch {
          savedBalance = null;
        }
        let savedCustomer = null;

        try {
          savedCustomer = await getCustomerById(savedOrder.customerId);
        } catch {
          // Continue with order data if customer details are unavailable.
        }

        if (!cancelled) {
          setOrder(savedOrder);
          setCustomer(savedCustomer);
          setBalance(savedBalance);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load the saved order.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="sales-invoice-overlay">
        <div className="sales-invoice-message">Loading saved order...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="sales-invoice-overlay">
        <div className="sales-invoice-message">
          <p>{error || "Order not found."}</p>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="sales-invoice-overlay">
      <div className="sales-invoice-toolbar">
        <span>
          {order.status === "DRAFT"
            ? "Draft order — not a final tax invoice"
            : "Saved order invoice"}
        </span>
        {balance && (
          <span className="sales-invoice-payment-summary">
            {balance.paymentStatus.replace("_", " ")} · Due {money(balance.outstandingBalance)}
          </span>
        )}
        <div>
          <button
            type="button"
            onClick={() => printInvoice(order, customer, items)}
          >
            Print / Save PDF
          </button>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>

      <article className="sales-invoice-print-root">
        <header className="sales-invoice-header">
          <div className="sales-invoice-business">
            <h1>{BUSINESS.name}</h1>
            <p>{BUSINESS.address}</p>
            <p>{BUSINESS.city}</p>
            <p>Phone: {BUSINESS.phone}</p>
            <p>GSTIN: {BUSINESS.gstin}</p>
            <p>State Code: {BUSINESS.stateCode}</p>
          </div>
          <div className="sales-invoice-title">
            <h2>TAX INVOICE</h2>
            <strong>{order.status}</strong>
          </div>
        </header>

        <section className="sales-invoice-meta">
          <div><span>Order / Reference No.</span><strong>{order.orderNumber}</strong></div>
          <div><span>Order Date</span><strong>{formatDate(order.orderDate)}</strong></div>
          <div><span>Customer</span><strong>{customer?.name || order.customerName || "—"}</strong></div>
          <div><span>Phone</span><strong>{customer?.phone || "—"}</strong></div>
          <div><span>Customer GSTIN</span><strong>{customer?.gstin || "—"}</strong></div>
          <div><span>Billing Address</span><strong>{customer?.billingAddress || "—"}</strong></div>
          <div><span>Shipping Address</span><strong>{customer?.shippingAddress || "—"}</strong></div>
          <div><span>Tax Type</span><strong>{order.taxType === "INTRA" ? "CGST + SGST" : "IGST"}</strong></div>
        </section>

        <table className="sales-invoice-items">
          <thead>
            <tr>
              <th>Sl.</th><th>Description of Goods</th><th>HSN</th><th>Qty.</th>
              <th>Unit</th><th>Rate (₹)</th><th>Taxable Value (₹)</th>
              <th>GST (₹)</th><th>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const gst =
                Number(item.cgstAmount || 0) +
                Number(item.sgstAmount || 0) +
                Number(item.igstAmount || 0);

              return (
                <tr key={item.id || index}>
                  <td>{index + 1}</td>
                  <td>{item.productName || "—"}</td>
                  <td>{item.hsnCode || "—"}</td>
                  <td>{Number(item.quantity || 0)}</td>
                  <td>{item.unitCode || "—"}</td>
                  <td className="invoice-number">{money(item.unitPrice)}</td>
                  <td className="invoice-number">{money(item.taxableAmount)}</td>
                  <td className="invoice-number">{money(gst)}</td>
                  <td className="invoice-number">{money(item.lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <section className="sales-invoice-bottom">
          <div className="sales-invoice-words">
            <h3>Amount in Words</h3>
            <p>{numberToWords(order.grandTotal)}</p>
            {order.notes && <><h3>Notes</h3><p>{order.notes}</p></>}
            <h3>Bank / Payment Details</h3>
            <p>Configure bank details in ERP settings.</p>
          </div>
          <div className="sales-invoice-totals">
            <div><span>Subtotal</span><strong>{money(order.subtotal)}</strong></div>
            <div><span>CGST</span><strong>{money(order.cgstAmount)}</strong></div>
            <div><span>SGST</span><strong>{money(order.sgstAmount)}</strong></div>
            <div><span>IGST</span><strong>{money(order.igstAmount)}</strong></div>
            <div><span>Total Tax</span><strong>{money(order.totalTax)}</strong></div>
            {(order.charges || []).map((charge) => <div key={charge.id}><span>{charge.description}</span><strong>{money(charge.amount)}</strong></div>)}
            <div className="sales-invoice-grand-total"><span>Grand Total</span><strong>{money(order.grandTotal)}</strong></div>
          </div>
        </section>

        <footer className="sales-invoice-footer">
          <p>
            This document reflects the saved sales order. Draft orders are not
            final tax invoices. Verify invoice details and applicable GST
            requirements before issuing an invoice.
          </p>
          <div>
            <strong>For {BUSINESS.name}</strong>
            <span>Authorised Signatory</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
