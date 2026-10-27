import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closeCashDay,
  getCashDay,
  getCashDays,
  getCashMovements,
  getCashToday,
  getCashbook,
  getExpenseCategoryReport,
  getStaffPaymentReport,
  openCashDay,
  recordCashMovement,
  reopenCashDay,
  voidCashMovement,
} from "../../services/api/cashApi";
import { usePermission } from "../../auth/PermissionsContext";
import { formatDate, formatDateTime, label } from "../../utils/format";
import "./CashBookPage.css";

const currency = (value) => Number(value || 0).toLocaleString("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
});
// Local date; toISOString() would give yesterday's date before 05:30 IST.
const isoDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");
const today = () => isoDate(new Date());
const monthStart = () => { const d = new Date(); return isoDate(new Date(d.getFullYear(), d.getMonth(), 1)); };
const newRequestId = () => (globalThis.crypto?.randomUUID
  ? globalThis.crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (c ^ (Math.random() * 16) >> (c / 4)).toString(16)));
// Whole rupees and paise only, as the server accepts.
const isMoney = (text) => /^\d+(\.\d{1,2})?$/.test(String(text).trim());
// Paise as integers so totals never pick up floating-point error.
const toPaise = (value) => Math.round(Number(value || 0) * 100);
const fromPaise = (paise) => paise / 100;
const csvCell = (value) => {
  const text = String(value ?? "");
  const isFormula = /^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?$/.test(text);
  return `"${(isFormula ? `'${text}` : text).replaceAll("\"", "\"\"")}"`;
};
const COUNT_DRAFT_KEY = (sessionId) => `cash-count-draft-${sessionId}`;

const MOVEMENT_TYPES = [
  ["OWNER_CASH_IN", "Owner put cash in", false],
  ["OWNER_CASH_OUT", "Owner took cash out", false],
  ["BANK_DEPOSIT", "Deposited cash in bank", false],
  ["BANK_WITHDRAWAL", "Withdrew cash from bank", false],
  ["ADJUSTMENT_IN", "Correction: add cash", true],
  ["ADJUSTMENT_OUT", "Correction: remove cash", true],
];

function differenceText(difference) {
  if (difference === null || difference === undefined) return "—";
  const value = Number(difference);
  if (value === 0) return "Matches";
  return value < 0 ? `${currency(-value)} short` : `${currency(value)} extra`;
}

function differenceClass(difference) {
  const value = Number(difference || 0);
  if (difference === null || difference === undefined) return "";
  return value === 0 ? "is-match" : value < 0 ? "is-short" : "is-extra";
}

function CashBookPage() {
  const [tab, setTab] = useState("today");
  return (
    <main className="cash-page">
      <header className="cash-header">
        <p className="cash-intro">Open the drawer each morning, count it each evening, and see where every rupee came from.</p>
        <div className="cash-tabs" role="tablist" aria-label="Cash book sections">
          {[["today", "Today"], ["history", "Past days"], ["reports", "Reports"]].map(([key, text]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key}
              className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{text}</button>
          ))}
        </div>
      </header>
      {tab === "today" && <TodayTab />}
      {tab === "history" && <HistoryTab />}
      {tab === "reports" && <ReportsTab />}
    </main>
  );
}

