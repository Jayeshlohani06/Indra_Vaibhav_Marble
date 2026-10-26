import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCustomerOutstanding,
  getFinancialSummary,
  getPaymentDateSummary,
  getSupplierOutstanding,
} from "../../services/api/reportApi";
import { formatDate } from "../../utils/format";
import "./ReportsPage.css";

// Format in local time; toISOString() would shift dates back a day in IST.
const dateString = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");
const monthStart = () => {
  const date = new Date();
  return dateString(new Date(date.getFullYear(), date.getMonth(), 1));
};
const today = () => dateString(new Date());
const currency = (value) => Number(value || 0).toLocaleString("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function ReportsPage() {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());
  const [report, setReport] = useState(null);
  const [supplierOutstanding, setSupplierOutstanding] = useState([]);
  const [customerOutstanding, setCustomerOutstanding] = useState([]);
  const [paymentDateSummary, setPaymentDateSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [error, setError] = useState("");
  const [supportError, setSupportError] = useState("");

  const loadReport = useCallback(async (event) => {
    event?.preventDefault();
    if (!startDate || !endDate) {
      setError("Please select both dates.");
      return;
    }
    if (startDate > endDate) {
      setError("Start date must be on or before end date.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await getFinancialSummary(startDate, endDate);
      setReport(response?.data ?? response);
    } catch (err) {
      setReport(null);
      setError(err.message || "Unable to load the financial report.");
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  async function loadSupportingReports() {
    setSupportLoading(true);
    setSupportError("");
    const [supplierResult, paymentResult, customerResult] = await Promise.allSettled([
      getSupplierOutstanding(),
      getPaymentDateSummary(),
      getCustomerOutstanding(),
    ]);
    if (customerResult.status === "fulfilled") {
      const data = customerResult.value;
      setCustomerOutstanding(Array.isArray(data) ? data : data?.data || []);
    } else {
      setCustomerOutstanding([]);
      setSupportError(customerResult.reason?.message || "Unable to load what customers owe.");
    }
    if (supplierResult.status === "fulfilled") {
      const data = supplierResult.value;
      setSupplierOutstanding(Array.isArray(data) ? data : data?.data || []);
    } else {
      setSupplierOutstanding([]);
      setSupportError(supplierResult.reason?.message || "Unable to load what you owe suppliers.");
    }
    if (paymentResult.status === "fulfilled") {
      const data = paymentResult.value;
      setPaymentDateSummary(Array.isArray(data) ? data : data?.data || []);
    } else {
      setPaymentDateSummary([]);
      setSupportError((previous) => previous || paymentResult.reason?.message || "Unable to load payment summary.");
    }
    setSupportLoading(false);
  }

  useEffect(() => {
    loadReport();
    loadSupportingReports();
  }, [loadReport]);

  const values = useMemo(() => {
    const sales = Number(report?.salesOrderTotal || 0);
    const purchases = Number(report?.receivedPurchaseTotal || 0);
    const expenses = Number(report?.expenseTotal || 0);
    const netMovement = sales - purchases - expenses;
    const totalActivity = sales + purchases + expenses;
    return {
      sales,
      purchases,
      expenses,
      netMovement,
      totalActivity,
      collectionRate: sales ? Math.min(100, Math.max(0, (sales - purchases - expenses) / sales * 100)) : 0,
    };
  }, [report]);

  const topSuppliers = useMemo(
    () => [...supplierOutstanding]
      .filter((supplier) => Number(supplier.outstandingBalance || 0) > 0)
      .sort((a, b) => Number(b.outstandingBalance || 0) - Number(a.outstandingBalance || 0)),
    [supplierOutstanding]
  );

  function setPreset(preset) {
    const current = new Date();
    if (preset === "month") {
      setStartDate(monthStart());
      setEndDate(today());
    } else if (preset === "last-month") {
      setStartDate(dateString(new Date(current.getFullYear(), current.getMonth() - 1, 1)));
      setEndDate(dateString(new Date(current.getFullYear(), current.getMonth(), 0)));
    } else if (preset === "quarter") {
      setStartDate(dateString(new Date(current.getFullYear(), current.getMonth() - 2, 1)));
      setEndDate(today());
    } else if (preset === "year") {
      setStartDate(`${current.getFullYear()}-01-01`);
      setEndDate(today());
    }
  }

  function exportSummary() {
    if (!report) return;
    const rows = [
      ["Report", "Financial summary"],
      ["Period", `${report.startDate} to ${report.endDate}`],
      ["Sales orders", report.salesOrderCount],
      ["Sales total", values.sales],
      ["Received purchases", report.receivedPurchaseCount],
      ["Purchase total", values.purchases],
      ["Active expenses", report.expenseCount],
      ["Expense total", values.expenses],
      ["Money in minus money out", values.netMovement],
    ];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financial-report-${report.startDate}-to-${report.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="reports-page">
      <header className="reports-header">
        <p className="reports-intro">Sales, purchases and expenses for any period, and who owes what.</p>
        <button className="reports-secondary-button" type="button" onClick={exportSummary} disabled={!report}>Download summary (CSV)</button>
      </header>

      <form className="reports-filter" onSubmit={loadReport}>
        <div className="reports-presets">
          <button type="button" onClick={() => setPreset("month")}>This month</button>
          <button type="button" onClick={() => setPreset("last-month")}>Last month</button>
          <button type="button" onClick={() => setPreset("quarter")}>Last 3 months</button>
          <button type="button" onClick={() => setPreset("year")}>This year</button>
        </div>
        <label>From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
        <label>To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label>
        <button className="reports-primary-button" type="submit" disabled={loading}>{loading ? "Loading..." : "Apply"}</button>
      </form>

      {error && <p className="reports-alert reports-alert-error" role="alert">{error}</p>}
      {supportError && <p className="reports-alert reports-alert-warning" role="alert">{supportError}</p>}
      {loading && <p className="reports-loading">Loading financial report...</p>}

      {report && !loading && (
        <>
          <div className="reports-period"><span>Showing</span><strong>{formatDate(report.startDate)} – {formatDate(report.endDate)}</strong></div>
          <section className="reports-kpis">
            <article className="reports-kpi is-sales"><span>Sales</span><strong>{currency(values.sales)}</strong><small>{report.salesOrderCount || 0} bills</small></article>
            <article className="reports-kpi is-purchases"><span>Stock bought</span><strong>{currency(values.purchases)}</strong><small>{report.receivedPurchaseCount || 0} supplier bills</small></article>
            <article className="reports-kpi is-expenses"><span>Expenses</span><strong>{currency(values.expenses)}</strong><small>{report.expenseCount || 0} expenses</small></article>
            <article className={`reports-kpi ${values.netMovement >= 0 ? "is-positive" : "is-negative"}`}><span>Money in minus money out</span><strong>{currency(values.netMovement)}</strong><small>Sales − stock bought − expenses</small></article>
          </section>

          <section className="reports-panel reports-breakdown">
            <div className="reports-panel-heading"><div><h2>Where the money went</h2><p>Sales compared with what you spent in this period.</p></div></div>
            {[["Sales", values.sales, "sales"], ["Stock bought", values.purchases, "purchases"], ["Expenses", values.expenses, "expenses"]].map(([label, value, type]) => (
              <div className="reports-bar-row" key={type}><div><span>{label}</span><strong>{currency(value)}</strong></div><div className="reports-bar-track"><i className={`reports-bar-fill ${type}`} style={{ width: `${values.totalActivity ? Math.max(2, value / values.totalActivity * 100) : 0}%` }} /></div></div>
            ))}
            <p className="reports-note">This is not profit: stock still on your shelves and bills not yet paid are not counted.</p>
          </section>
        </>
      )}

      <section className="reports-panel">
        <div className="reports-panel-heading"><div><h2>Customers owe you</h2><p>Bills that are not fully paid yet, biggest first. This is for all time, not just the dates above.</p></div></div>
        {!supportLoading && !customerOutstanding.length ? <p className="reports-empty">Nobody owes you anything right now.</p> : <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Customer</th><th>Phone</th><th>Bills</th><th>Billed</th><th>Paid</th><th>Still to collect</th></tr></thead><tbody>{customerOutstanding.map((customer) => <tr key={customer.customerId}><td><strong>{customer.customerName}</strong></td><td>{customer.phone || "—"}</td><td>{customer.orderCount}</td><td>{currency(customer.orderTotal)}</td><td>{currency(customer.totalPaid)}</td><td className="reports-amount-due">{currency(customer.outstandingBalance)}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="reports-panel">
        <div className="reports-panel-heading"><div><h2>You owe suppliers</h2><p>Supplier bills that are not fully paid yet. This is for all time.</p></div></div>
        {!supportLoading && !topSuppliers.length ? <p className="reports-empty">All suppliers are paid.</p> : <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Supplier</th><th>Bills</th><th>Billed</th><th>Paid</th><th>Still to pay</th></tr></thead><tbody>{topSuppliers.map((supplier) => <tr key={supplier.supplierId}><td><strong>{supplier.supplierName}</strong></td><td>{supplier.receivedPurchaseCount}</td><td>{currency(supplier.purchaseTotal)}</td><td>{currency(supplier.totalPaid)}</td><td className="reports-amount-danger">{currency(supplier.outstandingBalance)}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="reports-panel">
        <div className="reports-panel-heading"><div><h2>Payments to suppliers</h2><p>How much you paid suppliers on each day.</p></div></div>
        {!paymentDateSummary.length ? <p className="reports-empty">No payment records found.</p> : <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Date</th><th>Payments</th><th>Total paid</th></tr></thead><tbody>{paymentDateSummary.slice(0, 10).map((item) => <tr key={item.paymentDate}><td>{formatDate(item.paymentDate)}</td><td>{item.paymentCount}</td><td>{currency(item.totalAmount)}</td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}

export default ReportsPage;
