
import { useCallback, useEffect, useState } from "react";

import { getProducts } from "../../services/api/inventoryApi";
import {
  getCustomerOutstanding,
  getFinancialSummary,
  getSupplierOutstanding,
} from "../../services/api/reportApi";

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

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function DashboardPage() {
  const canManageSales = usePermission("SALES_MANAGE");
  const canReadReports = usePermission("REPORT_READ");
  const canReadProducts = usePermission("PRODUCT_READ");
  const [dashboard, setDashboard] = useState({
    loading: true,
    error: "",
    todaySales: null,
    weekSales: null,
    financial: null,
    supplierOutstanding: null,
    customerOutstanding: null,
    products: [],
  });

  const loadDashboard = useCallback(async () => {
    setDashboard((previous) => ({
      ...previous,
      loading: true,
      error: "",
    }));

    const skipped = Promise.resolve(null);
    const results = await Promise.allSettled([
      canReadReports ? getFinancialSummary(getToday(), getToday()) : skipped,
      canReadReports ? getFinancialSummary(getWeekStart(), getToday()) : skipped,
      canReadReports ? getFinancialSummary(getMonthStart(), getToday()) : skipped,
      canReadReports ? getSupplierOutstanding() : skipped,
      canReadReports ? getCustomerOutstanding() : skipped,
      canReadProducts ? getProducts() : skipped,
    ]);

    const [
      todaySalesResult,
      weekSalesResult,
      financialResult,
      supplierResult,
      customerResult,
      productsResult,
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

    const customerRows = customerResult.status === "fulfilled"
      ? getArray(customerResult.value)
      : null;

    if (canReadReports && !todaySales) errors.push("Today's sales");
    if (canReadReports && !weekSales) errors.push("This week's sales");
    if (canReadReports && !financial) errors.push("This month's sales");
    if (canReadReports && !supplierRows) errors.push("Supplier dues");
    if (canReadReports && !customerRows) errors.push("Customer dues");
    if (canReadProducts && !products) errors.push("Stock");

    setDashboard({
      loading: false,
      error: errors.length
        ? `Could not load: ${errors.join(", ")}. Check your internet connection and press “Try again”.`
        : "",
      todaySales,
      weekSales,
      financial,
      supplierOutstanding: supplierRows,
      customerOutstanding: customerRows,
      products: products ?? [],
    });
  }, [canReadProducts, canReadReports]);

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
    customerOutstanding,
    products,
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

  const supplierCount = supplierOutstanding?.length ?? 0;
  const customerDues = (customerOutstanding ?? []).reduce(
    (sum, customer) => sum + Number(customer.outstandingBalance ?? 0),
    0
  );
  const customerCount = customerOutstanding?.length ?? 0;
  const unpricedProducts = activeProducts.filter(
    (product) => Number(product.sellingPrice ?? 0) <= 0
  );

  const salesCards = [
    { key: "today", tag: "Today", data: todaySales },
    { key: "week", tag: "This week", data: weekSales },
    { key: "month", tag: "This month", data: financial },
  ];

  const attentionItems = [
    outOfStockProducts.length > 0 && {
      key: "out",
      href: "#inventory",
      icon: "!",
      title: `${outOfStockProducts.length} ${outOfStockProducts.length === 1 ? "product is" : "products are"} out of stock`,
      detail: outOfStockProducts.slice(0, 3).map((product) => product.name).join(", "),
    },
    lowStockProducts.length > 0 && {
      key: "low",
      href: "#inventory",
      icon: "▦",
      title: `${lowStockProducts.length} ${lowStockProducts.length === 1 ? "product is" : "products are"} running low`,
      detail: lowStockProducts.slice(0, 3).map((product) => product.name).join(", "),
    },
    unpricedProducts.length > 0 && {
      key: "price",
      href: "#inventory",
      icon: "₹",
      title: `${unpricedProducts.length} ${unpricedProducts.length === 1 ? "product has" : "products have"} no selling price`,
      detail: "Set prices so they fill in on bills automatically",
    },
  ].filter(Boolean);

  return (
    <div className="dashboard-content">
      <section className="erp-welcome">
        <div className="erp-welcome-copy">
          <p className="erp-welcome-date">{todayLabel()}</p>
          <h2>{greeting()}</h2>
          <p>Here is how the shop is doing today.</p>
          <div className="erp-welcome-actions">
            {canManageSales && <a href="#billing" className="erp-primary-action">
              + New sale
            </a>}
            {canReadReports && <a href="#reports" className="erp-secondary-action">
              See reports <span aria-hidden="true">→</span>
            </a>}
          </div>
        </div>
      </section>

      {error && (
        <div className="erp-dashboard-alert" role="alert">
          <div>
            <strong>Some numbers could not be loaded.</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={loadDashboard}>
            Try again
          </button>
        </div>
      )}

      {canReadReports && (
        <section className="erp-section erp-sales-period-section">
          <div className="erp-section-heading">
            <div>
              <h2>Sales</h2>
            </div>
          </div>

          <div className="erp-sales-period-grid">
            {salesCards.map((card) => (
              <article className={`erp-sales-period-card ${card.key}`} key={card.key}>
                <p className="erp-sales-period-title">{card.tag}</p>
                <h3>
                  {loading
                    ? "Loading…"
                    : card.data
                      ? formatCurrency(card.data.salesOrderTotal)
                      : "Unavailable"}
                </h3>
                <p className="erp-sales-period-note">
                  {card.data
                    ? `${card.data.salesOrderCount ?? 0} ${Number(card.data.salesOrderCount) === 1 ? "bill" : "bills"}`
                    : " "}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {canReadReports && (
        <section className="erp-section">
          <div className="erp-section-heading">
            <div>
              <h2>Money owed</h2>
            </div>
          </div>
          <div className="erp-money-grid">
            <a className="erp-money-card is-in" href="#customers">
              <span>Customers owe you</span>
              <strong>{loading ? "Loading…" : formatCurrency(customerDues)}</strong>
              <small>
                {customerCount
                  ? `From ${customerCount} ${customerCount === 1 ? "customer" : "customers"} · see who`
                  : "Nobody owes you right now"}
              </small>
            </a>
            <a className="erp-money-card is-out" href="#purchases">
              <span>You owe suppliers</span>
              <strong>{loading ? "Loading…" : formatCurrency(supplierDues)}</strong>
              <small>
                {supplierCount
                  ? `To ${supplierCount} ${supplierCount === 1 ? "supplier" : "suppliers"} · see bills`
                  : "All suppliers are paid"}
              </small>
            </a>
          </div>
        </section>
      )}

      {canReadProducts && (
        <section className="erp-section erp-attention-section">
          <div className="erp-section-heading">
            <div>
              <h2>Needs your attention</h2>
            </div>
          </div>

          {loading ? (
            <p className="erp-attention-empty">Checking stock…</p>
          ) : attentionItems.length === 0 ? (
            <p className="erp-attention-empty">
              <span aria-hidden="true">✓</span> All good. Nothing needs your attention right now.
            </p>
          ) : (
            <div className="erp-attention-grid">
              {attentionItems.map((item) => (
                <a className="erp-attention-card is-warning" href={item.href} key={item.key}>
                  <span className="erp-attention-icon" aria-hidden="true">{item.icon}</span>
                  <div>
                    <span>{item.title}</span>
                    <small>{item.detail}</small>
                  </div>
                  <span className="erp-attention-arrow" aria-hidden="true">→</span>
                </a>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default DashboardPage;
