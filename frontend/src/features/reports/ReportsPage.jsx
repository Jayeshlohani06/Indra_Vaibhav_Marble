import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getFinancialSummary,
  getPaymentDateSummary,
  getSupplierOutstanding,
} from "../../services/api/reportApi";
import "./ReportsPage.css";

const dateString = (date) => date.toISOString().slice(0, 10);
const monthStart = () => {
  const date = new Date();
  return dateString(new Date(date.getFullYear(), date.getMonth(), 1));
};
const today = dateString(new Date());
const currency = (value) => Number(value || 0).toLocaleString("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function ReportsPage() {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState(null);
  const [supplierOutstanding, setSupplierOutstanding] = useState([]);
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
    const [supplierResult, paymentResult] = await Promise.allSettled([
      getSupplierOutstanding(),
      getPaymentDateSummary(),
    ]);
    if (supplierResult.status === "fulfilled") {
      const data = supplierResult.value;
      setSupplierOutstanding(Array.isArray(data) ? data : data?.data || []);
    } else {
      setSupplierOutstanding([]);
      setSupportError(supplierResult.reason?.message || "Unable to load supplier outstanding report.");
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
    () => [...supplierOutstanding].sort((a, b) => Number(b.outstandingBalance || 0) - Number(a.outstandingBalance || 0)).slice(0, 5),
    [supplierOutstanding]
  );

  function setPreset(preset) {
    const current = new Date();
    if (preset === "month") {
      setStartDate(monthStart());
      setEndDate(today);
    } else if (preset === "last-month") {
      setStartDate(dateString(new Date(current.getFullYear(), current.getMonth() - 1, 1)));
      setEndDate(dateString(new Date(current.getFullYear(), current.getMonth(), 0)));
    } else if (preset === "quarter") {
      setStartDate(dateString(new Date(current.getFullYear(), current.getMonth() - 2, 1)));
      setEndDate(today);
    } else if (preset === "year") {
      setStartDate(`${current.getFullYear()}-01-01`);
      setEndDate(today);
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
      ["Net movement", values.netMovement],
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
        <div>
          <p className="reports-eyebrow">BUSINESS INTELLIGENCE</p>
          <h1>Reports</h1>
          <p>Understand sales, purchasing, expenses, and supplier obligations in one view.</p>
        </div>
        <button className="reports-secondary-button" type="button" onClick={exportSummary} disabled={!report}>Export summary</button>
      </header>

      <form className="reports-filter" onSubmit={loadReport}>
        <div className="reports-presets">
          <button type="button" onClick={() => setPreset("month")}>This month</button>
          <button type="button" onClick={() => setPreset("last-month")}>Last month</button>
          <button type="button" onClick={() => setPreset("quarter")}>Last 3 months</button>
          <button type="button" onClick={() => setPreset("year")}>This year</button>
        </div>
        <label>Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
        <label>End date<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label>
        <button className="reports-primary-button" type="submit" disabled={loading}>{loading ? "Generating..." : "Generate report"}</button>
      </form>

      {error && <p className="reports-alert reports-alert-error" role="alert">{error}</p>}
      {supportError && <p className="reports-alert reports-alert-warning" role="alert">{supportError}</p>}
      {loading && <p className="reports-loading">Loading financial report...</p>}

      {report && !loading && (
        <>
          <div className="reports-period"><span>Reporting period</span><strong>{report.startDate} – {report.endDate}</strong><button type="button" onClick={() => { loadReport(); loadSupportingReports(); }}>Refresh all</button></div>
          <section className="reports-kpis">
            <article className="reports-kpi is-sales"><span>Sales order value</span><strong>{currency(values.sales)}</strong><small>{report.salesOrderCount || 0} confirmed orders</small></article>
            <article className="reports-kpi is-purchases"><span>Received purchases</span><strong>{currency(values.purchases)}</strong><small>{report.receivedPurchaseCount || 0} received purchases</small></article>
            <article className="reports-kpi is-expenses"><span>Active expenses</span><strong>{currency(values.expenses)}</strong><small>{report.expenseCount || 0} expense records</small></article>
            <article className={`reports-kpi ${values.netMovement >= 0 ? "is-positive" : "is-negative"}`}><span>Net movement</span><strong>{currency(values.netMovement)}</strong><small>Sales − purchases − expenses</small></article>
          </section>

          <section className="reports-panel reports-breakdown">
            <div className="reports-panel-heading"><div><h2>Financial movement</h2><p>A directional operating view for the selected period.</p></div><strong>{currency(values.totalActivity)} total activity</strong></div>
            {[["Sales", values.sales, "sales"], ["Purchases", values.purchases, "purchases"], ["Expenses", values.expenses, "expenses"]].map(([label, value, type]) => (
              <div className="reports-bar-row" key={type}><div><span>{label}</span><strong>{currency(value)}</strong></div><div className="reports-bar-track"><i className={`reports-bar-fill ${type}`} style={{ width: `${values.totalActivity ? Math.max(2, value / values.totalActivity * 100) : 0}%` }} /></div></div>
            ))}
            <p className="reports-note">Net movement is not net profit. It excludes inventory valuation, receivables, taxes, and other accounting adjustments.</p>
          </section>
        </>
      )}

      <section className="reports-panel">
        <div className="reports-panel-heading"><div><h2>Supplier outstanding</h2><p>Received purchase balances grouped by supplier.</p></div><button className="reports-secondary-button" type="button" onClick={loadSupportingReports} disabled={supportLoading}>{supportLoading ? "Loading..." : "Refresh"}</button></div>
        {!supportLoading && !topSuppliers.length ? <p className="reports-empty">No received purchase balances found.</p> : <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Supplier</th><th>Purchases</th><th>Purchase total</th><th>Paid</th><th>Outstanding</th></tr></thead><tbody>{topSuppliers.map((supplier) => <tr key={supplier.supplierId}><td><strong>{supplier.supplierName}</strong></td><td>{supplier.receivedPurchaseCount}</td><td>{currency(supplier.purchaseTotal)}</td><td>{currency(supplier.totalPaid)}</td><td className="reports-amount-danger">{currency(supplier.outstandingBalance)}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="reports-panel">
        <div className="reports-panel-heading"><div><h2>Payment activity</h2><p>Supplier payments grouped by payment date.</p></div></div>
        {!paymentDateSummary.length ? <p className="reports-empty">No payment records found.</p> : <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Payment date</th><th>Payments</th><th>Total paid</th></tr></thead><tbody>{paymentDateSummary.slice(0, 10).map((item) => <tr key={item.paymentDate}><td>{item.paymentDate}</td><td>{item.paymentCount}</td><td>{currency(item.totalAmount)}</td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}

export default ReportsPage;
