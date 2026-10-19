
import { useState } from "react";
import {
  getFinancialSummary,
  getSupplierOutstanding,
  getPaymentDateSummary,
} from "../../services/api/reportApi";
import "./ReportsPage.css";

function getDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthStart() {
  const now = new Date();
  return getDateString(new Date(now.getFullYear(), now.getMonth(), 1));
}

const TODAY = getDateString(new Date());

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function ReportsPage() {
  const [startDate, setStartDate] = useState(getMonthStart());
  const [endDate, setEndDate] = useState(TODAY);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [supplierOutstanding, setSupplierOutstanding] = useState([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierError, setSupplierError] = useState("");
  const [paymentDateSummary, setPaymentDateSummary] = useState([]);
  const [paymentDateLoading, setPaymentDateLoading] = useState(false);
  const [paymentDateError, setPaymentDateError] = useState("");

  async function loadReport(event) {
    event?.preventDefault();
    setError("");

    if (!startDate || !endDate) {
      setError("Please select both dates.");
      return;
    }

    if (startDate > endDate) {
      setError("Start date must be on or before end date.");
      return;
    }

    try {
      setLoading(true);
      const response = await getFinancialSummary(startDate, endDate);
      setReport(response?.data ?? response);
    } catch (err) {
      setError(err.message || "Unable to load the financial report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadSupplierOutstanding() {
    try {
      setSupplierLoading(true);
      setSupplierError("");

      const response = await getSupplierOutstanding();
      const data = response?.data ?? response;

      setSupplierOutstanding(Array.isArray(data) ? data : []);
    } catch (err) {
      setSupplierError(
        err.message || "Unable to load supplier outstanding report."
      );
      setSupplierOutstanding([]);
    } finally {
      setSupplierLoading(false);
    }
  }

  async function loadPaymentDateSummary() {
    try {
      setPaymentDateLoading(true);
      setPaymentDateError("");

      const response = await getPaymentDateSummary();
      const data = response?.data ?? response;

      setPaymentDateSummary(Array.isArray(data) ? data : []);
    } catch (err) {
      setPaymentDateError(
        err.message || "Unable to load payment-date summary."
      );
      setPaymentDateSummary([]);
    } finally {
      setPaymentDateLoading(false);
    }
  }

  return (
    <section className="reports-page">
      <header className="reports-header">
        <div>
          <h1>Financial Reports</h1>
          <p>Review sales orders, received purchases, and recorded expenses.</p>
        </div>
      </header>

      <form className="reports-filter" onSubmit={loadReport}>
        <label>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </label>

        <label>
          End date
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Generating..." : "Generate Report"}
        </button>
      </form>

      {error && <p className="reports-error" role="alert">{error}</p>}

      {!report && !loading && !error && (
        <div className="reports-empty">
          Select a date range and choose Generate Report.
        </div>
      )}

      {loading && <p className="reports-loading">Loading financial report...</p>}

      {report && !loading && (
        <>
          <div className="reports-period">
            Report period: {report.startDate} to {report.endDate}
          </div>

          <div className="reports-grid">
            <article className="reports-card">
              <span>Sales Order Total</span>
              <strong>{formatCurrency(report.salesOrderTotal)}</strong>
              <small>{report.salesOrderCount ?? 0} orders</small>
            </article>

            <article className="reports-card">
              <span>Received Purchase Total</span>
              <strong>{formatCurrency(report.receivedPurchaseTotal)}</strong>
              <small>{report.receivedPurchaseCount ?? 0} purchases</small>
            </article>

            <article className="reports-card">
              <span>Recorded Expenses</span>
              <strong>{formatCurrency(report.expenseTotal)}</strong>
              <small>{report.expenseCount ?? 0} expenses</small>
            </article>
          </div>

          <p className="reports-note">
            These figures represent transaction totals, not actual collections,
            cash flow, or net profit.
          </p>
        </>
      )}

      <section className="supplier-outstanding-section">
        <div className="supplier-outstanding-header">
          <div>
            <h2>Supplier Outstanding Report</h2>
            <p>Track purchase amounts, payments made, and balances due.</p>
          </div>

          <button
            type="button"
            onClick={loadSupplierOutstanding}
            disabled={supplierLoading}
          >
            {supplierLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {supplierError && (
          <p className="reports-error" role="alert">
            {supplierError}
          </p>
        )}

        {supplierLoading && (
          <p className="reports-loading">
            Loading supplier outstanding balances...
          </p>
        )}

        {!supplierLoading &&
          !supplierError &&
          supplierOutstanding.length === 0 && (
            <p className="reports-empty">
              No received purchases found for the supplier outstanding report.
            </p>
          )}

        {!supplierLoading && supplierOutstanding.length > 0 && (
          <div className="supplier-outstanding-table-wrapper">
            <table className="supplier-outstanding-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Received Purchases</th>
                  <th>Purchase Total</th>
                  <th>Total Paid</th>
                  <th>Outstanding Balance</th>
                </tr>
              </thead>

              <tbody>
                {supplierOutstanding.map((supplier) => (
                  <tr key={supplier.supplierId}>
                    <td>{supplier.supplierName}</td>
                    <td>{supplier.receivedPurchaseCount}</td>
                    <td>{formatCurrency(supplier.purchaseTotal)}</td>
                    <td>{formatCurrency(supplier.totalPaid)}</td>
                    <td className="supplier-outstanding-amount">
                      {formatCurrency(supplier.outstandingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="supplier-outstanding-section">
        <div className="supplier-outstanding-header">
          <div>
            <h2>Payment Date Summary</h2>
            <p>Review supplier payments grouped by payment date.</p>
          </div>

          <button
            type="button"
            onClick={loadPaymentDateSummary}
            disabled={paymentDateLoading}
          >
            {paymentDateLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {paymentDateError && (
          <p className="reports-error" role="alert">
            {paymentDateError}
          </p>
        )}

        {paymentDateLoading && (
          <p className="reports-loading">
            Loading payment-date summary...
          </p>
        )}

        {!paymentDateLoading &&
          !paymentDateError &&
          paymentDateSummary.length === 0 && (
            <p className="reports-empty">
              No payment records found.
            </p>
          )}

        {!paymentDateLoading && paymentDateSummary.length > 0 && (
          <div className="supplier-outstanding-table-wrapper">
            <table className="supplier-outstanding-table">
              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>Number of Payments</th>
                  <th>Total Amount Paid</th>
                </tr>
              </thead>

              <tbody>
                {paymentDateSummary.map((item) => (
                  <tr key={item.paymentDate}>
                    <td>{item.paymentDate}</td>
                    <td>{item.paymentCount}</td>
                    <td>{formatCurrency(item.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default ReportsPage;
