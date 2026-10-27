import { useEffect, useRef, useState } from "react";
import {
  getSalesOrderBalance,
  getSalesOrderById,
} from "../../services/api/salesOrderApi";
import { getCustomerById } from "../../services/api/customerApi";
import { label, paymentBadgeClass } from "../../utils/format";
import "./SalesOrderInvoice.css";

const BUSINESS = {
  name: "INDRA VAIBHAV MARBLES",
  tagline: "Selling Quality Since 2006",
  promise: "Quality marble. Trusted craftsmanship. Timeless spaces.",
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

function invoiceTitle(order) {
  return order.status === "DRAFT" ? "DRAFT — NOT A TAX INVOICE" : "TAX INVOICE";
}

function taxTypeLabel(order) {
  if (order.taxType === "INTRA") return "CGST + SGST";
  if (order.taxType === "INTER") return "IGST";
  return "—";
}

// The purchaser's state code comes from the first two digits of their
// GSTIN. Without a GSTIN, an intra-state sale is in the business's state.
function customerStateCode(order, customer) {
  const gstinPrefix = String(customer?.gstin || "").trim().slice(0, 2);
  if (/^\d{2}$/.test(gstinPrefix)) return gstinPrefix;
  return order.taxType === "INTRA" ? BUSINESS.stateCode : "—";
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

// A strip of marble for the top edge of the bill's letterhead.
const MARBLE_STRIP =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='60' viewBox='0 0 800 60' preserveAspectRatio='none'%3E%3Cfilter id='m' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.004 0.03' numOctaves='5' seed='4'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.43 0 0 0 0 0.39 0 0 0 0 0.33 30 0 0 0 -14.6'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='table' tableValues='0 1 0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='800' height='60' filter='url(%23m)' opacity='0.55'/%3E%3C/svg%3E";

// One stylesheet for the bill, used by the on-screen preview and the printed
// copy, so what you see is exactly what prints.
const INVOICE_CSS = `
  /* No page margin, so the browser has no room to print its own date, title
     and address lines; the bill keeps its white border inside the sheet. */
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    color: #1f1b16;
    font-family: "Manrope", "Segoe UI", Arial, Helvetica, sans-serif;
    font-size: 9pt;
    line-height: 1.4;
    font-variant-numeric: tabular-nums;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    position: relative;
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
    padding: 12mm 12mm 10mm;
    overflow: hidden;
    background: #fffdf9;
  }
  .sheet::before {
    position: absolute;
    inset: 0 0 auto;
    height: 7mm;
    background:
      linear-gradient(180deg, rgb(255 253 249 / 0%), #fffdf9),
      url("${MARBLE_STRIP}") center / cover,
      #ece7df;
    content: "";
  }
  .letterhead {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding-top: 4mm;
  }
  .brand { min-width: 0; }
  .brand h1 {
    margin: 0;
    color: #3b3026;
    font-size: 20pt;
    font-weight: 800;
    letter-spacing: .6px;
    line-height: 1.15;
  }
  .tagline { margin: 3px 0 0; color: #8c6f4d; font-size: 9pt; font-weight: 700; }
  .address {
    margin: 8px 0 0;
    color: #1f1b16;
    font-size: 10.5pt;
    font-weight: 700;
    line-height: 1.35;
  }
  .doc { flex-shrink: 0; text-align: right; }
  .doc-title {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    background: #3b3026;
    color: #f3e6d2;
    font-size: 9pt;
    font-weight: 800;
    letter-spacing: 1.2px;
  }
  .doc-title.is-draft { background: #b45309; color: #fff; }
  .doc dl {
    display: grid;
    grid-template-columns: auto auto;
    gap: 2px 12px;
    margin: 8px 0 0;
    justify-content: end;
  }
  .doc dt { color: #7a7064; font-size: 8pt; text-align: right; }
  .doc dd { margin: 0; font-weight: 700; text-align: right; }
  .contact {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 28px;
    margin-top: 10px;
    padding: 8px 0;
    border-top: 1.5px solid #8c6f4d;
    border-bottom: 1px solid #e4dccf;
    color: #4f463b;
    font-size: 10pt;
    font-weight: 600;
  }
  .contact strong { color: #1f1b16; font-weight: 800; }
  .parties {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 10px;
    margin-top: 12px;
  }
  .card {
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid #e4dccf;
    border-radius: 3mm;
    background: #f8f4ee;
  }
  .card h3 {
    margin: 0 0 6px;
    color: #8c6f4d;
    font-size: 8pt;
    font-weight: 800;
    letter-spacing: .4px;
  }
  .card .name { display: block; margin-bottom: 4px; font-size: 11pt; font-weight: 800; }
  .card p { margin: 0; overflow-wrap: anywhere; }
  .rows { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; margin: 0; }
  .rows dt { color: #7a7064; }
  .rows dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
  table.items {
    width: 100%;
    margin-top: 12px;
    border: 1px solid #d9cfc0;
    border-radius: 3mm;
    border-collapse: separate;
    border-spacing: 0;
    overflow: hidden;
    font-size: 8pt;
  }
  .items th, .items td { padding: 6px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  .items th { background: #3b3026; color: #f3e6d2; font-size: 7.5pt; font-weight: 700; }
  .items td { border-top: 1px solid #ece5da; }
  .items tbody tr:nth-child(even) td { background: #faf6f0; }
  .items .center { text-align: center; }
  .items .number { text-align: right; white-space: nowrap; }
  .items .product { font-weight: 700; }
  .bottom {
    display: grid;
    grid-template-columns: 1fr 0.95fr;
    gap: 10px;
    margin-top: 12px;
    align-items: start;
  }
  .notes { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .words { padding: 10px 12px; border-left: 3px solid #8c6f4d; border-radius: 0 3mm 3mm 0; background: #f8f4ee; }
  .words h3 { margin: 0 0 3px; color: #8c6f4d; font-size: 8pt; font-weight: 800; }
  .words p { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
  .totals { min-width: 0; padding: 8px 12px 0; border: 1px solid #e4dccf; border-radius: 3mm; overflow: hidden; }
  .total-row { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px dashed #e4dccf; }
  .total-row span { color: #4f463b; }
  .total-row strong { white-space: nowrap; }
  .grand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 8px -12px 0;
    padding: 10px 12px;
    background: linear-gradient(145deg, #4a3c2e, #2e251c);
    color: #fff;
  }
  .grand span { color: #e6d3b6; font-size: 8.5pt; font-weight: 700; }
  .grand strong { font-size: 14pt; font-weight: 800; white-space: nowrap; }
  .footer {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-top: 22px;
    padding-top: 10px;
    border-top: 1px solid #e4dccf;
  }
  .thanks strong { display: block; color: #3b3026; font-size: 10pt; }
  .thanks span { color: #7a7064; font-size: 8pt; }
  .signature { min-width: 50mm; text-align: center; }
  .signature strong { display: block; font-size: 8.5pt; }
  .signature .space { height: 14mm; }
  .signature span { display: block; padding-top: 4px; border-top: 1px solid #7a7064; color: #4f463b; font-size: 8pt; }
  @media screen {
    .sheet { box-shadow: 0 1px 2px rgb(60 44 24 / 10%), 0 18px 40px rgb(40 28 14 / 18%); }
  }
  @media print {
    .sheet { max-width: none; padding: 10mm; background: #fff; }
    .sheet::before { display: none; }
    .letterhead { padding-top: 0; }
    .items thead { display: table-header-group; }
    .items tr, .letterhead, .parties, .bottom, .footer { break-inside: avoid; page-break-inside: avoid; }
  }
`;

function invoiceHtml(order, customer, items, { autoPrint }) {
  const itemRows = items.map((item, index) => {
    const gst =
      Number(item.cgstAmount || 0) +
      Number(item.sgstAmount || 0) +
      Number(item.igstAmount || 0);

    return `
      <tr>
        <td class="center">${index + 1}</td>
        <td class="product">${escapeHtml(item.productName || "—")}</td>
        <td class="center">${escapeHtml(item.hsnCode || "—")}</td>
        <td class="number">${Number(item.quantity || 0)}</td>
        <td class="center">${escapeHtml(item.unitCode || "—")}</td>
        <td class="number">${money(item.unitPrice)}</td>
        <td class="number">${money(item.taxableAmount)}</td>
        <td class="number">${Number(item.gstRate || 0)}%</td>
        <td class="number">${money(gst)}</td>
        <td class="number">${money(item.lineTotal)}</td>
      </tr>`;
  }).join("");
  const charges = Array.isArray(order.charges) ? order.charges : [];
  const roundOff = 0;
  const printScript = autoPrint
    ? `<script>
    window.addEventListener("load", () => {
      // Wait for the font so the printed bill uses it.
      const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
      fontsReady.then(() => {
        setTimeout(() => {
          window.focus();
          window.print();
        }, 150);
      });
    });
  </script>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice ${escapeHtml(order.orderNumber)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>${INVOICE_CSS}</style>
</head>
<body>
  <main class="sheet">
    <header class="letterhead">
      <div class="brand">
        <h1>${escapeHtml(BUSINESS.name)}</h1>
        <p class="tagline">${escapeHtml(BUSINESS.tagline)}</p>
        <p class="address">${escapeHtml(BUSINESS.address)},<br>${escapeHtml(BUSINESS.city)}</p>
      </div>
      <div class="doc">
        <span class="doc-title${order.status === "DRAFT" ? " is-draft" : ""}">${escapeHtml(invoiceTitle(order))}</span>
        <dl>
          <dt>Invoice No.</dt><dd>${escapeHtml(order.orderNumber)}</dd>
          <dt>Date</dt><dd>${escapeHtml(formatDate(order.orderDate))}</dd>
        </dl>
      </div>
    </header>

    <div class="contact">
      <span>Mob.: <strong>${escapeHtml(BUSINESS.phone)}</strong></span>
      <span>GSTIN: <strong>${escapeHtml(BUSINESS.gstin)}</strong></span>
    </div>

    <section class="parties">
      <div class="card">
        <h3>Billed to</h3>
        <span class="name">${escapeHtml(customer?.name || order.customerName || "—")}</span>
        <dl class="rows">
          <dt>Phone</dt><dd>${escapeHtml(customer?.phone || "—")}</dd>
          <dt>Address</dt><dd>${escapeHtml(customer?.billingAddress || "—")}</dd>
          <dt>GSTIN / Unique ID</dt><dd>${escapeHtml(customer?.gstin || "—")}</dd>
        </dl>
      </div>
      <div class="card">
        <h3>Tax details</h3>
        <dl class="rows">
          <dt>State Code</dt><dd>${escapeHtml(customerStateCode(order, customer))}</dd>
          <dt>Tax Type</dt><dd>${escapeHtml(taxTypeLabel(order))}</dd>
        </dl>
      </div>
    </section>

    <table class="items">
      <thead>
        <tr>
          <th class="center">Sl.</th><th>Description of Goods</th><th class="center">HSN</th><th class="number">Qty.</th>
          <th class="center">Unit</th><th class="number">Rate (₹)</th><th class="number">Taxable Value (₹)</th>
          <th class="number">GST %</th><th class="number">GST (₹)</th><th class="number">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || '<tr><td colspan="10" class="center">No items</td></tr>'}
      </tbody>
    </table>

    <section class="bottom">
      <div class="notes">
        <div class="words">
          <h3>Amount in Words</h3>
          <p>${escapeHtml(numberToWords(order.grandTotal))}</p>
        </div>
        ${order.notes ? `<div class="card"><h3>Notes</h3><p>${escapeHtml(order.notes)}</p></div>` : ""}
        <div class="card">
          <h3>Transportation Details</h3>
          <dl class="rows"><dt>Transportation mode</dt><dd>—</dd><dt>Vehicle no.</dt><dd>—</dd></dl>
        </div>
        <div class="card">
          <h3>Bank / Payment Details</h3>
          <dl class="rows"><dt>Bank name</dt><dd>—</dd><dt>Account no.</dt><dd>—</dd><dt>IFSC / Branch</dt><dd>—</dd></dl>
        </div>
      </div>
      <div class="totals">
        <div class="total-row"><span>Total Amount Before Tax</span><strong>${money(order.subtotal)}</strong></div>
        <div class="total-row"><span>CGST</span><strong>${money(order.cgstAmount)}</strong></div>
        <div class="total-row"><span>SGST</span><strong>${money(order.sgstAmount)}</strong></div>
        <div class="total-row"><span>IGST</span><strong>${money(order.igstAmount)}</strong></div>
        <div class="total-row"><span>Total Tax</span><strong>${money(order.totalTax)}</strong></div>
        ${charges.map((charge) => `<div class="total-row"><span>Add: ${escapeHtml(charge.description)}</span><strong>${money(charge.amount)}</strong></div>`).join("")}
        <div class="total-row"><span>Round Off</span><strong>${money(roundOff)}</strong></div>
        <div class="grand"><span>Total Amount After Tax</span><strong>${money(order.grandTotal)}</strong></div>
      </div>
    </section>

    <footer class="footer">
      <div class="thanks">
        <strong>Thank you for your business.</strong>
        <span>${escapeHtml(BUSINESS.promise)}</span>
      </div>
      <div class="signature">
        <strong>For ${escapeHtml(BUSINESS.name)}</strong>
        <div class="space"></div>
        <span>Authorised Signatory</span>
      </div>
    </footer>
  </main>
  ${printScript}
</body>
</html>`;
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

  printWindow.document.open();
  printWindow.document.write(invoiceHtml(order, customer, items, { autoPrint: true }));
  printWindow.document.close();
}

// The preview frame is always one A4 sheet wide, like the printed bill. It
// grows to the bill's full height and shrinks to fit narrow screens.
const A4_WIDTH_PX = 794;

function fitFrameToContent(frame) {
  const doc = frame?.contentDocument;
  if (!frame || !doc?.documentElement) return;
  const available = frame.parentElement.clientWidth - 20;
  frame.style.zoom = String(Math.min(1, available / A4_WIDTH_PX));
  frame.style.height = `${doc.documentElement.scrollHeight}px`;
}

export default function SalesOrderInvoice({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState("");

  const frameRef = useRef(null);

  useEffect(() => {
    function handleResize() {
      fitFrameToContent(frameRef.current);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
        <div className="sales-invoice-toolbar-text">
          <strong>
            {order.status === "DRAFT"
              ? "Draft order — not a final tax invoice"
              : `Bill ${order.orderNumber}`}
          </strong>
          {balance && (
            <span className="sales-invoice-payment-summary">
              <span className={paymentBadgeClass(balance.paymentStatus)}>
                {label(balance.paymentStatus)}
              </span>
              Due {money(balance.outstandingBalance)}
            </span>
          )}
        </div>
        <div className="sales-invoice-toolbar-actions">
          <button
            type="button"
            className="sales-invoice-print"
            onClick={() => printInvoice(order, customer, items)}
          >
            Print / Save PDF
          </button>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>

      <iframe
        className="sales-invoice-frame"
        title={`Bill ${order.orderNumber}`}
        srcDoc={invoiceHtml(order, customer, items, { autoPrint: false })}
        ref={frameRef}
        onLoad={(event) => {
          const frame = event.currentTarget;
          fitFrameToContent(frame);
          // Measure again once the font has loaded and the bill has its final height.
          frame.contentDocument?.fonts?.ready.then(() => fitFrameToContent(frame));
        }}
      />
    </div>
  );
}
