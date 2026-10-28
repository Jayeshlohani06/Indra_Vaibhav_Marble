import { useEffect, useState } from "react";
import { formatDate, label } from "../utils/format";
import { t } from "../i18n";
import "./ChangeMethodDialog.css";

const METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"];

// Owner-only fix for a payment saved with the wrong method, for example cash
// that was really UPI. The server keeps the old value in the activity log.
function ChangeMethodDialog({ payment, onSave, onClose }) {
  const [method, setMethod] = useState(METHODS.find((value) => value !== payment.paymentMethod));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKey(event) { if (event.key === "Escape" && !saving) onClose(); }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, saving]);

  async function submit(event) {
    event.preventDefault();
    if (!reason.trim()) { setError(t("Write why the method is being changed.")); return; }
    setSaving(true); setError("");
    try {
      await onSave(method, reason.trim());
    } catch (err) {
      setError(err.message || t("The payment could not be changed."));
      setSaving(false);
    }
  }

  const amount = Number(Math.abs(payment.amount || 0)).toLocaleString("en-IN", { style: "currency", currency: "INR" });
  return (
    <div className="change-method-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <form className="change-method-dialog" role="dialog" aria-modal="true" aria-labelledby="change-method-title" onSubmit={submit} noValidate>
        <h2 id="change-method-title">{t("Change how this was paid")}</h2>
        <p>{t("{amount} on {date}, now saved as", { amount, date: formatDate(payment.paymentDate) })} <b>{label(payment.paymentMethod)}</b>.</p>
        <label>{t("Correct method")}
          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            {METHODS.filter((value) => value !== payment.paymentMethod).map((value) => <option key={value} value={value}>{label(value)}</option>)}
          </select>
        </label>
        <label>{t("Why? (required)")}
          <input value={reason} maxLength="500" onChange={(event) => setReason(event.target.value)} placeholder={t("For example: customer paid by UPI, entered as cash")} autoFocus />
        </label>
        {error && <p className="change-method-error" role="alert">{error}</p>}
        <div className="change-method-actions">
          <button type="button" onClick={onClose} disabled={saving}>{t("Cancel")}</button>
          <button type="submit" className="is-primary" disabled={saving}>{saving ? t("Saving…") : t("Change method")}</button>
        </div>
      </form>
    </div>
  );
}

export default ChangeMethodDialog;