function TodayTab() {
  const canManage = usePermission("CASH_MANAGE");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await getCashToday();
      setData(response);
      setError("");
    } catch (err) {
      setError(err.message || "The cash book could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="cash-muted">Loading today's cash…</p>;
  if (!data) return <p className="cash-alert is-error" role="alert">{error}</p>;

  const open = data.openSession;
  const staleDay = open && open.session.businessDate < data.today;

  return (
    <>
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      {success && <p className="cash-alert is-success" role="status">{success}</p>}
      {data.lockedThrough && (
        <p className="cash-lock-note">Closed up to <strong>{formatDate(data.lockedThrough)}</strong>. Payments and expenses can no longer be dated on or before that day.</p>
      )}
      {!open ? (
        canManage
          ? <OpenDayCard data={data} onOpened={() => { setSuccess("Day opened."); load(); }} />
          : <p className="cash-empty">Today has not been opened yet. The owner opens the day.</p>
      ) : (
        <>
          {staleDay && (
            <p className="cash-alert is-warning" role="alert">
              {formatDate(open.session.businessDate)} was never closed. Count the drawer now and close that day before opening today.
              Count before taking in any new cash, because entries dated today belong to the next day.
            </p>
          )}
          <DaySummary detail={open} />
          {canManage && <MovementForm onSaved={(message) => { setSuccess(message); load(); }} />}
          <EntriesPanel lines={open.lines} />
          {canManage && (
            <ClosePanel
              detail={open}
              threshold={data.approvalThreshold}
              denominations={data.denominations}
              onClosed={() => { setSuccess(`${formatDate(open.session.businessDate)} is closed.`); load(); }}
              onStale={load}
            />
          )}
        </>
      )}
    </>
  );
}

function OpenDayCard({ data, onOpened }) {
  const suggested = data.suggestedOpening;
  const [amount, setAmount] = useState(suggested !== null && suggested !== undefined ? String(Number(suggested)) : "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const differs = suggested !== null && suggested !== undefined && isMoney(amount)
    && toPaise(amount) !== toPaise(suggested);

  async function submit(event) {
    event.preventDefault();
    if (!isMoney(amount)) { setError("Enter the opening cash, for example 5000 or 5000.50."); return; }
    if (differs && !note.trim()) { setError("Say why the opening cash differs from the last count."); return; }
    setSaving(true); setError("");
    try {
      await openCashDay(amount.trim(), note.trim() || null);
      onOpened();
    } catch (err) {
      setError(err.message || "The day could not be opened.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="cash-panel cash-open" onSubmit={submit} noValidate>
      <div className="cash-panel-heading">
        <div>
          <h2>Open {formatDate(data.today)}</h2>
          <p>{data.lastClosed
            ? `Last closed ${formatDate(data.lastClosed.businessDate)} with ${currency(suggested)} counted.`
            : "First day of the cash book. Count the drawer and enter what is in it. Earlier payments are not part of the cash book."}</p>
        </div>
      </div>
      <div className="cash-form-grid">
        <label>Opening cash (₹)
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={Boolean(error) && !isMoney(amount)} />
        </label>
        <label className="cash-wide">Note {differs ? "(required: it differs from the last count)" : "(optional)"}
          <input maxLength="500" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </div>
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      <div className="cash-actions"><button type="submit" className="cash-primary" disabled={saving}>{saving ? "Opening…" : "Open the day"}</button></div>
    </form>
  );
}

function DaySummary({ detail }) {
  const { session, summary } = detail;
  const flows = summary.cash;
  const multiDay = session.periodStart !== session.businessDate;
  return (
    <>
      <div className="cash-period">
        <span className={`cash-status is-${session.status.toLowerCase()}`}>{label(session.status)}</span>
        <strong>{formatDate(session.businessDate)}</strong>
        {multiDay && <span>includes entries from {formatDate(session.periodStart)}</span>}
        <span>Opened by {session.openedBy} at {formatDateTime(session.openedAt)}</span>
      </div>
      <section className="cash-kpis">
        <article><span>Opening cash</span><strong>{currency(summary.openingBalance)}</strong><small>{session.openingNote || "Counted at opening"}</small></article>
        <article className="is-in"><span>Cash in</span><strong>{currency(flows.totalIn)}</strong><small>Sales, collections and cash added</small></article>
        <article className="is-out"><span>Cash out</span><strong>{currency(flows.totalOut)}</strong><small>Payments, expenses, refunds and deposits</small></article>
        <article className="is-expected"><span>Should be in drawer</span><strong>{currency(summary.expectedCash)}</strong><small>Opening + in − out</small></article>
      </section>
      <section className="cash-panel">
        <div className="cash-panel-heading"><div><h2>Cash drawer</h2><p>Only cash. UPI, bank and card are listed below and never change the drawer.</p></div></div>
        <div className="cash-flows">
          <dl>
            <dt>Paid in cash on new bills</dt><dd>{currency(flows.saleReceipts)}</dd>
            <dt>Collected in cash on old bills</dt><dd>{currency(flows.collections)}</dd>
            <dt>Owner put cash in</dt><dd>{currency(flows.ownerCashIn)}</dd>
            <dt>Withdrawn from bank</dt><dd>{currency(flows.bankWithdrawals)}</dd>
            <dt>Corrections (in)</dt><dd>{currency(flows.adjustmentsIn)}</dd>
            <dt className="is-total">Total in</dt><dd className="is-total">{currency(flows.totalIn)}</dd>
          </dl>
          <dl>
            <dt>Paid to suppliers</dt><dd>{currency(flows.supplierPayments)}</dd>
            <dt>Cash expenses</dt><dd>{currency(flows.expenses)}</dd>
            <dt>Cash refunds</dt><dd>{currency(flows.refunds)}</dd>
            <dt>Deposited in bank</dt><dd>{currency(flows.bankDeposits)}</dd>
            <dt>Owner took cash out</dt><dd>{currency(flows.ownerCashOut)}</dd>
            <dt>Corrections (out)</dt><dd>{currency(flows.adjustmentsOut)}</dd>
            <dt className="is-total">Total out</dt><dd className="is-total">{currency(flows.totalOut)}</dd>
          </dl>
        </div>
      </section>
      <section className="cash-panel">
        <div className="cash-panel-heading"><div><h2>By payment method</h2><p>Check UPI, bank and card against your statements.</p></div></div>
        <div className="cash-table-wrap">
          <table className="cash-table">
            <thead><tr><th>Method</th><th>New bills</th><th>Old bills</th><th>Refunds</th><th>Suppliers</th><th>Expenses</th><th>Net</th></tr></thead>
            <tbody>{summary.byMethod.map((row) => (
              <tr key={row.paymentMethod}><td><strong>{label(row.paymentMethod)}</strong></td><td>{currency(row.saleReceipts)}</td><td>{currency(row.collections)}</td><td>{currency(row.refunds)}</td><td>{currency(row.supplierPayments)}</td><td>{currency(row.expenses)}</td><td><strong>{currency(row.net)}</strong></td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="cash-not-cash">
          <p><span>Bills raised</span><strong>{currency(summary.billsRaised)}</strong></p>
          <p><span>Of which still unpaid (credit)</span><strong>{currency(summary.billsStillUnpaid)}</strong></p>
          <p><span>Stock received</span><strong>{currency(summary.purchasesReceived)}</strong></p>
          <p><span>Of which still to pay</span><strong>{currency(summary.purchasesStillUnpaid)}</strong></p>
        </div>
        <p className="cash-note">Bills and stock received are not money in or out until they are paid. None of this is profit.</p>
      </section>
    </>
  );
}

function EntriesPanel({ lines }) {
  const [cashOnly, setCashOnly] = useState(true);
  const visible = cashOnly ? lines.filter((line) => line.paymentMethod === "CASH") : lines;
  return (
    <section className="cash-panel">
      <div className="cash-panel-heading">
        <div><h2>Entries</h2><p>Every payment, refund, expense and drawer movement in this day. Use this to find a difference.</p></div>
        <label className="cash-check"><input type="checkbox" checked={cashOnly} onChange={(event) => setCashOnly(event.target.checked)} />Cash only</label>
      </div>
      <LedgerTable lines={visible} empty="No entries yet." />
    </section>
  );
}

function LedgerTable({ lines, empty }) {
  if (!lines.length) return <p className="cash-empty">{empty}</p>;
  return (
    <div className="cash-table-wrap has-mobile-cards">
      <table className="cash-table desktop-table">
        <thead><tr><th>Date</th><th>What</th><th>Bill / ref</th><th>Who</th><th>Method</th><th>In</th><th>Out</th><th>Entered by</th></tr></thead>
        <tbody>{lines.map((line) => {
          const amount = Number(line.amount);
          return (
            <tr key={`${line.source}-${line.sourceId}`}>
              <td>{formatDate(line.date)}</td>
              <td><strong>{label(line.kind)}</strong>{line.detail && <small>{line.detail}</small>}</td>
              <td>{line.reference || "—"}</td>
              <td>{line.party || "—"}</td>
              <td>{label(line.paymentMethod)}</td>
              <td className="cash-in">{amount > 0 ? currency(amount) : ""}</td>
              <td className="cash-out">{amount < 0 ? currency(-amount) : ""}</td>
              <td>{line.createdBy || "—"}</td>
            </tr>
          );
        })}</tbody>
      </table>
      <div className="mobile-cards">{lines.map((line) => {
        const amount = Number(line.amount);
        return (
          <div className="mobile-card" key={`${line.source}-${line.sourceId}`}>
            <span className="mobile-card__row"><span className="mobile-card__title">{label(line.kind)}</span><span className={`mobile-card__amount ${amount < 0 ? "cash-out" : "cash-in"}`}>{amount < 0 ? "−" : "+"}{currency(Math.abs(amount))}</span></span>
            <span className="mobile-card__meta">{formatDate(line.date)} · {label(line.paymentMethod)}{line.party ? ` · ${line.party}` : ""}{line.reference ? ` · ${line.reference}` : ""}</span>
          </div>
        );
      })}</div>
    </div>
  );
}

function MovementForm({ onSaved }) {
  const canApprove = usePermission("CASH_APPROVE");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ movementType: "BANK_DEPOSIT", amount: "", referenceNumber: "", notes: "" });
  const requestId = useRef(newRequestId());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isCorrection = form.movementType.startsWith("ADJUSTMENT");

  function change(event) { setForm((previous) => ({ ...previous, [event.target.name]: event.target.value })); }

  async function submit(event) {
    event.preventDefault();
    if (!isMoney(form.amount) || toPaise(form.amount) <= 0) { setError("Enter an amount above zero."); return; }
    if (isCorrection && form.notes.trim().length < 5) { setError("Explain what this correction is for."); return; }
    setSaving(true); setError("");
    try {
      // No date: the server records it on today's business date (IST).
      await recordCashMovement({ movementDate: null, movementType: form.movementType, amount: form.amount.trim(),
        referenceNumber: form.referenceNumber.trim() || null, notes: form.notes.trim() || null, requestId: requestId.current });
      requestId.current = newRequestId();
      setForm({ movementType: "BANK_DEPOSIT", amount: "", referenceNumber: "", notes: "" });
      setOpen(false);
      onSaved(`${label(form.movementType)}: ${currency(form.amount)} recorded.`);
    } catch (err) {
      setError(err.message || "The movement could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="cash-actions cash-actions--start">
        <button type="button" onClick={() => setOpen(true)}>Record cash added or taken out</button>
      </div>
    );
  }
  return (
    <form className="cash-panel cash-movement" onSubmit={submit} noValidate>
      <div className="cash-panel-heading"><div><h2>Cash added or taken out</h2><p>For money that is not a sale, payment or expense. Record sales, supplier payments and expenses on their own pages.</p></div></div>
      <div className="cash-form-grid">
        <label>What happened
          <select name="movementType" value={form.movementType} onChange={change}>
            {MOVEMENT_TYPES.filter(([, , approval]) => !approval || canApprove).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
        <label>Amount (₹)<input name="amount" inputMode="decimal" value={form.amount} onChange={change} /></label>
        <label>Reference<input name="referenceNumber" maxLength="100" value={form.referenceNumber} onChange={change} placeholder="Deposit slip, etc." /></label>
        <label className="cash-wide">{isCorrection ? "Why is this correction needed? (required)" : "Note (optional)"}
          <input name="notes" maxLength="500" value={form.notes} onChange={change} />
        </label>
      </div>
      {isCorrection && <p className="cash-note">Corrections fix a known mistake, such as a UPI payment entered as cash. Never use one just to make the count match.</p>}
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      <div className="cash-actions">
        <button type="button" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="cash-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

function ClosePanel({ detail, threshold, denominations, onClosed, onStale }) {
  const canApprove = usePermission("CASH_APPROVE");
  const sessionId = detail.session.id;
  const [counts, setCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COUNT_DRAFT_KEY(sessionId)) || "{}"); } catch { return {}; }
  });
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(newRequestId());

  useEffect(() => {
    try { localStorage.setItem(COUNT_DRAFT_KEY(sessionId), JSON.stringify(counts)); } catch { /* draft is a convenience only */ }
  }, [counts, sessionId]);

  const countedPaise = useMemo(() => denominations.reduce((sum, denomination) => {
    const quantity = Number.parseInt(counts[denomination] || "0", 10);
    return sum + (Number.isFinite(quantity) ? quantity : 0) * toPaise(denomination);
  }, 0), [counts, denominations]);
  const expectedPaise = toPaise(detail.summary.expectedCash);
  const differencePaise = countedPaise - expectedPaise;
  const needsOwner = Math.abs(differencePaise) > toPaise(threshold);
  const invalidCount = Object.values(counts).some((value) => value !== "" && !/^\d{1,6}$/.test(String(value)));

  function review() {
    if (invalidCount) { setError("Counts must be whole numbers."); return; }
    if (differencePaise !== 0 && note.trim().length === 0) { setError("Explain the difference before closing."); return; }
    if (needsOwner && !canApprove) { setError(`The difference is more than ${currency(threshold)}. Ask the owner to close the day.`); return; }
    setError(""); setConfirming(true);
  }

  async function close() {
    setSaving(true); setError("");
    try {
      await closeCashDay(sessionId, {
        counts: denominations.map((denomination) => ({ denomination, quantity: Number.parseInt(counts[denomination] || "0", 10) || 0 })),
        note: note.trim() || null,
        expectedCash: detail.summary.expectedCash,
        requestId: requestId.current,
      });
      try { localStorage.removeItem(COUNT_DRAFT_KEY(sessionId)); } catch { /* ignore */ }
      setConfirming(false);
      onClosed();
    } catch (err) {
      setConfirming(false);
      setError(err.message || "The day could not be closed.");
      // New entries arrived while counting: refresh so the expected cash is current.
      if (/changed while you were counting/.test(err.message || "")) onStale();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="cash-panel cash-close">
      <div className="cash-panel-heading"><div><h2>Count the drawer and close</h2><p>Enter how many of each note and coin are in the drawer. Your count is kept on this device until you close.</p></div></div>
      <div className="cash-denominations">
        {denominations.map((denomination) => {
          const quantity = counts[denomination] ?? "";
          const subtotal = (Number.parseInt(quantity || "0", 10) || 0) * Number(denomination);
          return (
            <label key={denomination}>
              <span>₹{Number(denomination)}{Number(denomination) <= 10 ? " coin/note" : ""}</span>
              <input inputMode="numeric" value={quantity} placeholder="0" aria-label={`Number of ₹${Number(denomination)}`}
                onChange={(event) => setCounts((previous) => ({ ...previous, [denomination]: event.target.value.trim() }))} />
              <small>{currency(subtotal)}</small>
            </label>
          );
        })}
      </div>
      <div className="cash-result">
        <p><span>Counted</span><strong>{currency(fromPaise(countedPaise))}</strong></p>
        <p><span>Should be</span><strong>{currency(detail.summary.expectedCash)}</strong></p>
        <p className={differenceClass(fromPaise(differencePaise))}><span>Difference</span><strong>{differenceText(fromPaise(differencePaise))}</strong></p>
      </div>
      <label className="cash-close-note">
        {differencePaise === 0 ? "Note (optional)" : "What caused the difference? (required)"}
        <textarea rows="2" maxLength="1000" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {needsOwner && <p className="cash-note">Differences above {currency(threshold)} need the owner. {canApprove ? "You are approving it by closing." : ""}</p>}
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      <div className="cash-actions"><button type="button" className="cash-primary" onClick={review}>Review and close {formatDate(detail.session.businessDate)}</button></div>

      {confirming && (
        <div className="cash-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setConfirming(false)}>
          <div className="cash-modal" role="dialog" aria-modal="true" aria-labelledby="cash-confirm-title">
            <h2 id="cash-confirm-title">Close {formatDate(detail.session.businessDate)}?</h2>
            <div className="cash-result">
              <p><span>Opening</span><strong>{currency(detail.summary.openingBalance)}</strong></p>
              <p><span>Should be</span><strong>{currency(detail.summary.expectedCash)}</strong></p>
              <p><span>Counted</span><strong>{currency(fromPaise(countedPaise))}</strong></p>
              <p className={differenceClass(fromPaise(differencePaise))}><span>Difference</span><strong>{differenceText(fromPaise(differencePaise))}</strong></p>
            </div>
            {note.trim() && <p className="cash-note">{note.trim()}</p>}
            <p className="cash-note">After closing, nothing can be recorded on this day or earlier unless the owner reopens it. Tomorrow opens with {currency(fromPaise(countedPaise))}.</p>
            <div className="cash-actions">
              <button type="button" onClick={() => setConfirming(false)} disabled={saving}>Go back</button>
              <button type="button" className="cash-primary" onClick={close} disabled={saving}>{saving ? "Closing…" : "Close the day"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function HistoryTab() {
  const [range, setRange] = useState({ from: monthStart(), to: today(), withDifference: false });
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getCashDays(range);
      setDays(Array.isArray(response) ? response : []);
      setError("");
    } catch (err) {
      setError(err.message || "Past days could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="cash-filter">
        <label>From<input type="date" value={range.from} onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))} /></label>
        <label>To<input type="date" value={range.to} onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))} /></label>
        <label className="cash-check"><input type="checkbox" checked={range.withDifference} onChange={(event) => setRange((r) => ({ ...r, withDifference: event.target.checked }))} />Only days that did not match</label>
      </div>
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      <section className="cash-panel">
        {loading ? <p className="cash-empty">Loading…</p> : !days.length ? <p className="cash-empty">No days in this range.</p> : (
          <div className="cash-table-wrap has-mobile-cards">
            <table className="cash-table desktop-table">
              <thead><tr><th>Day</th><th>Status</th><th>Opening</th><th>Should be</th><th>Counted</th><th>Difference</th><th>Closed by</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>{days.map((day) => (
                <tr key={day.id}>
                  <td><strong>{formatDate(day.businessDate)}</strong>{day.reopenCount > 0 && <small>Reopened {day.reopenCount}×</small>}</td>
                  <td><span className={`cash-status is-${day.status.toLowerCase()}`}>{label(day.status)}</span></td>
                  <td>{currency(day.openingBalance)}</td>
                  <td>{day.expectedCash === null ? "—" : currency(day.expectedCash)}</td>
                  <td>{day.countedCash === null ? "—" : currency(day.countedCash)}</td>
                  <td className={differenceClass(day.difference)}>{differenceText(day.difference)}</td>
                  <td>{day.closedBy || "—"}</td>
                  <td><button type="button" onClick={() => setSelected(day.id)}>View</button></td>
                </tr>
              ))}</tbody>
            </table>
            <div className="mobile-cards">{days.map((day) => (
              <button type="button" className="mobile-card" key={day.id} onClick={() => setSelected(day.id)}>
                <span className="mobile-card__row"><span className="mobile-card__title">{formatDate(day.businessDate)}</span><span className={`cash-status is-${day.status.toLowerCase()}`}>{label(day.status)}</span></span>
                <span className="mobile-card__meta">Counted {day.countedCash === null ? "—" : currency(day.countedCash)} · <span className={differenceClass(day.difference)}>{differenceText(day.difference)}</span></span>
              </button>
            ))}</div>
          </div>
        )}
      </section>
      {selected && <DayModal sessionId={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </>
  );
}

function DayModal({ sessionId, onClose, onChanged }) {
  const canApprove = usePermission("CASH_APPROVE");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCashDay(sessionId)
      .then((response) => { if (!cancelled) setDetail(response); })
      .catch((err) => { if (!cancelled) setError(err.message || "This day could not be loaded."); });
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    function handleKey(event) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function reopen() {
    if (!reason.trim()) { setError("Give a reason for reopening."); return; }
    setReopening(true); setError("");
    try {
      setDetail(await reopenCashDay(sessionId, reason.trim()));
      setReason("");
      onChanged();
    } catch (err) {
      setError(err.message || "The day could not be reopened.");
    } finally {
      setReopening(false);
    }
  }

  const session = detail?.session;
  return (
    <div className="cash-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="cash-modal cash-modal--wide" role="dialog" aria-modal="true" aria-labelledby="cash-day-title">
        <div className="cash-modal-heading">
          <h2 id="cash-day-title">{session ? formatDate(session.businessDate) : "Day"}</h2>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        {error && <p className="cash-alert is-error" role="alert">{error}</p>}
        {!detail ? <p className="cash-empty">Loading…</p> : (
          <>
            <div className="cash-result">
              <p><span>Opening</span><strong>{currency(session.openingBalance)}</strong></p>
              <p><span>Should be</span><strong>{session.expectedCash === null ? currency(detail.summary.expectedCash) : currency(session.expectedCash)}</strong></p>
              <p><span>Counted</span><strong>{session.countedCash === null ? "—" : currency(session.countedCash)}</strong></p>
              <p className={differenceClass(session.difference)}><span>Difference</span><strong>{differenceText(session.difference)}</strong></p>
            </div>
            {session.closingNote && <p className="cash-note"><b>Explanation:</b> {session.closingNote}</p>}
            {session.openingNote && <p className="cash-note"><b>Opening note:</b> {session.openingNote}</p>}
            {session.approvedBy && <p className="cash-note">Difference approved by {session.approvedBy}.</p>}
            {session.counts.length > 0 && (
              <div className="cash-count-list">{session.counts.map((line) => (
                <span key={line.denomination}>₹{Number(line.denomination)} × {line.quantity}</span>
              ))}</div>
            )}
            <h3>Entries</h3>
            <LedgerTable lines={detail.lines} empty="No entries on this day." />
            <h3>History</h3>
            <ul className="cash-history">{detail.history.map((entry, index) => (
              <li key={index}><strong>{label(entry.action)}</strong> by {entry.actor || "—"} · {formatDateTime(entry.occurredAt)}{entry.reason ? ` — ${entry.reason}` : ""}</li>
            ))}</ul>
            {canApprove && session.status === "CLOSED" && (
              <div className="cash-reopen">
                <label>Reason for reopening<input maxLength="1000" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: a UPI payment was missed" /></label>
                <button type="button" className="is-danger" onClick={reopen} disabled={reopening}>{reopening ? "Reopening…" : "Reopen this day"}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReportsTab() {
  const canManage = usePermission("CASH_MANAGE");
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [report, setReport] = useState("cashbook");
  const [filters, setFilters] = useState({ paymentMethod: "CASH", kind: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (range.from > range.to) { setError("Start date must be on or before end date."); return; }
    setLoading(true); setError("");
    try {
      if (report === "cashbook") setData(await getCashbook({ ...range, ...filters }));
      else if (report === "expenses") setData(await getExpenseCategoryReport(range));
      else if (report === "staff") setData(await getStaffPaymentReport(range));
      else setData(await getCashMovements(range));
    } catch (err) {
      setData(null);
      setError(err.message || "The report could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters, range, report]);

  useEffect(() => { load(); }, [load]);

  async function cancelMovement(movement) {
    const reason = window.prompt(`Why are you cancelling this ${label(movement.movementType).toLowerCase()} of ${currency(movement.amount)}?`);
    if (!reason?.trim()) return;
    try { await voidCashMovement(movement.id, reason.trim()); await load(); } catch (err) { setError(err.message || "Could not cancel."); }
  }

  function exportCashbook() {
    const header = ["Date", "Entry", "Detail", "Bill/ref", "Who", "Method", "Amount", "Entered by"];
    const lines = data.lines.map((line) => [line.date, label(line.kind), line.detail, line.reference, line.party, line.paymentMethod, line.amount, line.createdBy].map(csvCell).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `cash-book-${range.from}-to-${range.to}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="cash-filter">
        <label>Report
          <select value={report} onChange={(event) => { setData(null); setReport(event.target.value); }}>
            <option value="cashbook">Cash book entries</option>
            <option value="expenses">Expenses by category</option>
            <option value="staff">Staff salary and advances</option>
            <option value="movements">Cash added, taken out and corrections</option>
          </select>
        </label>
        <label>From<input type="date" value={range.from} onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))} /></label>
        <label>To<input type="date" value={range.to} onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))} /></label>
        {report === "cashbook" && (
          <>
            <label>Method
              <select value={filters.paymentMethod} onChange={(event) => setFilters((f) => ({ ...f, paymentMethod: event.target.value }))}>
                <option value="">All methods</option>
                {["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"].map((method) => <option key={method} value={method}>{label(method)}</option>)}
              </select>
            </label>
            <label>Entry
              <select value={filters.kind} onChange={(event) => setFilters((f) => ({ ...f, kind: event.target.value }))}>
                <option value="">All entries</option>
                {["SALE_RECEIPT", "COLLECTION", "REFUND", "SUPPLIER_PAYMENT", "EXPENSE", "OWNER_CASH_IN", "OWNER_CASH_OUT", "BANK_DEPOSIT", "BANK_WITHDRAWAL", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"].map((kind) => <option key={kind} value={kind}>{label(kind)}</option>)}
              </select>
            </label>
            <button type="button" onClick={exportCashbook} disabled={!data?.lines?.length}>Download CSV</button>
          </>
        )}
      </div>
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      {loading && <p className="cash-muted">Loading…</p>}
      {!loading && data && report === "cashbook" && data.lines && (
        <section className="cash-panel">
          <div className="cash-panel-heading"><div><h2>Cash book</h2><p>{data.lines.length} entries. Cash in {currency(data.summary.cash.totalIn)}, cash out {currency(data.summary.cash.totalOut)}, net change in the drawer {currency(data.summary.expectedCash)}.</p></div></div>
          <LedgerTable lines={data.lines} empty="No entries match." />
        </section>
      )}
      {!loading && Array.isArray(data) && report === "expenses" && <ExpenseReport rows={data} />}
      {!loading && Array.isArray(data) && report === "staff" && <StaffReport rows={data} />}
      {!loading && Array.isArray(data) && report === "movements" && (
        <section className="cash-panel">
          {!data.length ? <p className="cash-empty">No cash added or taken out in this range.</p> : (
            <div className="cash-table-wrap">
              <table className="cash-table">
                <thead><tr><th>Date</th><th>What</th><th>Amount</th><th>Note</th><th>By</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                <tbody>{data.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDate(movement.movementDate)}</td>
                    <td><strong>{label(movement.movementType)}</strong>{movement.referenceNumber && <small>Ref: {movement.referenceNumber}</small>}</td>
                    <td>{currency(movement.amount)}</td>
                    <td>{movement.notes || "—"}{movement.voidReason && <small>Cancelled: {movement.voidReason}</small>}</td>
                    <td>{movement.createdBy}{movement.approvedBy && <small>Approved by {movement.approvedBy}</small>}</td>
                    <td>{movement.status === "VOIDED" ? "Cancelled" : "Recorded"}</td>
                    <td>{canManage && movement.status !== "VOIDED" && <button type="button" className="is-danger" onClick={() => cancelMovement(movement)}>Cancel</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function ExpenseReport({ rows }) {
  const groups = useMemo(() => {
    const result = new Map();
    rows.forEach((row) => {
      const group = result.get(row.groupName) || { total: 0, rows: [] };
      group.total += toPaise(row.total);
      group.rows.push(row);
      result.set(row.groupName, group);
    });
    return [...result.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [rows]);
  const total = groups.reduce((sum, [, group]) => sum + group.total, 0);
  if (!rows.length) return <section className="cash-panel"><p className="cash-empty">No expenses in this range.</p></section>;
  return (
    <section className="cash-panel">
      <div className="cash-panel-heading"><div><h2>Expenses by category</h2><p>Total {currency(fromPaise(total))}. Cancelled expenses are left out.</p></div></div>
      <div className="cash-table-wrap">
        <table className="cash-table">
          <thead><tr><th>Category</th><th>Paid by</th><th>Count</th><th>Total</th></tr></thead>
          <tbody>{groups.map(([name, group]) => [
            <tr key={name} className="cash-group-row"><td colSpan="3"><strong>{name}</strong></td><td><strong>{currency(fromPaise(group.total))}</strong></td></tr>,
            ...group.rows.map((row) => <tr key={`${name}-${row.category}-${row.paymentMethod}`}><td>{row.category}</td><td>{label(row.paymentMethod)}</td><td>{row.count}</td><td>{currency(row.total)}</td></tr>),
          ])}</tbody>
        </table>
      </div>
    </section>
  );
}

function StaffReport({ rows }) {
  if (!rows.length) return <section className="cash-panel"><p className="cash-empty">No staff payments in this range.</p></section>;
  return (
    <section className="cash-panel">
      <div className="cash-panel-heading"><div><h2>Staff salary and advances</h2><p>An advance is salary paid early, so salary + advances is what each person received for the month.</p></div></div>
      <div className="cash-table-wrap">
        <table className="cash-table">
          <thead><tr><th>Staff</th><th>Month</th><th>Advances</th><th>Salary</th><th>Other pay</th><th>Total received</th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={`${row.staffMemberId}-${row.salaryPeriod}`}>
              <td><strong>{row.staffName}</strong></td>
              <td>{row.salaryPeriod ? new Date(`${row.salaryPeriod}T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—"}</td>
              <td>{currency(row.advances)}</td><td>{currency(row.salary)}</td><td>{currency(row.otherPayments)}</td><td><strong>{currency(row.total)}</strong></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

export default CashBookPage;
