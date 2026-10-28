import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closeCashDay,
  getCashActivity,
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
  updateCashSettings,
  voidCashMovement,
} from "../../services/api/cashApi";
import { usePermission } from "../../auth/PermissionsContext";
import { formatDate, formatDateTime, label } from "../../utils/format";
import { newRequestId } from "../../utils/requestId";
import { getLanguage, t } from "../../i18n";
import { whatsappLink } from "../../utils/whatsapp";
import "./CashBookPage.css";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";

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
  if (value === 0) return t("Matches");
  return value < 0 ? t("{amount} short", { amount: currency(-value) }) : t("{amount} extra", { amount: currency(value) });
}

function differenceClass(difference) {
  const value = Number(difference || 0);
  if (difference === null || difference === undefined) return "";
  return value === 0 ? "is-match" : value < 0 ? "is-short" : "is-extra";
}

const DIGITAL_METHODS = [["UPI", "UPI"], ["BANK_TRANSFER", "Bank transfer"], ["CARD", "Card"]];

// Plain text of a closed day, for WhatsApp and printing.
function daySummaryText(detail) {
  const { session, summary } = detail;
  const received = (method) => {
    const row = summary.byMethod.find((item) => item.paymentMethod === method);
    return row ? Number(row.saleReceipts) + Number(row.collections) : 0;
  };
  const lines = [
    `Indra Vaibhav Marble – ${t("Cash book")}`,
    `${formatDate(session.businessDate)}${session.closedBy ? ` · ${t("closed by {name} at {time}", { name: session.closedBy, time: formatDateTime(session.closedAt) })}` : ""}`,
    "",
    `${t("Opening cash")}: ${currency(summary.openingBalance)}`,
    `${t("Cash in")}: ${currency(summary.cash.totalIn)}`,
    `${t("Cash out")}: ${currency(summary.cash.totalOut)}`,
    `  ${t("Cash expenses")}: ${currency(summary.cash.expenses)}`,
    `  ${t("Paid to suppliers")}: ${currency(summary.cash.supplierPayments)}`,
    `${t("Should be in drawer")}: ${currency(session.expectedCash ?? summary.expectedCash)}`,
    `${t("Counted")}: ${session.countedCash === null || session.countedCash === undefined ? "—" : currency(session.countedCash)}`,
    `${t("Difference")}: ${differenceText(session.difference)}`,
  ];
  if (session.closingNote) lines.push(`${t("Reason")}: ${session.closingNote}`);
  lines.push("", `${t("UPI received")}: ${currency(received("UPI"))}`, `${t("Bank transfer received")}: ${currency(received("BANK_TRANSFER"))}`,
    `${t("Card received")}: ${currency(received("CARD"))}`);
  (detail.digitalChecks || []).forEach((check) => {
    lines.push(`${t("{method} as per app/bank", { method: label(check.paymentMethod) })}: ${currency(check.reported)} (${differenceText(check.difference)})`);
  });
  lines.push("", t("Bills made: {total} ({credit} on credit)", { total: currency(summary.billsRaised), credit: currency(summary.billsStillUnpaid) }));
  return lines.join("\n");
}

function printSummary(detail) {
  const win = window.open("", "_blank", "width=480,height=640");
  if (!win) return;
  const pre = win.document.createElement("pre");
  pre.textContent = daySummaryText(detail);
  pre.style.cssText = "font: 14px/1.6 system-ui, sans-serif; white-space: pre-wrap; margin: 24px;";
  win.document.title = `${t("Cash book")} ${detail.session.businessDate}`;
  win.document.body.appendChild(pre);
  win.focus();
  win.print();
}

function ShareButtons({ detail, ownerWhatsapp }) {
  return (
    <div className="cash-share">
      <a className="cash-whatsapp" href={whatsappLink(ownerWhatsapp, daySummaryText(detail))} target="_blank" rel="noopener noreferrer">
        {t("Send summary on WhatsApp")}
      </a>
      <button type="button" onClick={() => printSummary(detail)}>{t("Print summary")}</button>
    </div>
  );
}

function CashBookPage() {
  const canApprove = usePermission("CASH_APPROVE");
  const [tab, setTab] = useState("today");
  const tabs = [["today", "Today"], ["history", "Past days"], ["reports", "Reports"], ["activity", "Activity"],
    ...(canApprove ? [["settings", "Settings"]] : [])];
  return (
    <main className="cash-page">
      <header className="cash-header">
        <p className="cash-intro">{t("Open the drawer each morning, count it each evening, and see where every rupee came from.")}</p>
        <div className="cash-tabs" role="tablist" aria-label={t("Cash book sections")}>
          {tabs.map(([key, text]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key}
              className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{t(text)}</button>
          ))}
        </div>
      </header>
      <HowItWorks />
      {tab === "today" && <TodayTab />}
      {tab === "history" && <HistoryTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "activity" && <ActivityTab />}
      {tab === "settings" && canApprove && <SettingsTab />}
    </main>
  );
}

const HELP_KEY = "cash-help-open";

