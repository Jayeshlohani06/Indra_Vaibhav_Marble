import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCustomerOutstanding,
  getFinancialSummary,
  getMonthlyProfit,
  getPaymentDateSummary,
  getPaymentReminders,
  getSupplierOutstanding,
} from "../../services/api/reportApi";
import { formatDate } from "../../utils/format";
import { whatsappLink } from "../../utils/whatsapp";
import { t } from "../../i18n";
import "./ReportsPage.css";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";

import FitText from "../../components/FitText";
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

const monthLabel = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

// Customers whose oldest unpaid bill is older than the chosen number of days,
// with a ready-to-send WhatsApp reminder.
function PaymentReminders() {
  const [minDays, setMinDays] = useState(30);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    getPaymentReminders(minDays)
      .then((response) => { if (!cancelled) { setRows(Array.isArray(response) ? response : []); setError(""); } })
      .catch((err) => { if (!cancelled) { setRows([]); setError(err.message || t("Unable to load reminders.")); } });
    return () => { cancelled = true; };
  }, [minDays]);

  const message = (row) => [
    `Namaste ${row.customerName},`,
    `This is a reminder from Indra Vaibhav Marble. ${currency(row.amountDue)} is pending on ${row.unpaidBills} ${row.unpaidBills === 1 ? "bill" : "bills"}, the oldest from ${formatDate(row.oldestBillDate)}.`,
    "Please pay at your earliest convenience. Thank you!",
  ].join("\n");

  return (
    <section className="reports-panel">
      <div className="reports-panel-heading">
        <div><h2>{t("Payment reminders")}</h2><p>{t("Customers with bills unpaid for a long time. Tap \"Remind\" to send a WhatsApp message.")}</p></div>
        <label className="reports-inline-select">{t("Unpaid for more than")}
          <select value={minDays} onChange={(event) => setMinDays(Number(event.target.value))}>
            <option value={15}>{t("{count} days", { count: 15 })}</option><option value={30}>{t("{count} days", { count: 30 })}</option><option value={60}>{t("{count} days", { count: 60 })}</option><option value={90}>{t("{count} days", { count: 90 })}</option>
          </select>
        </label>
      </div>
      {error && <p className="reports-alert reports-alert-error" role="alert">{error}</p>}
      {!rows ? <Skeleton label={t("Loading…")} /> : !rows.length ? <EmptyState icon="check" text={t("No customer has bills unpaid for more than {count} days.", { count: minDays })} /> : (
        <div className="reports-table-wrap"><table className="reports-table stack-on-phone"><thead><tr><th>{t("Customer")}</th><th>{t("Phone")}</th><th className="num">{t("Unpaid bills")}</th><th>{t("Oldest bill")}</th><th className="num">{t("Still to collect")}</th><th><span className="visually-hidden">{t("Remind")}</span></th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.customerId}>
              <td data-label={t("Customer")}><strong>{row.customerName}</strong></td>
              <td data-label={t("Phone")}>{row.phone || "—"}</td>
              <td className="num" data-label={t("Unpaid bills")}>{row.unpaidBills}</td>
              <td data-label={t("Oldest bill")}>{formatDate(row.oldestBillDate)} <small className="reports-muted">({t("{count} days", { count: row.daysOverdue })})</small></td>
              <td className="reports-amount-due num" data-label={t("Still to collect")}>{currency(row.amountDue)}</td>
              <td><a className="reports-whatsapp" href={whatsappLink(row.phone, message(row))} target="_blank" rel="noopener noreferrer">{t("Remind")}</a></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}

// Rough profit for the last six months.
function MonthlyProfit() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    getMonthlyProfit(dateString(new Date(now.getFullYear(), now.getMonth() - 5, 1)), today())
      .then((response) => { if (!cancelled) setRows(Array.isArray(response) ? response : []); })
      .catch((err) => { if (!cancelled) { setRows([]); setError(err.message || t("Unable to load profit.")); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="reports-panel">
      <div className="reports-panel-heading"><div><h2>{t("Profit by month (estimate)")}</h2><p>{t("Sales without GST, minus returns, minus what the goods cost you, minus expenses. GST and TDS payments are not counted as costs.")}</p></div></div>
      {error && <p className="reports-alert reports-alert-error" role="alert">{error}</p>}
      {!rows ? <Skeleton label={t("Loading…")} /> : !rows.length ? <EmptyState text={t("No data yet.")} /> : (
        <div className="reports-table-wrap"><table className="reports-table stack-on-phone"><thead><tr><th>{t("Month")}</th><th className="num">{t("Sales (no GST)")}</th><th className="num">{t("Returns")}</th><th className="num">{t("Cost of goods")}</th><th className="num">{t("Expenses")}</th><th className="num">{t("Profit")}</th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.month}>
              <td data-label={t("Month")}><strong>{monthLabel(row.month)}</strong></td>
              <td className="num" data-label={t("Sales (no GST)")}>{currency(row.sales)}</td>
              <td className="num" data-label={t("Returns")}>{currency(row.returns)}</td>
              <td className="num" data-label={t("Cost of goods")}>{currency(row.costOfGoods)}</td>
              <td className="num" data-label={t("Expenses")}>{currency(row.expenses)}</td>
              <td className={`${Number(row.estimatedProfit) < 0 ? "reports-amount-danger" : "reports-amount-good"} num`} data-label={t("Profit")}><strong>{currency(row.estimatedProfit)}</strong></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="reports-note">{t("Cost of goods uses each product's current purchase price, so treat this as a close guide, not your accountant's figure.")}</p>
    </section>
  );
}

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
      setError(t("Please select both dates."));
      return;
    }
    if (startDate > endDate) {
      setError(t("Start date must be on or before end date."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await getFinancialSummary(startDate, endDate);
      setReport(response?.data ?? response);
    } catch (err) {
      setReport(null);
      setError(err.message || t("Unable to load the financial report."));
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
      setSupportError(customerResult.reason?.message || t("Unable to load what customers owe."));
    }
    if (supplierResult.status === "fulfilled") {
      const data = supplierResult.value;
      setSupplierOutstanding(Array.isArray(data) ? data : data?.data || []);
    } else {
      setSupplierOutstanding([]);
      setSupportError(supplierResult.reason?.message || t("Unable to load what you owe suppliers."));
    }
    if (paymentResult.status === "fulfilled") {
      const data = paymentResult.value;
      setPaymentDateSummary(Array.isArray(data) ? data : data?.data || []);
    } else {
      setPaymentDateSummary([]);
      setSupportError((previous) => previous || paymentResult.reason?.message || t("Unable to load payment summary."));
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
        <p className="reports-intro">{t("Sales, purchases and expenses for any period, and who owes what.")}</p>
        <button className="reports-secondary-button" type="button" onClick={exportSummary} disabled={!report}>{t("Download summary (CSV)")}</button>
      </header>

      <form className="reports-filter" onSubmit={loadReport}>
        <div className="reports-presets">
          <button type="button" onClick={() => setPreset("month")}>{t("This month")}</button>
          <button type="button" onClick={() => setPreset("last-month")}>{t("Last month")}</button>
          <button type="button" onClick={() => setPreset("quarter")}>{t("Last 3 months")}</button>
          <button type="button" onClick={() => setPreset("year")}>{t("This year")}</button>
        </div>
        <label>{t("From")}<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
        <label>{t("To")}<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label>
        <button className="reports-primary-button" type="submit" disabled={loading}>{loading ? t("Loading...") : t("Apply")}</button>
      </form>

      {error && <p className="reports-alert reports-alert-error" role="alert">{error}</p>}
      {supportError && <p className="reports-alert reports-alert-warning" role="alert">{supportError}</p>}
      {loading && <Skeleton label={t("Loading financial report...")} rows={4} />}

      {report && !loading && (
        <>
          <div className="reports-period"><span>{t("Showing")}</span><strong>{formatDate(report.startDate)} – {formatDate(report.endDate)}</strong></div>
          <section className="reports-kpis">
            <article className="reports-kpi is-sales"><span>{t("Sales")}</span><FitText>{currency(values.sales)}</FitText><small>{t("{count} bills", { count: report.salesOrderCount || 0 })}</small></article>
            <article className="reports-kpi is-purchases"><span>{t("Stock bought")}</span><FitText>{currency(values.purchases)}</FitText><small>{t("{count} supplier bills", { count: report.receivedPurchaseCount || 0 })}</small></article>
            <article className="reports-kpi is-expenses"><span>{t("Expenses")}</span><FitText>{currency(values.expenses)}</FitText><small>{t("{count} expenses", { count: report.expenseCount || 0 })}</small></article>
            <article className={`reports-kpi ${values.netMovement >= 0 ? "is-positive" : "is-negative"}`}><span>{t("Money in minus money out")}</span><FitText>{currency(values.netMovement)}</FitText><small>{t("Sales − stock bought − expenses")}</small></article>
          </section>

          <section className="reports-panel reports-breakdown">
            <div className="reports-panel-heading"><div><h2>{t("Where the money went")}</h2><p>{t("Sales compared with what you spent in this period.")}</p></div></div>
            {[["Sales", values.sales, "sales"], ["Stock bought", values.purchases, "purchases"], ["Expenses", values.expenses, "expenses"]].map(([label, value, type]) => (
              <div className="reports-bar-row" key={type}><div><span>{t(label)}</span><strong>{currency(value)}</strong></div><div className="reports-bar-track"><i className={`reports-bar-fill ${type}`} style={{ width: `${values.totalActivity ? Math.max(2, value / values.totalActivity * 100) : 0}%` }} /></div></div>
            ))}
            <p className="reports-note">{t("This is not profit: stock still on your shelves and bills not yet paid are not counted.")}</p>
          </section>
        </>
      )}

      <section className="reports-panel">
        <div className="reports-panel-heading"><div><h2>{t("Customers owe you")}</h2><p>{t("Bills that are not fully paid yet, biggest first. This is for all time, not just the dates above.")}</p></div></div>
        {!supportLoading && !customerOutstanding.length ? <p className="reports-empty">{t("Nobody owes you anything right now.")}</p> : <div className="reports-table-wrap"><table className="reports-table stack-on-phone"><thead><tr><th>{t("Customer")}</th><th>{t("Phone")}</th><th className="num">{t("Bills")}</th><th className="num">{t("Billed")}</th><th className="num">{t("Paid")}</th><th className="num">{t("Still to collect")}</th></tr></thead><tbody>{customerOutstanding.map((customer) => <tr key={customer.customerId}><td data-label={t("Customer")}><strong>{customer.customerName}</strong></td><td data-label={t("Phone")}>{customer.phone || "—"}</td><td className="num" data-label={t("Bills")}>{customer.orderCount}</td><td className="num" data-label={t("Billed")}>{currency(customer.orderTotal)}</td><td className="num" data-label={t("Paid")}>{currency(customer.totalPaid)}</td><td className="reports-amount-due num" data-label={t("Still to collect")}>{currency(customer.outstandingBalance)}</td></tr>)}</tbody></table></div>}
      </section>

      <PaymentReminders />

      <MonthlyProfit />

      <section className="reports-panel">
        <div className="reports-panel-heading"><div><h2>{t("You owe suppliers")}</h2><p>{t("Supplier bills that are not fully paid yet. This is for all time.")}</p></div></div>
        {!supportLoading && !topSuppliers.length ? <p className="reports-empty">{t("All suppliers are paid.")}</p> : <div className="reports-table-wrap"><table className="reports-table stack-on-phone"><thead><tr><th>{t("Supplier")}</th><th className="num">{t("Bills")}</th><th className="num">{t("Billed")}</th><th className="num">{t("Paid")}</th><th className="num">{t("Still to pay")}</th></tr></thead><tbody>{topSuppliers.map((supplier) => <tr key={supplier.supplierId}><td data-label={t("Supplier")}><strong>{supplier.supplierName}</strong></td><td className="num" data-label={t("Bills")}>{supplier.receivedPurchaseCount}</td><td className="num" data-label={t("Billed")}>{currency(supplier.purchaseTotal)}</td><td className="num" data-label={t("Paid")}>{currency(supplier.totalPaid)}</td><td className="reports-amount-danger num" data-label={t("Still to pay")}>{currency(supplier.outstandingBalance)}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="reports-panel">
        <div className="reports-panel-heading"><div><h2>{t("Payments to suppliers")}</h2><p>{t("How much you paid suppliers on each day.")}</p></div></div>
        {!paymentDateSummary.length ? <p className="reports-empty">{t("No payment records found.")}</p> : <div className="reports-table-wrap"><table className="reports-table stack-on-phone"><thead><tr><th>{t("Date")}</th><th className="num">{t("Payments")}</th><th className="num">{t("Total paid")}</th></tr></thead><tbody>{paymentDateSummary.slice(0, 10).map((item) => <tr key={item.paymentDate}><td data-label={t("Date")}>{formatDate(item.paymentDate)}</td><td className="num" data-label={t("Payments")}>{item.paymentCount}</td><td className="num" data-label={t("Total paid")}>{currency(item.totalAmount)}</td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}

export default ReportsPage;
