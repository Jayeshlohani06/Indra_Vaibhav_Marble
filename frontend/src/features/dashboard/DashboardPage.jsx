
import { useCallback, useEffect, useState } from "react";

import { getProducts } from "../../services/api/inventoryApi";
import { getCustomers } from "../../services/api/customerApi";
import { getFinancialSummary, getSupplierOutstanding } from "../../services/api/reportApi";

import "./DashboardPage.css";
import { usePermission } from "../../auth/PermissionsContext";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value ?? 0));
}

function getArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.content)) return response.content;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function getObject(response) {
  return response?.data ?? response ?? {};
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getToday() {
  return formatLocalDate(new Date());
}

function getWeekStart() {
  const today = new Date();
  const day = today.getDay();
  const daysSinceMonday = (day + 6) % 7;

  today.setDate(today.getDate() - daysSinceMonday);
  return formatLocalDate(today);
}

function getMonthStart() {
  const today = new Date();
  today.setDate(1);
  return formatLocalDate(today);
}

function formatLiveDateTime(date) {
  return {
    date: date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  };
}

const modules = [
  {
    icon: "▦",
    title: "Inventory",
    description: "Manage marble, granite, tiles and sanitaryware.",
    href: "#inventory",
  },
  {
    icon: "♙",
    title: "Customers",
    description: "View customer records and contact information.",
    href: "#customers",
  },
  {
    icon: "₹",
    title: "Sales & Billing",
    description: "Create sales orders and manage billing.",
    href: "#billing",
  },
  {
    icon: "⇄",
    title: "Purchases",
    description: "Manage supplier purchases and payment history.",
    href: "#purchases",
  },
  {
    icon: "₹",
    title: "Expenses",
    description: "Track business expenses.",
    href: "#expenses",
  },
  {
    icon: "▤",
    title: "Reports",
    description: "Review financial performance and supplier dues.",
    href: "#reports",
  },
];

function DashboardPage() {
  const canManageSales = usePermission("SALES_MANAGE");
  const [dashboard, setDashboard] = useState({
    loading: true,
    error: "",
    todaySales: null,
    weekSales: null,
    financial: null,
    supplierOutstanding: null,
    products: [],
    customers: [],
  });
  const [currentDateTime, setCurrentDateTime] = useState(() =>
    formatLiveDateTime(new Date())
  );

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentDateTime(formatLiveDateTime(new Date()));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashboard((previous) => ({
      ...previous,
      loading: true,
      error: "",
    }));

    const results = await Promise.allSettled([
      getFinancialSummary(getToday(), getToday()),
      getFinancialSummary(getWeekStart(), getToday()),
      getFinancialSummary(getMonthStart(), getToday()),
      getSupplierOutstanding(),
      getProducts(),
      getCustomers(),
    ]);

    const [
      todaySalesResult,
      weekSalesResult,
      financialResult,
      supplierResult,
      productsResult,
      customersResult,
    ] = results;

    const errors = [];
    const todaySales = todaySalesResult.status === "fulfilled"
      ? getObject(todaySalesResult.value)
      : null;

    const weekSales = weekSalesResult.status === "fulfilled"
      ? getObject(weekSalesResult.value)
      : null;

    const financial = financialResult.status === "fulfilled"
      ? getObject(financialResult.value)
      : null;

    const supplierRows = supplierResult.status === "fulfilled"
      ? getArray(supplierResult.value)
      : null;

    const products = productsResult.status === "fulfilled"
      ? getArray(productsResult.value)
      : null;

    const customers = customersResult.status === "fulfilled"
      ? getArray(customersResult.value)
      : null;

    if (!todaySales) errors.push("Today's sales");
    if (!weekSales) errors.push("This week's sales");
    if (!financial) errors.push("Monthly financial summary");
    if (!supplierRows) errors.push("Supplier outstanding");
    if (!products) errors.push("Inventory");
    if (!customers) errors.push("Customers");

    setDashboard({
      loading: false,
      error: errors.length
        ? `Could not load: ${errors.join(", ")}. Check your connection or open the relevant module to retry.`
        : "",
      todaySales,
      weekSales,
      financial,
      supplierOutstanding: supplierRows,
      products: products ?? [],
      customers: customers ?? [],
    });
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const {
    loading,
    error,
    todaySales,
    weekSales,
    financial,
    supplierOutstanding,
    products,
    customers,
  } = dashboard;

  const activeProducts = products.filter(
    (product) => product.active !== false && product.isActive !== false
  );

  const lowStockProducts = activeProducts.filter((product) => {
    const quantity = Number(product.stockQuantity ?? 0);
    const threshold = Number(product.lowStockThreshold ?? 0);
    return threshold > 0 && quantity <= threshold;
  });
  const outOfStockProducts = activeProducts.filter(
    (product) => Number(product.stockQuantity ?? 0) <= 0
  );

  const supplierDues = (supplierOutstanding ?? []).reduce(
    (sum, supplier) => sum + Number(supplier.outstandingBalance ?? 0),
    0
  );

  const salesTotal = Number(financial?.salesOrderTotal ?? 0);
  const purchaseTotal = Number(financial?.receivedPurchaseTotal ?? 0);
  const expenseTotal = Number(financial?.expenseTotal ?? 0);
  const netMovement = salesTotal - purchaseTotal - expenseTotal;
  const supplierCount = supplierOutstanding?.length ?? 0;

  const summaryCards = [
    {
      title: "Supplier Dues",
      value: supplierOutstanding ? formatCurrency(supplierDues) : "—",
      note: "Outstanding on received purchases",
      icon: "↗",
      tone: "dues",
    },
    {
      title: "Active Products",
      value: products ? activeProducts.length.toLocaleString("en-IN") : "—",
      note: products ? `${lowStockProducts.length} low-stock products` : "Inventory records",
      icon: "▦",
      tone: "inventory",
    },
    {
      title: "Customers",
      value: customers ? customers.length.toLocaleString("en-IN") : "—",
      note: "Customer records returned by API",
      icon: "♙",
      tone: "customers",
    },
    {
      title: "Net Movement",
      value: financial ? formatCurrency(netMovement) : "—",
      note: "Sales less purchases and expenses",
      icon: "↗",
      tone: netMovement >= 0 ? "positive" : "negative",
    },
  ];

  return (
    <div className="dashboard-content">
      <section className="erp-live-panel" aria-label="Current date and time">
        <div className="erp-live-indicator">
          <span className="erp-live-dot" />
          <span>LIVE</span>
        </div>

        <div className="erp-live-date">
          <span className="erp-live-label">TODAY</span>
          <strong>{currentDateTime.date}</strong>
        </div>

        <div className="erp-live-clock">
          <span className="erp-live-label">CURRENT TIME</span>
          <strong>{currentDateTime.time}</strong>
        </div>
      </section>

      <section className="erp-welcome">
        <div className="erp-welcome-copy">
          <p className="erp-eyebrow">INDRA VAIBHAV MARBLE · BUSINESS OVERVIEW</p>
          <h2>Your business, at a glance.</h2>
          <p>
            Monitor your sales, inventory, supplier dues and day-to-day business
            activity from one place.
          </p>
          <div className="erp-welcome-actions">
            {canManageSales && <a href="#billing" className="erp-primary-action">
              + Create a sales order
            </a>}
            <a href="#reports" className="erp-secondary-action">
              View reports <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
        <div className="erp-welcome-mark" aria-hidden="true">
          <span>IV</span>
          <small>MARBLE</small>
        </div>
      </section>

      {error && (
        <div className="erp-dashboard-alert" role="alert">
          <div>
            <strong>Some dashboard data is unavailable.</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={loadDashboard}>
            Try again
          </button>
        </div>
      )}

      <section className="erp-section erp-sales-period-section">
        <div className="erp-section-heading">
          <div>
            <p className="erp-eyebrow">SALES PERFORMANCE</p>
            <h2>Sales at a glance</h2>
            <p>Compare sales for today, this week and this month.</p>
          </div>
          <a className="erp-text-link" href="#reports">
            View reports <span aria-hidden="true">→</span>
          </a>
        </div>

        <div className="erp-sales-period-grid">
          <article className="erp-sales-period-card today">
            <div className="erp-sales-period-heading">
              <span className="erp-sales-period-icon">☀</span>
              <span className="erp-sales-period-tag">TODAY</span>
            </div>
            <p className="erp-sales-period-title">Today's sales</p>
            <h3>
              {loading
                ? "Loading…"
                : todaySales
                  ? formatCurrency(todaySales.salesOrderTotal)
                  : "Unavailable"}
            </h3>
            <p className="erp-sales-period-note">
              {todaySales
                ? `${todaySales.salesOrderCount ?? 0} sales orders`
                : "Sales data unavailable"}
            </p>
          </article>

          <article className="erp-sales-period-card week">
            <div className="erp-sales-period-heading">
              <span className="erp-sales-period-icon">▦</span>
              <span className="erp-sales-period-tag">THIS WEEK</span>
            </div>
            <p className="erp-sales-period-title">Weekly sales</p>
            <h3>
              {loading
                ? "Loading…"
                : weekSales
                  ? formatCurrency(weekSales.salesOrderTotal)
                  : "Unavailable"}
            </h3>
            <p className="erp-sales-period-note">
              {weekSales
                ? `${weekSales.salesOrderCount ?? 0} sales orders · Monday to today`
                : "Sales data unavailable"}
            </p>
          </article>

          <article className="erp-sales-period-card month">
            <div className="erp-sales-period-heading">
              <span className="erp-sales-period-icon">₹</span>
              <span className="erp-sales-period-tag">THIS MONTH</span>
            </div>
            <p className="erp-sales-period-title">Monthly sales</p>
            <h3>
              {loading
                ? "Loading…"
                : financial
                  ? formatCurrency(financial.salesOrderTotal)
                  : "Unavailable"}
            </h3>
            <p className="erp-sales-period-note">
              {financial
                ? `${financial.salesOrderCount ?? 0} sales orders`
                : "Sales data unavailable"}
            </p>
          </article>
        </div>
      </section>

      <section className="erp-summary-grid" aria-label="Business summaries">
        {summaryCards.map((card) => (
          <article className={`erp-summary-card ${card.tone}`} key={card.title}>
            <div className="erp-summary-top">
              <span>{card.title}</span>
              <span className="erp-summary-icon" aria-hidden="true">
                {card.icon}
              </span>
            </div>
            <h3>{loading ? "Loading…" : card.value}</h3>
            <p>{loading ? "Fetching latest data" : card.note}</p>
          </article>
        ))}
      </section>

      <section className="erp-section erp-attention-section">
        <div className="erp-section-heading">
          <div>
            <p className="erp-eyebrow">ACTION CENTER</p>
            <h2>Needs your attention</h2>
            <p>Operational signals to review before they affect daily work.</p>
          </div>
        </div>

        <div className="erp-attention-grid">
          <a className={`erp-attention-card ${outOfStockProducts.length ? "is-warning" : "is-clear"}`} href="#inventory">
            <span className="erp-attention-icon">!</span>
            <div>
              <strong>{loading ? "…" : outOfStockProducts.length}</strong>
              <span>Out-of-stock products</span>
              <small>{outOfStockProducts.length ? "Review replenishment now" : "No products are out of stock"}</small>
            </div>
            <span className="erp-attention-arrow">→</span>
          </a>
          <a className={`erp-attention-card ${lowStockProducts.length ? "is-warning" : "is-clear"}`} href="#inventory">
            <span className="erp-attention-icon">▦</span>
            <div>
              <strong>{loading ? "…" : lowStockProducts.length}</strong>
              <span>Low-stock products</span>
              <small>{lowStockProducts.length ? "Check reorder requirements" : "Stock levels look healthy"}</small>
            </div>
            <span className="erp-attention-arrow">→</span>
          </a>
          <a className={`erp-attention-card ${supplierDues > 0 ? "is-warning" : "is-clear"}`} href="#reports">
            <span className="erp-attention-icon">₹</span>
            <div>
              <strong>{loading ? "…" : formatCurrency(supplierDues)}</strong>
              <span>Supplier dues</span>
              <small>{supplierDues > 0 ? `${supplierCount} suppliers with received-purchase balances` : "No outstanding supplier balance"}</small>
            </div>
            <span className="erp-attention-arrow">→</span>
          </a>
        </div>
      </section>

      <section className="erp-section">
        <div className="erp-section-heading">
          <div>
            <p className="erp-eyebrow">QUICK ACCESS</p>
            <h2>Business modules</h2>
            <p>Jump directly to the area you want to manage.</p>
          </div>
        </div>

        <div className="erp-module-grid">
          {modules.map((module) => (
            <a className="erp-module-card" key={module.title} href={module.href}>
              <div className="erp-module-icon" aria-hidden="true">
                {module.icon}
              </div>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              <span className="erp-module-arrow">
                Open module <span aria-hidden="true">→</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="erp-section">
        <div className="erp-section-heading">
          <div>
            <p className="erp-eyebrow">CURRENT MONTH</p>
            <h2>Financial snapshot</h2>
            <p>Based on transactions dated from the first day of this month through today.</p>
          </div>
          <a className="erp-text-link" href="#reports">
            Full reports <span aria-hidden="true">→</span>
          </a>
        </div>

        <div className="erp-financial-grid">
          <article className="erp-financial-card">
            <div className="erp-financial-label">
              <span className="erp-financial-dot sales-dot" />
              Sales total
            </div>
            <h3>{loading ? "Loading…" : financial ? formatCurrency(salesTotal) : "Unavailable"}</h3>
            <p>{financial?.salesOrderCount ?? "—"} eligible sales orders</p>
          </article>
          <article className="erp-financial-card">
            <div className="erp-financial-label">
              <span className="erp-financial-dot purchase-dot" />
              Received purchases
            </div>
            <h3>{loading ? "Loading…" : financial ? formatCurrency(purchaseTotal) : "Unavailable"}</h3>
            <p>{financial?.receivedPurchaseCount ?? "—"} received purchases</p>
          </article>
          <article className="erp-financial-card">
            <div className="erp-financial-label">
              <span className="erp-financial-dot expense-dot" />
              Expenses
            </div>
            <h3>{loading ? "Loading…" : financial ? formatCurrency(expenseTotal) : "Unavailable"}</h3>
            <p>{financial?.expenseCount ?? "—"} recorded expenses</p>
          </article>
          <article className={`erp-financial-card ${netMovement >= 0 ? "movement-positive" : "movement-negative"}`}>
            <div className="erp-financial-label">
              <span className="erp-financial-dot movement-dot" />
              Net movement
            </div>
            <h3>{loading ? "Loading…" : financial ? formatCurrency(netMovement) : "Unavailable"}</h3>
            <p>Sales less received purchases and expenses</p>
          </article>
        </div>
        <p className="erp-dashboard-footnote">
          These figures represent transaction totals, not necessarily cash collected
          or paid. Sales exclude draft and cancelled orders.
        </p>
      </section>

      <section className="erp-section erp-stock-section">
        <div className="erp-section-heading">
          <div>
            <p className="erp-eyebrow">INVENTORY HEALTH</p>
            <h2>Stock overview</h2>
            <p>Products at or below their configured low-stock threshold.</p>
          </div>
          <a className="erp-text-link" href="#inventory">
            Manage inventory <span aria-hidden="true">→</span>
          </a>
        </div>

        <div className="erp-stock-overview">
          <div className="erp-stock-stat">
            <span className="erp-stock-stat-icon">▦</span>
            <div>
              <p>Active products</p>
              <strong>{loading ? "…" : products ? activeProducts.length : "Unavailable"}</strong>
            </div>
          </div>
          <div className="erp-stock-stat">
            <span className="erp-stock-stat-icon warning">!</span>
            <div>
              <p>Low-stock products</p>
              <strong>{loading ? "…" : products ? lowStockProducts.length : "Unavailable"}</strong>
            </div>
          </div>
          <div className="erp-stock-stat">
            <span className="erp-stock-stat-icon">♙</span>
            <div>
              <p>Customer records</p>
              <strong>{loading ? "…" : customers ? customers.length : "Unavailable"}</strong>
            </div>
          </div>
        </div>

        {products && lowStockProducts.length > 0 && (
          <div className="erp-low-stock-list">
            <div className="erp-low-stock-heading">
              <strong>Low-stock items to review</strong>
              <span>{lowStockProducts.length} items</span>
            </div>
            {lowStockProducts.slice(0, 5).map((product) => (
              <div className="erp-low-stock-row" key={product.id ?? product.productCode}>
                <div>
                  <strong>{product.name ?? "Unnamed product"}</strong>
                  <span>{product.productCode ?? "No product code"}</span>
                </div>
                <div className="erp-low-stock-quantity">
                  <strong>{product.stockQuantity ?? 0}</strong>
                  <span>Threshold: {product.lowStockThreshold ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {products && lowStockProducts.length === 0 && (
          <div className="erp-stock-clear">
            <span aria-hidden="true">✓</span>
            No active products are at or below a positive low-stock threshold.
          </div>
        )}
      </section>

      <footer className="erp-footer">
        Indra Vaibhav Marble ERP <span>·</span> Dashboard
        <span className="erp-footer-date">
          {currentDateTime.date} · {currentDateTime.time}
        </span>
      </footer>
    </div>
  );
}

export default DashboardPage;