// Plain-language guide for new staff. Open on the first visit; each person's
// choice to keep it open or closed is remembered on their device.
function HowItWorks() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(HELP_KEY) !== "no"; } catch { return true; }
  });

  function toggle(event) {
    const isOpen = event.currentTarget.open;
    setOpen(isOpen);
    try { localStorage.setItem(HELP_KEY, isOpen ? "yes" : "no"); } catch { /* remembering is optional */ }
  }

  return (
    <details className="cash-help" open={open} onToggle={toggle}>
      <summary>{t("How it works (read this first)")}</summary>
      {getLanguage() === "hi" ? <HelpHindi /> : <div className="cash-help-body">
        <p>Every day, the app checks that the cash in the drawer matches what was sold and spent. You do 3 simple things:</p>
        <ol className="cash-help-steps">
          <li>
            <strong>Morning: open the shop</strong>
            <span>Count the cash in the drawer. Type the amount and press <b>Open the day</b>. Yesterday's cash is already filled in for you.</span>
          </li>
          <li>
            <strong>During the day: work as usual</strong>
            <span>Make bills and take payments as you do now. When you spend money, add it in <b>Expenses</b> and choose <b>Cash</b> or <b>UPI</b>. Only cash is counted in the drawer. UPI and card money goes to the bank.</span>
          </li>
          <li>
            <strong>Evening: count and close</strong>
            <span>Count your notes and coins and type how many of each (use <b>+</b> and <b>−</b>). If it says <b>Matches</b>, press <b>Close the day</b>. If it says <b>Short</b> or <b>Extra</b>, write why, then close. You can also type today's UPI total from your UPI app to check it. After closing, press <b>Send summary on WhatsApp</b> to send it to the owner.</span>
          </li>
        </ol>

        <div className="cash-help-example">
          <strong>Example</strong>
          <p>Morning cash ₹5,000 + cash sales ₹15,000 − tea ₹200 − bike repair ₹800 − supplier paid ₹2,200 = <b>drawer should have ₹16,800</b>.</p>
        </div>

        <strong className="cash-help-title">Which expense to choose</strong>
        <ul className="cash-help-list">
          <li>Tea, snacks, coffee → <b>Tea &amp; snacks</b></li>
          <li>Water bottles → <b>Drinking water</b></li>
          <li>Petrol, diesel → <b>Fuel</b></li>
          <li>Bike repair, puncture, service → <b>Vehicle repairs &amp; servicing</b></li>
          <li>Labour, loading → <b>Loading &amp; unloading</b> or <b>Daily wages &amp; labour</b></li>
          <li>Monthly salary → <b>Salary</b> (choose the staff name and month)</li>
          <li>Money given early to staff → <b>Staff advance</b></li>
          <li>Electricity bill → <b>Electricity</b></li>
          <li>Anything else → <b>Miscellaneous</b> (write what it was)</li>
        </ul>
        <p className="cash-help-tip"><b>Salary tip:</b> if you already gave an advance, enter only the salary you pay now. Salary ₹10,000, advance ₹3,000 already given → enter <b>₹7,000</b>.</p>

        <strong className="cash-help-title">Good to know</strong>
        <ul className="cash-help-list">
          <li>After a day is closed, it is <b>locked</b>. Nothing more can be added to that day.</li>
          <li>Made a mistake after closing? Ask the <b>owner</b>. Only the owner can open that day again.</li>
          <li>Forgot to close yesterday? The app will ask you to close it first.</li>
          <li>Owner took cash home, or cash went to the bank? Press <b>Record cash added or taken out</b>.</li>
          <li>Payment saved as Cash but it was UPI? Ask the <b>owner</b>. They can press <b>Change method</b> on that bill before the day is closed.</li>
          <li>Big expense? Type the bill or receipt number. Without it, only the owner can save it.</li>
        </ul>
      </div>}
    </details>
  );
}

function HelpHindi() {
  return (
    <div className="cash-help-body" lang="hi">
      <p>ऐप हर दिन जाँचता है कि गल्ले का कैश, दिन की बिक्री और खर्च से मिलता है या नहीं। आपको बस 3 काम करने हैं:</p>
      <ol className="cash-help-steps">
        <li>
          <strong>सुबह: दुकान खोलें</strong>
          <span>गल्ले का कैश गिनें। रकम लिखें और <b>दिन शुरू करें</b> दबाएँ। कल का कैश पहले से भरा होता है।</span>
        </li>
        <li>
          <strong>दिन में: रोज़ की तरह काम करें</strong>
          <span>बिल बनाइए और भुगतान लीजिए, जैसे अभी करते हैं। कोई खर्च हो तो <b>खर्च</b> में जोड़ें और <b>नकद</b> या <b>UPI</b> चुनें। गल्ले में सिर्फ़ कैश गिना जाता है। UPI और कार्ड का पैसा बैंक में जाता है।</span>
        </li>
        <li>
          <strong>शाम: गिनें और दिन बंद करें</strong>
          <span>नोट और सिक्के गिनें और हर एक की गिनती लिखें (<b>+</b> और <b>−</b> दबाकर)। अगर <b>मिल गया</b> लिखा आए तो <b>दिन बंद करें</b> दबाएँ। अगर <b>कम</b> या <b>ज़्यादा</b> आए तो कारण लिखें, फिर बंद करें। चाहें तो UPI ऐप से आज का UPI कुल भी लिखकर मिलान करें। बंद करने के बाद <b>WhatsApp पर हिसाब भेजें</b> दबाकर मालिक को भेजें।</span>
        </li>
      </ol>

      <div className="cash-help-example">
        <strong>उदाहरण</strong>
        <p>सुबह का कैश ₹5,000 + कैश बिक्री ₹15,000 − चाय ₹200 − बाइक रिपेयर ₹800 − सप्लायर को ₹2,200 = <b>गल्ले में ₹16,800 होने चाहिए</b>।</p>
      </div>

      <strong className="cash-help-title">कौन सा खर्च चुनें</strong>
      <ul className="cash-help-list">
        <li>चाय, नाश्ता, कॉफ़ी → <b>Tea &amp; snacks</b></li>
        <li>पानी की बोतल → <b>Drinking water</b></li>
        <li>पेट्रोल, डीज़ल → <b>Fuel</b></li>
        <li>बाइक रिपेयर, पंक्चर, सर्विस → <b>Vehicle repairs &amp; servicing</b></li>
        <li>मज़दूरी, लोडिंग → <b>Loading &amp; unloading</b> या <b>Daily wages &amp; labour</b></li>
        <li>महीने की तनख्वाह → <b>Salary</b> (स्टाफ़ का नाम और महीना चुनें)</li>
        <li>स्टाफ़ को पहले दिया पैसा → <b>Staff advance</b></li>
        <li>बिजली का बिल → <b>Electricity</b></li>
        <li>बाकी कुछ भी → <b>Miscellaneous</b> (क्या था, वह लिखें)</li>
      </ul>
      <p className="cash-help-tip"><b>तनख्वाह के लिए:</b> अगर एडवांस पहले दे दिया है तो अभी जो दे रहे हैं, सिर्फ़ वही लिखें। तनख्वाह ₹10,000, एडवांस ₹3,000 पहले दिया → <b>₹7,000</b> लिखें।</p>

      <strong className="cash-help-title">ध्यान रखें</strong>
      <ul className="cash-help-list">
        <li>दिन बंद होने के बाद वह <b>लॉक</b> हो जाता है। उस दिन में कुछ नहीं जुड़ सकता।</li>
        <li>बंद करने के बाद गलती दिखी? <b>मालिक</b> से कहें। सिर्फ़ मालिक वह दिन दोबारा खोल सकते हैं।</li>
        <li>कल का दिन बंद करना भूल गए? ऐप पहले उसे बंद करने को कहेगा।</li>
        <li>मालिक कैश घर ले गए या कैश बैंक में गया? <b>कैश जोड़ा या निकाला दर्ज करें</b> दबाएँ।</li>
        <li>भुगतान नकद में सेव हुआ पर था UPI? <b>मालिक</b> से कहें। दिन बंद होने से पहले वे उस बिल पर <b>तरीका बदलें</b> दबा सकते हैं।</li>
        <li>बड़ा खर्च? बिल या रसीद नंबर लिखें। उसके बिना सिर्फ़ मालिक सेव कर सकते हैं।</li>
      </ul>
    </div>
  );
}

function TodayTab() {
  const canManage = usePermission("CASH_MANAGE");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [justClosed, setJustClosed] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await getCashToday();
      setData(response);
      setError("");
    } catch (err) {
      setError(err.message || t("The cash book could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton label={t("Loading today's cash…")} rows={4} />;
  if (!data) return <p className="cash-alert is-error" role="alert">{error}</p>;

  const open = data.openSession;
  const staleDay = open && open.session.businessDate < data.today;

  return (
    <>
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      {success && <p className="cash-alert is-success" role="status">{success}</p>}
      {justClosed && (
        <section className="cash-panel cash-closed-card">
          <div className="cash-panel-heading"><div><h2>{t("{date} is closed", { date: formatDate(justClosed.session.businessDate) })}</h2><p>{differenceText(justClosed.session.difference)}. {t("Send the summary to the owner or print it.")}</p></div></div>
          <ShareButtons detail={justClosed} ownerWhatsapp={data.settings?.ownerWhatsapp} />
        </section>
      )}
      {open && data.closingReminderDue && !staleDay && (
        <p className="cash-alert is-warning" role="alert">{t("It is past closing time. Count the drawer and close today before you leave.")}</p>
      )}
      {data.lockedThrough && (
        <p className="cash-lock-note">{t("Closed up to {date}. Payments and expenses can no longer be dated on or before that day.", { date: formatDate(data.lockedThrough) })}</p>
      )}
      {!open ? (
        canManage
          ? <OpenDayCard data={data} onOpened={() => { setSuccess(t("Day opened.")); setJustClosed(null); load(); }} />
          : <p className="cash-empty">{t("Today has not been opened yet. The owner opens the day.")}</p>
      ) : (
        <>
          {staleDay && (
            <p className="cash-alert is-warning" role="alert">
              {t("{date} was never closed. Count the drawer now and close that day before opening today. Count before taking in any new cash, because entries dated today belong to the next day.", { date: formatDate(open.session.businessDate) })}
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
              onClosed={(closed) => { setSuccess(""); setJustClosed(closed); load(); }}
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
    if (!isMoney(amount)) { setError(t("Enter the opening cash, for example 5000 or 5000.50.")); return; }
    if (differs && !note.trim()) { setError(t("Say why the opening cash differs from the last count.")); return; }
    setSaving(true); setError("");
    try {
      await openCashDay(amount.trim(), note.trim() || null);
      onOpened();
    } catch (err) {
      setError(err.message || t("The day could not be opened."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="cash-panel cash-open" onSubmit={submit} noValidate>
      <div className="cash-panel-heading">
        <div>
          <h2>{t("Open {date}", { date: formatDate(data.today) })}</h2>
          <p>{data.lastClosed
            ? t("Last closed {date} with {amount} counted.", { date: formatDate(data.lastClosed.businessDate), amount: currency(suggested) })
            : t("First day of the cash book. Count the drawer and enter what is in it. Earlier payments are not part of the cash book.")}</p>
        </div>
      </div>
      <div className="cash-form-grid">
        <label>{t("Opening cash (₹)")}
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={Boolean(error) && !isMoney(amount)} />
        </label>
        <label className="cash-wide">{differs ? t("Note (required: it differs from the last count)") : t("Note (optional)")}
          <input maxLength="500" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </div>
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      <div className="cash-actions"><button type="submit" className="cash-primary" disabled={saving}>{saving ? t("Opening…") : t("Open the day")}</button></div>
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
        {multiDay && <span>{t("includes entries from {date}", { date: formatDate(session.periodStart) })}</span>}
        <span>{t("Opened by {name} at {time}", { name: session.openedBy, time: formatDateTime(session.openedAt) })}</span>
      </div>
      <section className="cash-kpis">
        <article><span>{t("Opening cash")}</span><strong>{currency(summary.openingBalance)}</strong><small>{session.openingNote || t("Counted at opening")}</small></article>
        <article className="is-in"><span>{t("Cash in")}</span><strong>{currency(flows.totalIn)}</strong><small>{t("Sales, collections and cash added")}</small></article>
        <article className="is-out"><span>{t("Cash out")}</span><strong>{currency(flows.totalOut)}</strong><small>{t("Payments, expenses, refunds and deposits")}</small></article>
        <article className="is-expected"><span>{t("Should be in drawer")}</span><strong>{currency(summary.expectedCash)}</strong><small>{t("Opening + in − out")}</small></article>
      </section>
      <section className="cash-panel">
        <div className="cash-panel-heading"><div><h2>{t("Cash drawer")}</h2><p>{t("Only cash. UPI, bank and card are listed below and never change the drawer.")}</p></div></div>
        <div className="cash-flows">
          <dl>
            <dt>{t("Paid in cash on new bills")}</dt><dd>{currency(flows.saleReceipts)}</dd>
            <dt>{t("Collected in cash on old bills")}</dt><dd>{currency(flows.collections)}</dd>
            <dt>{t("Owner put cash in")}</dt><dd>{currency(flows.ownerCashIn)}</dd>
            <dt>{t("Withdrawn from bank")}</dt><dd>{currency(flows.bankWithdrawals)}</dd>
            <dt>{t("Corrections (in)")}</dt><dd>{currency(flows.adjustmentsIn)}</dd>
            <dt className="is-total">{t("Total in")}</dt><dd className="is-total">{currency(flows.totalIn)}</dd>
          </dl>
          <dl>
            <dt>{t("Paid to suppliers")}</dt><dd>{currency(flows.supplierPayments)}</dd>
            <dt>{t("Cash expenses")}</dt><dd>{currency(flows.expenses)}</dd>
            <dt>{t("Cash refunds")}</dt><dd>{currency(flows.refunds)}</dd>
            <dt>{t("Deposited in bank")}</dt><dd>{currency(flows.bankDeposits)}</dd>
            <dt>{t("Owner took cash out")}</dt><dd>{currency(flows.ownerCashOut)}</dd>
            <dt>{t("Corrections (out)")}</dt><dd>{currency(flows.adjustmentsOut)}</dd>
            <dt className="is-total">{t("Total out")}</dt><dd className="is-total">{currency(flows.totalOut)}</dd>
          </dl>
        </div>
      </section>
      <section className="cash-panel">
        <div className="cash-panel-heading"><div><h2>{t("By payment method")}</h2><p>{t("Check UPI, bank and card against your statements.")}</p></div></div>
        <div className="cash-table-wrap">
          <table className="cash-table stack-on-phone">
            <thead><tr><th>{t("Method")}</th><th className="num">{t("New bills")}</th><th className="num">{t("Old bills")}</th><th className="num">{t("Refunds")}</th><th className="num">{t("Suppliers")}</th><th className="num">{t("Expenses")}</th><th className="num">{t("Net")}</th></tr></thead>
            <tbody>{summary.byMethod.map((row) => (
              <tr key={row.paymentMethod}><td data-label={t("Method")}><strong>{label(row.paymentMethod)}</strong></td><td className="num" data-label={t("New bills")}>{currency(row.saleReceipts)}</td><td className="num" data-label={t("Old bills")}>{currency(row.collections)}</td><td className="num" data-label={t("Refunds")}>{currency(row.refunds)}</td><td className="num" data-label={t("Suppliers")}>{currency(row.supplierPayments)}</td><td className="num" data-label={t("Expenses")}>{currency(row.expenses)}</td><td className="num" data-label={t("Net")}><strong>{currency(row.net)}</strong></td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="cash-not-cash">
          <p><span>{t("Bills raised")}</span><strong>{currency(summary.billsRaised)}</strong></p>
          <p><span>{t("Of which still unpaid (credit)")}</span><strong>{currency(summary.billsStillUnpaid)}</strong></p>
          <p><span>{t("Stock received")}</span><strong>{currency(summary.purchasesReceived)}</strong></p>
          <p><span>{t("Of which still to pay")}</span><strong>{currency(summary.purchasesStillUnpaid)}</strong></p>
        </div>
        <p className="cash-note">{t("Bills and stock received are not money in or out until they are paid. None of this is profit.")}</p>
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
        <div><h2>{t("Entries")}</h2><p>{t("Every payment, refund, expense and drawer movement in this day. Use this to find a difference.")}</p></div>
        <label className="cash-check"><input type="checkbox" checked={cashOnly} onChange={(event) => setCashOnly(event.target.checked)} />{t("Cash only")}</label>
      </div>
      <LedgerTable lines={visible} empty={t("No entries yet.")} />
    </section>
  );
}

function LedgerTable({ lines, empty }) {
  if (!lines.length) return <p className="cash-empty">{empty}</p>;
  return (
    <div className="cash-table-wrap has-mobile-cards">
      <table className="cash-table desktop-table">
        <thead><tr><th>{t("Date")}</th><th>{t("What")}</th><th>{t("Bill / ref")}</th><th>{t("Who")}</th><th>{t("Method")}</th><th className="num">{t("In")}</th><th className="num">{t("Out")}</th><th>{t("Entered by")}</th></tr></thead>
        <tbody>{lines.map((line) => {
          const amount = Number(line.amount);
          return (
            <tr key={`${line.source}-${line.sourceId}`}>
              <td>{formatDate(line.date)}</td>
              <td><strong>{label(line.kind)}</strong>{line.detail && <small>{line.detail}</small>}</td>
              <td>{line.reference || "—"}</td>
              <td>{line.party || "—"}</td>
              <td>{label(line.paymentMethod)}</td>
              <td className="cash-in num">{amount > 0 ? currency(amount) : ""}</td>
              <td className="cash-out num">{amount < 0 ? currency(-amount) : ""}</td>
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
    if (!isMoney(form.amount) || toPaise(form.amount) <= 0) { setError(t("Enter an amount above zero.")); return; }
    if (isCorrection && form.notes.trim().length < 5) { setError(t("Explain what this correction is for.")); return; }
    setSaving(true); setError("");
    try {
      // No date: the server records it on today's business date (IST).
      await recordCashMovement({ movementDate: null, movementType: form.movementType, amount: form.amount.trim(),
        referenceNumber: form.referenceNumber.trim() || null, notes: form.notes.trim() || null, requestId: requestId.current });
      requestId.current = newRequestId();
      setForm({ movementType: "BANK_DEPOSIT", amount: "", referenceNumber: "", notes: "" });
      setOpen(false);
      onSaved(t("{what}: {amount} recorded.", { what: label(form.movementType), amount: currency(form.amount) }));
    } catch (err) {
      setError(err.message || t("The movement could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="cash-actions cash-actions--start">
        <button type="button" onClick={() => setOpen(true)}>{t("Record cash added or taken out")}</button>
      </div>
    );
  }
  return (
    <form className="cash-panel cash-movement" onSubmit={submit} noValidate>
      <div className="cash-panel-heading"><div><h2>{t("Cash added or taken out")}</h2><p>{t("For money that is not a sale, payment or expense. Record sales, supplier payments and expenses on their own pages.")}</p></div></div>
      <div className="cash-form-grid">
        <label>{t("What happened")}
          <select name="movementType" value={form.movementType} onChange={change}>
            {MOVEMENT_TYPES.filter(([, , approval]) => !approval || canApprove).map(([value, text]) => <option key={value} value={value}>{t(text)}</option>)}
          </select>
        </label>
        <label>{t("Amount (₹)")}<input name="amount" inputMode="decimal" value={form.amount} onChange={change} /></label>
        <label>{t("Reference")}<input name="referenceNumber" maxLength="100" value={form.referenceNumber} onChange={change} placeholder={t("Deposit slip, etc.")} /></label>
        <label className="cash-wide">{isCorrection ? t("Why is this correction needed? (required)") : t("Note (optional)")}
          <input name="notes" maxLength="500" value={form.notes} onChange={change} />
        </label>
      </div>
      {isCorrection && <p className="cash-note">{t("Corrections fix a known mistake, such as a UPI payment entered as cash. Never use one just to make the count match.")}</p>}
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      <div className="cash-actions">
        <button type="button" onClick={() => setOpen(false)}>{t("Cancel")}</button>
        <button type="submit" className="cash-primary" disabled={saving}>{saving ? t("Saving…") : t("Save")}</button>
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
  const [digital, setDigital] = useState({});
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
    if (invalidCount) { setError(t("Counts must be whole numbers.")); return; }
    if (differencePaise !== 0 && note.trim().length === 0) { setError(t("Explain the difference before closing.")); return; }
    if (needsOwner && !canApprove) { setError(t("The difference is more than {amount}. Ask the owner to close the day.", { amount: currency(threshold) })); return; }
    if (Object.values(digital).some((value) => value !== "" && !isMoney(value))) { setError(t("Enter UPI and bank amounts like 1500 or 1500.50.")); return; }
    setError(""); setConfirming(true);
  }

  async function close() {
    setSaving(true); setError("");
    try {
      const closed = await closeCashDay(sessionId, {
        counts: denominations.map((denomination) => ({ denomination, quantity: Number.parseInt(counts[denomination] || "0", 10) || 0 })),
        note: note.trim() || null,
        expectedCash: detail.summary.expectedCash,
        requestId: requestId.current,
        digitalTotals: DIGITAL_METHODS
          .filter(([method]) => isMoney(digital[method] ?? ""))
          .map(([method]) => ({ paymentMethod: method, amount: digital[method].trim() })),
      });
      try { localStorage.removeItem(COUNT_DRAFT_KEY(sessionId)); } catch { /* ignore */ }
      setConfirming(false);
      onClosed(closed);
    } catch (err) {
      setConfirming(false);
      setError(err.message || t("The day could not be closed."));
      // New entries arrived while counting: refresh so the expected cash is current.
      if (/changed while you were counting/.test(err.message || "")) onStale();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="cash-panel cash-close">
      <div className="cash-panel-heading"><div><h2>{t("Count the drawer and close")}</h2><p>{t("Enter how many of each note and coin are in the drawer. Your count is kept on this device until you close.")}</p></div></div>
      <div className="cash-denominations">
        {denominations.map((denomination) => {
          const quantity = counts[denomination] ?? "";
          const subtotal = (Number.parseInt(quantity || "0", 10) || 0) * Number(denomination);
          return (
            <div className="cash-denomination" key={denomination}>
              <span>₹{Number(denomination)}{Number(denomination) <= 10 ? ` ${t("coin/note")}` : ""}</span>
              <div className="cash-stepper">
                <button type="button" aria-label={t("One less ₹{value}", { value: Number(denomination) })}
                  onClick={() => setCounts((previous) => ({ ...previous, [denomination]: String(Math.max(0, (Number.parseInt(previous[denomination] || "0", 10) || 0) - 1)) }))}>−</button>
                <input inputMode="numeric" value={quantity} placeholder="0" aria-label={t("Number of ₹{value}", { value: Number(denomination) })}
                  onChange={(event) => setCounts((previous) => ({ ...previous, [denomination]: event.target.value.trim() }))} />
                <button type="button" aria-label={t("One more ₹{value}", { value: Number(denomination) })}
                  onClick={() => setCounts((previous) => ({ ...previous, [denomination]: String((Number.parseInt(previous[denomination] || "0", 10) || 0) + 1) }))}>+</button>
              </div>
              <small>{currency(subtotal)}</small>
            </div>
          );
        })}
      </div>
      <div className="cash-result">
        <p><span>{t("Counted")}</span><strong>{currency(fromPaise(countedPaise))}</strong></p>
        <p><span>{t("Should be")}</span><strong>{currency(detail.summary.expectedCash)}</strong></p>
        <p className={differenceClass(fromPaise(differencePaise))}><span>{t("Difference")}</span><strong>{differenceText(fromPaise(differencePaise))}</strong></p>
      </div>
      <div className="cash-digital">
        <p><b>{t("Check UPI and bank too (optional).")}</b> {t("Type the total received today as shown in your UPI app or bank.")}</p>
        <div className="cash-digital-grid">
          {DIGITAL_METHODS.map(([method, text]) => {
            const row = detail.summary.byMethod.find((item) => item.paymentMethod === method);
            const recorded = row ? Number(row.saleReceipts) + Number(row.collections) : 0;
            const entered = digital[method] ?? "";
            const difference = isMoney(entered) ? fromPaise(toPaise(entered) - toPaise(recorded)) : null;
            return (
              <label key={method}>
                <span>{t("{method} in app/bank", { method: t(text) })}</span>
                <input inputMode="decimal" value={entered} placeholder={t("Bills say {amount}", { amount: currency(recorded) })}
                  onChange={(event) => setDigital((previous) => ({ ...previous, [method]: event.target.value }))} />
                <small className={difference === null ? "" : differenceClass(difference)}>
                  {difference === null ? t("Bills say {amount}", { amount: currency(recorded) }) : differenceText(difference)}
                </small>
              </label>
            );
          })}
        </div>
      </div>
      <label className="cash-close-note">
        {differencePaise === 0 ? t("Note (optional)") : t("What caused the difference? (required)")}
        <textarea rows="2" maxLength="1000" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {needsOwner && <p className="cash-note">{t("Differences above {amount} need the owner.", { amount: currency(threshold) })} {canApprove ? t("You are approving it by closing.") : ""}</p>}
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      <div className="cash-actions"><button type="button" className="cash-primary" onClick={review}>{t("Review and close {date}", { date: formatDate(detail.session.businessDate) })}</button></div>

      {confirming && (
        <div className="cash-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setConfirming(false)}>
          <div className="cash-modal" role="dialog" aria-modal="true" aria-labelledby="cash-confirm-title">
            <h2 id="cash-confirm-title">{t("Close {date}?", { date: formatDate(detail.session.businessDate) })}</h2>
            <div className="cash-result">
              <p><span>{t("Opening")}</span><strong>{currency(detail.summary.openingBalance)}</strong></p>
              <p><span>{t("Should be")}</span><strong>{currency(detail.summary.expectedCash)}</strong></p>
              <p><span>{t("Counted")}</span><strong>{currency(fromPaise(countedPaise))}</strong></p>
              <p className={differenceClass(fromPaise(differencePaise))}><span>{t("Difference")}</span><strong>{differenceText(fromPaise(differencePaise))}</strong></p>
            </div>
            {note.trim() && <p className="cash-note">{note.trim()}</p>}
            <p className="cash-note">{t("After closing, nothing can be recorded on this day or earlier unless the owner reopens it. Tomorrow opens with {amount}.", { amount: currency(fromPaise(countedPaise)) })}</p>
            <div className="cash-actions">
              <button type="button" onClick={() => setConfirming(false)} disabled={saving}>{t("Go back")}</button>
              <button type="button" className="cash-primary" onClick={close} disabled={saving}>{saving ? t("Closing…") : t("Close the day")}</button>
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
      setError(err.message || t("Past days could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="cash-filter">
        <label>{t("From")}<input type="date" value={range.from} onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))} /></label>
        <label>{t("To")}<input type="date" value={range.to} onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))} /></label>
        <label className="cash-check"><input type="checkbox" checked={range.withDifference} onChange={(event) => setRange((r) => ({ ...r, withDifference: event.target.checked }))} />{t("Only days that did not match")}</label>
      </div>
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      <section className="cash-panel">
        {loading ? <Skeleton label={t("Loading…")} /> : !days.length ? <EmptyState icon="search" title={t("No days in this range.")} /> : (
          <div className="cash-table-wrap has-mobile-cards">
            <table className="cash-table desktop-table">
              <thead><tr><th>{t("Day")}</th><th>{t("Status")}</th><th className="num">{t("Opening")}</th><th className="num">{t("Should be")}</th><th className="num">{t("Counted")}</th><th className="num">{t("Difference")}</th><th>{t("Closed by")}</th><th><span className="visually-hidden">{t("Actions")}</span></th></tr></thead>
              <tbody>{days.map((day) => (
                <tr key={day.id}>
                  <td><strong>{formatDate(day.businessDate)}</strong>{day.reopenCount > 0 && <small>{t("Reopened {count}×", { count: day.reopenCount })}</small>}</td>
                  <td><span className={`cash-status is-${day.status.toLowerCase()}`}>{label(day.status)}</span></td>
                  <td className="num">{currency(day.openingBalance)}</td>
                  <td className="num">{day.expectedCash === null ? "—" : currency(day.expectedCash)}</td>
                  <td className="num">{day.countedCash === null ? "—" : currency(day.countedCash)}</td>
                  <td className={`${differenceClass(day.difference)} num`}>{differenceText(day.difference)}</td>
                  <td>{day.closedBy || "—"}</td>
                  <td><button type="button" onClick={() => setSelected(day.id)}>{t("View")}</button></td>
                </tr>
              ))}</tbody>
            </table>
            <div className="mobile-cards">{days.map((day) => (
              <button type="button" className="mobile-card" key={day.id} onClick={() => setSelected(day.id)}>
                <span className="mobile-card__row"><span className="mobile-card__title">{formatDate(day.businessDate)}</span><span className={`cash-status is-${day.status.toLowerCase()}`}>{label(day.status)}</span></span>
                <span className="mobile-card__meta">{t("Counted")} {day.countedCash === null ? "—" : currency(day.countedCash)} · <span className={differenceClass(day.difference)}>{differenceText(day.difference)}</span></span>
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
  const [ownerWhatsapp, setOwnerWhatsapp] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCashDay(sessionId)
      .then((response) => { if (!cancelled) setDetail(response); })
      .catch((err) => { if (!cancelled) setError(err.message || t("This day could not be loaded.")); });
    getCashToday()
      .then((response) => { if (!cancelled) setOwnerWhatsapp(response?.settings?.ownerWhatsapp || ""); })
      .catch(() => { /* sharing still works; WhatsApp asks for the chat */ });
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    function handleKey(event) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function reopen() {
    if (!reason.trim()) { setError(t("Give a reason for reopening.")); return; }
    setReopening(true); setError("");
    try {
      setDetail(await reopenCashDay(sessionId, reason.trim()));
      setReason("");
      onChanged();
    } catch (err) {
      setError(err.message || t("The day could not be reopened."));
    } finally {
      setReopening(false);
    }
  }

  const session = detail?.session;
  return (
    <div className="cash-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="cash-modal cash-modal--wide" role="dialog" aria-modal="true" aria-labelledby="cash-day-title">
        <div className="cash-modal-heading">
          <h2 id="cash-day-title">{session ? formatDate(session.businessDate) : t("Day")}</h2>
          <button type="button" onClick={onClose}>{t("Close")}</button>
        </div>
        {error && <p className="cash-alert is-error" role="alert">{error}</p>}
        {!detail ? <Skeleton label={t("Loading…")} rows={4} /> : (
          <>
            <div className="cash-result">
              <p><span>{t("Opening")}</span><strong>{currency(session.openingBalance)}</strong></p>
              <p><span>{t("Should be")}</span><strong>{session.expectedCash === null ? currency(detail.summary.expectedCash) : currency(session.expectedCash)}</strong></p>
              <p><span>{t("Counted")}</span><strong>{session.countedCash === null ? "—" : currency(session.countedCash)}</strong></p>
              <p className={differenceClass(session.difference)}><span>{t("Difference")}</span><strong>{differenceText(session.difference)}</strong></p>
            </div>
            {session.closingNote && <p className="cash-note"><b>{t("Explanation:")}</b> {session.closingNote}</p>}
            {session.openingNote && <p className="cash-note"><b>{t("Opening note:")}</b> {session.openingNote}</p>}
            {session.approvedBy && <p className="cash-note">{t("Difference approved by {name}.", { name: session.approvedBy })}</p>}
            {detail.digitalChecks?.length > 0 && (
              <div className="cash-count-list">{detail.digitalChecks.map((check) => (
                <span key={check.paymentMethod}>{t("{method}: app/bank {reported}, bills {recorded}", { method: label(check.paymentMethod), reported: currency(check.reported), recorded: currency(check.recorded) })} · {differenceText(check.difference)}</span>
              ))}</div>
            )}
            {session.status === "CLOSED" && <ShareButtons detail={detail} ownerWhatsapp={ownerWhatsapp} />}
            {session.counts.length > 0 && (
              <div className="cash-count-list">{session.counts.map((line) => (
                <span key={line.denomination}>₹{Number(line.denomination)} × {line.quantity}</span>
              ))}</div>
            )}
            <h3>{t("Entries")}</h3>
            <LedgerTable lines={detail.lines} empty={t("No entries on this day.")} />
            <h3>{t("History")}</h3>
            <ul className="cash-history">{detail.history.map((entry, index) => (
              <li key={index}><strong>{AUDIT_ACTIONS[entry.action] ? t(AUDIT_ACTIONS[entry.action]) : label(entry.action)}</strong> · {entry.actor || "—"} · {formatDateTime(entry.occurredAt)}{entry.reason ? ` — ${entry.reason}` : ""}</li>
            ))}</ul>
            {canApprove && session.status === "CLOSED" && (
              <div className="cash-reopen">
                <label>{t("Reason for reopening")}<input maxLength="1000" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("For example: a UPI payment was missed")} /></label>
                <button type="button" className="is-danger" onClick={reopen} disabled={reopening}>{reopening ? t("Reopening…") : t("Reopen this day")}</button>
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
    if (range.from > range.to) { setError(t("Start date must be on or before end date.")); return; }
    setLoading(true); setError("");
    try {
      if (report === "cashbook") setData(await getCashbook({ ...range, ...filters }));
      else if (report === "expenses") setData(await getExpenseCategoryReport(range));
      else if (report === "staff") setData(await getStaffPaymentReport(range));
      else setData(await getCashMovements(range));
    } catch (err) {
      setData(null);
      setError(err.message || t("The report could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [filters, range, report]);

  useEffect(() => { load(); }, [load]);

  const [cancelling, setCancelling] = useState(null);

  async function cancelMovement(reason) {
    await voidCashMovement(cancelling.id, reason);
    setCancelling(null);
    await load();
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
        <label>{t("Report")}
          <select value={report} onChange={(event) => { setData(null); setReport(event.target.value); }}>
            <option value="cashbook">{t("Cash book entries")}</option>
            <option value="expenses">{t("Expenses by category")}</option>
            <option value="staff">{t("Staff salary and advances")}</option>
            <option value="movements">{t("Cash added, taken out and corrections")}</option>
          </select>
        </label>
        <label>{t("From")}<input type="date" value={range.from} onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))} /></label>
        <label>{t("To")}<input type="date" value={range.to} onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))} /></label>
        {report === "cashbook" && (
          <>
            <label>{t("Method")}
              <select value={filters.paymentMethod} onChange={(event) => setFilters((f) => ({ ...f, paymentMethod: event.target.value }))}>
                <option value="">{t("All methods")}</option>
                {["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"].map((method) => <option key={method} value={method}>{label(method)}</option>)}
              </select>
            </label>
            <label>{t("Entry")}
              <select value={filters.kind} onChange={(event) => setFilters((f) => ({ ...f, kind: event.target.value }))}>
                <option value="">{t("All entries")}</option>
                {["SALE_RECEIPT", "COLLECTION", "REFUND", "SUPPLIER_PAYMENT", "EXPENSE", "OWNER_CASH_IN", "OWNER_CASH_OUT", "BANK_DEPOSIT", "BANK_WITHDRAWAL", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"].map((kind) => <option key={kind} value={kind}>{label(kind)}</option>)}
              </select>
            </label>
            <button type="button" onClick={exportCashbook} disabled={!data?.lines?.length}>{t("Download CSV")}</button>
          </>
        )}
      </div>
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      {loading && <Skeleton label={t("Loading…")} />}
      {!loading && data && report === "cashbook" && data.lines && (
        <section className="cash-panel">
          <div className="cash-panel-heading"><div><h2>{t("Cash book")}</h2><p>{t("{count} entries. Cash in {cashIn}, cash out {cashOut}, net change in the drawer {net}.", { count: data.lines.length, cashIn: currency(data.summary.cash.totalIn), cashOut: currency(data.summary.cash.totalOut), net: currency(data.summary.expectedCash) })}</p></div></div>
          <LedgerTable lines={data.lines} empty={t("No entries match.")} />
        </section>
      )}
      {cancelling && (
        <ReasonDialog
          title={t("Cancel {what} of {amount}?", { what: label(cancelling.movementType), amount: currency(cancelling.amount) })}
          action={t("Cancel this entry")}
          onConfirm={cancelMovement}
          onClose={() => setCancelling(null)}
        />
      )}
      {!loading && Array.isArray(data) && report === "expenses" && <ExpenseReport rows={data} />}
      {!loading && Array.isArray(data) && report === "staff" && <StaffReport rows={data} />}
      {!loading && Array.isArray(data) && report === "movements" && (
        <section className="cash-panel">
          {!data.length ? <p className="cash-empty">{t("No cash added or taken out in this range.")}</p> : (
            <div className="cash-table-wrap">
              <table className="cash-table stack-on-phone">
                <thead><tr><th>{t("Date")}</th><th>{t("What")}</th><th className="num">{t("Amount")}</th><th>{t("Note")}</th><th>{t("By")}</th><th>{t("Status")}</th><th><span className="visually-hidden">{t("Actions")}</span></th></tr></thead>
                <tbody>{data.map((movement) => (
                  <tr key={movement.id}>
                    <td data-label={t("Date")}>{formatDate(movement.movementDate)}</td>
                    <td data-label={t("What")}><strong>{label(movement.movementType)}</strong>{movement.referenceNumber && <small>{t("Ref:")} {movement.referenceNumber}</small>}</td>
                    <td className="num" data-label={t("Amount")}>{currency(movement.amount)}</td>
                    <td data-label={t("Note")}>{movement.notes || "—"}{movement.voidReason && <small>{t("Cancelled:")} {movement.voidReason}</small>}</td>
                    <td data-label={t("By")}>{movement.createdBy}{movement.approvedBy && <small>{t("Approved by {name}", { name: movement.approvedBy })}</small>}</td>
                    <td data-label={t("Status")}>{movement.status === "VOIDED" ? t("Cancelled") : t("Recorded")}</td>
                    <td>{canManage && movement.status !== "VOIDED" && <button type="button" className="is-danger" onClick={() => setCancelling(movement)}>{t("Cancel")}</button>}</td>
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
  if (!rows.length) return <section className="cash-panel"><p className="cash-empty">{t("No expenses in this range.")}</p></section>;
  return (
    <section className="cash-panel">
      <div className="cash-panel-heading"><div><h2>{t("Expenses by category")}</h2><p>{t("Total {amount}. Cancelled expenses are left out.", { amount: currency(fromPaise(total)) })}</p></div></div>
      <div className="cash-table-wrap">
        <table className="cash-table stack-on-phone">
          <thead><tr><th>{t("Category")}</th><th>{t("Paid by")}</th><th className="num">{t("Count")}</th><th className="num">{t("Total")}</th></tr></thead>
          <tbody>{groups.map(([name, group]) => [
            <tr key={name} className="cash-group-row"><td colSpan="3"><strong>{name}</strong></td><td className="num" data-label={t("Total")}><strong>{currency(fromPaise(group.total))}</strong></td></tr>,
            ...group.rows.map((row) => <tr key={`${name}-${row.category}-${row.paymentMethod}`}><td data-label={t("Category")}>{row.category}</td><td data-label={t("Paid by")}>{label(row.paymentMethod)}</td><td className="num" data-label={t("Count")}>{row.count}</td><td className="num" data-label={t("Total")}>{currency(row.total)}</td></tr>),
          ])}</tbody>
        </table>
      </div>
    </section>
  );
}

function StaffReport({ rows }) {
  if (!rows.length) return <section className="cash-panel"><p className="cash-empty">{t("No staff payments in this range.")}</p></section>;
  return (
    <section className="cash-panel">
      <div className="cash-panel-heading"><div><h2>{t("Staff salary and advances")}</h2><p>{t("An advance is salary paid early, so salary + advances is what each person received for the month.")}</p></div></div>
      <div className="cash-table-wrap">
        <table className="cash-table stack-on-phone">
          <thead><tr><th>{t("Staff")}</th><th>{t("Month")}</th><th className="num">{t("Monthly salary")}</th><th className="num">{t("Advances")}</th><th className="num">{t("Salary paid")}</th><th className="num">{t("Still to pay")}</th><th className="num">{t("Other pay")}</th><th className="num">{t("Total received")}</th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={`${row.staffMemberId}-${row.salaryPeriod}`}>
              <td data-label={t("Staff")}><strong>{row.staffName}</strong></td>
              <td data-label={t("Month")}>{row.salaryPeriod ? new Date(`${row.salaryPeriod}T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—"}</td>
              <td className="num" data-label={t("Monthly salary")}>{row.monthlySalary === null ? "—" : currency(row.monthlySalary)}</td>
              <td className="num" data-label={t("Advances")}>{currency(row.advances)}</td><td className="num" data-label={t("Salary paid")}>{currency(row.salary)}</td>
              <td className={`${row.balance !== null && Number(row.balance) < 0 ? "is-short" : ""} num`} data-label={t("Still to pay")}>{row.balance === null ? "—" : Number(row.balance) < 0 ? t("{amount} paid extra", { amount: currency(-row.balance) }) : currency(row.balance)}</td>
              <td className="num" data-label={t("Other pay")}>{currency(row.otherPayments)}</td><td className="num" data-label={t("Total received")}><strong>{currency(row.total)}</strong></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

// Asks for a reason in the app's own style instead of a browser pop-up.
function ReasonDialog({ title, action, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!reason.trim()) { setError(t("Write a reason.")); return; }
    setSaving(true); setError("");
    try { await onConfirm(reason.trim()); } catch (err) { setError(err.message || t("Could not save.")); setSaving(false); }
  }

  return (
    <div className="cash-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <form className="cash-modal" role="dialog" aria-modal="true" aria-labelledby="cash-reason-title" onSubmit={submit} noValidate>
        <h2 id="cash-reason-title">{title}</h2>
        <label className="cash-close-note">{t("Why? (required)")}<input value={reason} maxLength="500" onChange={(event) => setReason(event.target.value)} autoFocus /></label>
        {error && <p className="cash-alert is-error" role="alert">{error}</p>}
        <div className="cash-actions">
          <button type="button" onClick={onClose} disabled={saving}>{t("Go back")}</button>
          <button type="submit" className="is-danger" disabled={saving}>{saving ? t("Saving…") : action}</button>
        </div>
      </form>
    </div>
  );
}

const AUDIT_NAMES = {
  CASH_SESSION: "Cash day", CASH_MOVEMENT: "Cash added/taken out", EXPENSE: "Expense",
  SALES_PAYMENT: "Customer payment", PURCHASE_PAYMENT: "Supplier payment", CASH_SETTINGS: "Cash settings",
};
const AUDIT_ACTIONS = {
  OPEN: "Opened", OPEN_FIRST_DAY: "Opened (first day)", CLOSE: "Closed", REOPEN: "Reopened",
  CREATE: "Added", UPDATE: "Changed", VOID: "Cancelled", CHANGE_METHOD: "Payment method changed",
};

// Who did what to money records, newest first.
function ActivityTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getCashActivity()
      .then((response) => { if (!cancelled) setRows(Array.isArray(response) ? response : []); })
      .catch((err) => { if (!cancelled) setError(err.message || t("Activity could not be loaded.")); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="cash-panel">
      <div className="cash-panel-heading"><div><h2>{t("Activity")}</h2><p>{t("The last 200 changes to money records: who did it, when, and why.")}</p></div></div>
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      {!rows ? <Skeleton label={t("Loading…")} /> : !rows.length ? <EmptyState text={t("Nothing yet. Opening the day, expenses and payments will show up here.")} /> : (
        <div className="cash-table-wrap">
          <table className="cash-table stack-on-phone">
            <thead><tr><th>{t("When")}</th><th>{t("Who did it")}</th><th>{t("What")}</th><th>{t("Reason")}</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.id}>
                <td data-label={t("When")}>{formatDateTime(row.occurredAt)}</td>
                <td data-label={t("Who did it")}>{row.actor || "—"}</td>
                <td data-label={t("What")}><strong>{AUDIT_ACTIONS[row.action] ? t(AUDIT_ACTIONS[row.action]) : label(row.action)}</strong><small>{AUDIT_NAMES[row.entityType] ? t(AUDIT_NAMES[row.entityType]) : label(row.entityType)}{row.entityId ? ` #${row.entityId}` : ""}</small></td>
                <td data-label={t("Reason")}>{row.reason || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Owner-only settings for the daily cash check.
function SettingsTab() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    getCashToday()
      .then((response) => {
        if (cancelled) return;
        const settings = response.settings || {};
        setForm({
          approvalThreshold: String(Number(settings.approvalThreshold ?? 500)),
          largeExpenseThreshold: String(Number(settings.largeExpenseThreshold ?? 5000)),
          closingReminderTime: String(settings.closingReminderTime || "20:00").slice(0, 5),
          ownerWhatsapp: settings.ownerWhatsapp || "",
        });
      })
      .catch((err) => { if (!cancelled) setError(err.message || t("Settings could not be loaded.")); });
    return () => { cancelled = true; };
  }, []);

  function change(event) { setForm((previous) => ({ ...previous, [event.target.name]: event.target.value })); }

  async function submit(event) {
    event.preventDefault();
    if (!isMoney(form.approvalThreshold) || !isMoney(form.largeExpenseThreshold)) { setError(t("Enter amounts like 500 or 5000.")); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const saved = await updateCashSettings({
        approvalThreshold: form.approvalThreshold.trim(),
        largeExpenseThreshold: form.largeExpenseThreshold.trim(),
        closingReminderTime: form.closingReminderTime,
        ownerWhatsapp: form.ownerWhatsapp.trim(),
      });
      setForm((previous) => ({ ...previous, ownerWhatsapp: saved.ownerWhatsapp || "" }));
      setSuccess(t("Settings saved."));
    } catch (err) {
      setError(err.message || t("Settings could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  if (!form) return error ? <p className="cash-alert is-error" role="alert">{error}</p> : <Skeleton label={t("Loading…")} rows={3} columns={2} />;
  return (
    <form className="cash-panel" onSubmit={submit} noValidate>
      <div className="cash-panel-heading"><div><h2>{t("Settings")}</h2><p>{t("Only the owner can change these.")}</p></div></div>
      <div className="cash-form-grid">
        <label>{t("Owner's WhatsApp number")}
          <input name="ownerWhatsapp" inputMode="tel" value={form.ownerWhatsapp} onChange={change} placeholder="98765 43210" />
          <small className="cash-field-hint">{t("The day's summary opens in this chat. Leave empty to choose the chat each time.")}</small>
        </label>
        <label>{t("Remind to close after")}
          <input type="time" name="closingReminderTime" value={form.closingReminderTime} onChange={change} />
          <small className="cash-field-hint">{t("If the day is still open after this time, a reminder shows.")}</small>
        </label>
        <label>{t("Owner must approve differences above (₹)")}
          <input name="approvalThreshold" inputMode="decimal" value={form.approvalThreshold} onChange={change} />
        </label>
        <label>{t("Bill number needed for expenses above (₹)")}
          <input name="largeExpenseThreshold" inputMode="decimal" value={form.largeExpenseThreshold} onChange={change} />
          <small className="cash-field-hint">{t("0 turns this off. The owner can always add expenses without a bill number.")}</small>
        </label>
      </div>
      {error && <p className="cash-alert is-error" role="alert">{error}</p>}
      {success && <p className="cash-alert is-success" role="status">{success}</p>}
      <div className="cash-actions"><button type="submit" className="cash-primary" disabled={saving}>{saving ? t("Saving…") : t("Save settings")}</button></div>
    </form>
  );
}

export default CashBookPage;
