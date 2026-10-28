import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createExpense,
  createExpenseCategory,
  createStaff,
  getExpenseCategories,
  getStaff,
  getExpenses,
  updateExpense,
  updateStaff,
  voidExpense,
} from "../../services/api/expenseApi";
import { getSuppliers } from "../../services/api/supplierApi";
import "./ExpensesPage.css";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import { usePermission } from "../../auth/PermissionsContext";
import RowMenu from "../../components/RowMenu";
import { formatDate, label } from "../../utils/format";
import { newRequestId } from "../../utils/requestId";
import { backdateWarning } from "../../utils/backdate";
import { t } from "../../i18n";

// Local date; toISOString() would give yesterday's date before 05:30 IST.
const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

// Prefix cells that spreadsheet apps would run as formulas.
const csvCell = (value) => {
  const text = String(value ?? "");
  const isFormula = /^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?$/.test(text);
  const safe = isFormula ? `'${text}` : text;
  return `"${safe.replaceAll("\"", "\"\"")}"`;
};
// Everyday spending that gets one-tap buttons; only shown if the category exists.
const QUICK_CATEGORIES = ["Tea & snacks", "Drinking water", "Fuel"];
// requestId makes a double-clicked or retried save record the expense once.
const initialForm = () => ({
  expenseDate: today(), category: "", description: "", amount: "",
  paymentMethod: "CASH", supplierId: "", referenceNumber: "", notes: "",
  payee: "", staffMemberId: "", salaryMonth: "", requestId: newRequestId(),
});
const paymentMethods = [
  ["CASH", "Cash"], ["UPI", "UPI"], ["BANK_TRANSFER", "Bank transfer"],
  ["CHEQUE", "Cheque"], ["CARD", "Card"], ["OTHER", "Other"],
];
const currency = (value) => Number(value || 0).toLocaleString("en-IN", {
  style: "currency", currency: "INR",
});
const expenseErrorMessage = (error, action) =>
  error?.message === "An unexpected error occurred"
    ? t("Unable to {action}. Please try again in a moment.", { action })
    : error?.message || t("Unable to {action}.", { action });

function ExpensesPage() {
  const canManageExpenses = usePermission("EXPENSE_MANAGE");
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showStaff, setShowStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffSalary, setNewStaffSalary] = useState("");
  const [voiding, setVoiding] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [filters, setFilters] = useState({ search: "", startDate: "", endDate: "", category: "", paymentMethod: "", status: "ALL" });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [details, setDetails] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("date");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const expenseData = await getExpenses({
        startDate: filters.startDate,
        endDate: filters.endDate,
        category: filters.category,
        status: filters.status,
      });
      setExpenses(Array.isArray(expenseData) ? expenseData : []);

      const [supplierResult, categoryResult, staffResult] = await Promise.allSettled([
        getSuppliers(),
        getExpenseCategories(),
        getStaff(),
      ]);
      setStaff(staffResult.status === "fulfilled" && Array.isArray(staffResult.value) ? staffResult.value : []);

      if (supplierResult.status === "fulfilled") {
        const supplierData = supplierResult.value;
        setSuppliers(Array.isArray(supplierData) ? supplierData : supplierData?.data || []);
      } else {
        setSuppliers([]);
      }

      if (categoryResult.status === "fulfilled") {
        const categoryData = categoryResult.value;
        setCategories(Array.isArray(categoryData) ? categoryData : categoryData?.data || []);
      } else {
        const fallbackCategories = [...new Set(
          (Array.isArray(expenseData) ? expenseData : [])
            .map((expense) => expense.category)
            .filter(Boolean)
        )].map((name) => ({ id: name, name }));
        setCategories(fallbackCategories);
      }
      setError("");
    } catch (err) {
      setError(
        err.message === "An unexpected error occurred"
          ? t("Expenses could not be loaded. Check your internet connection and try again.")
          : err.message || t("Unable to load expenses.")
      );
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.endDate, filters.startDate, filters.status]);

  useEffect(() => { load(); }, [load]);

  const supplierName = useCallback(
    (id) => suppliers.find((supplier) => supplier.id === id)?.name || "—",
    [suppliers]
  );
  const visible = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return expenses
      .filter((expense) => !filters.paymentMethod || expense.paymentMethod === filters.paymentMethod)
      .filter((expense) => !term || [expense.category, expense.description, expense.referenceNumber, expense.notes, supplierName(expense.supplierId)].some((value) => String(value || "").toLowerCase().includes(term)))
      .sort((a, b) => sort === "amount"
        ? Number(b.amount) - Number(a.amount)
        : String(b.expenseDate).localeCompare(String(a.expenseDate)));
  }, [expenses, filters.paymentMethod, filters.search, sort, supplierName]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const rows = visible.slice((page - 1) * pageSize, page * pageSize);
  const active = expenses.filter((expense) => expense.status !== "VOIDED");
  const total = active.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const monthKey = today().slice(0, 7);
  const monthExpenses = active.filter((expense) => String(expense.expenseDate || "").startsWith(monthKey));
  const monthTotal = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const topCategory = Object.entries(active.reduce((result, expense) => {
    result[expense.category] = (result[expense.category] || 0) + Number(expense.amount || 0);
    return result;
  }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const selectedCategory = categories.find((category) => category.name === form.category);
  // Categories grouped for the picker (Staff, Food, Shop operations, ...).
  const categoryGroups = useMemo(() => {
    const groups = new Map();
    categories.forEach((category) => {
      const group = category.groupName || "Other";
      groups.set(group, [...(groups.get(group) || []), category]);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [categories]);
  const activeStaff = staff.filter((member) => member.active || String(member.id) === String(form.staffMemberId));

  function updateFilter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }));
    setPage(1);
  }

  function openCreate() {
    setEditingId(null); setForm(initialForm()); setShowForm(true); setError(""); setSuccess("");
  }

  function openEdit(expense) {
    setEditingId(expense.id);
    setForm({ expenseDate: expense.expenseDate || today(), category: expense.category || "", description: expense.description || "", amount: expense.amount || "", paymentMethod: expense.paymentMethod || "CASH", supplierId: expense.supplierId || "", referenceNumber: expense.referenceNumber || "", notes: expense.notes || "", payee: expense.payee || "", staffMemberId: expense.staffMemberId || "", salaryMonth: expense.salaryPeriod ? String(expense.salaryPeriod).slice(0, 7) : "", requestId: null });
    setDetails(null); setShowForm(true); setError("");
  }

  function changeForm(event) {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.category.trim() || !form.expenseDate || !Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(form.amount))) {
      setError(t("Enter a date, category, and a valid amount with at most two decimal places."));
      return;
    }
    if (selectedCategory?.requiresDescription && !form.description.trim()) {
      setError(t("Add a description for {category} expenses.", { category: selectedCategory.name }));
      return;
    }
    if (selectedCategory?.staffPaymentType && (!form.staffMemberId || !form.salaryMonth)) {
      setError(t("Choose the staff member and the month this payment is for."));
      return;
    }
    setSaving(true); setError("");
    const payload = { ...form, category: form.category.trim(), description: form.description.trim() || null, amount: form.amount, supplierId: form.supplierId ? Number(form.supplierId) : null, referenceNumber: form.referenceNumber.trim() || null, notes: form.notes.trim() || null, payee: form.payee.trim() || null, staffMemberId: form.staffMemberId ? Number(form.staffMemberId) : null, salaryPeriod: form.salaryMonth ? `${form.salaryMonth}-01` : null, requestId: form.requestId };
    delete payload.salaryMonth;
    try {
      if (editingId) await updateExpense(editingId, payload);
      else await createExpense(payload);
      setShowForm(false); setSuccess(editingId ? t("Expense updated successfully.") : t("Expense saved successfully.")); await load();
    } catch (err) { setError(err.message || t("Unable to save expense.")); } finally { setSaving(false); }
  }

  async function addCategory(event) {
    event.preventDefault();
    const categoryName = newCategory.trim();
    if (!categoryName) {
      setError(t("Enter a category name."));
      return;
    }
    try {
      const response = await createExpenseCategory({ name: categoryName, categoryType: "OPERATING" });
      const created = response?.data || response;
      const savedCategory = {
        ...(created || {}),
        name: created?.name || categoryName,
      };
      setCategories((previous) => [
        ...previous.filter((category) => category.name.toLowerCase() !== savedCategory.name.toLowerCase()),
        savedCategory,
      ].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((previous) => ({ ...previous, category: savedCategory.name }));
      setError("");
      setNewCategory(""); setShowCategoryForm(false);
    } catch (err) { setError(err.message || t("Unable to add category.")); }
  }

  async function addStaff(event) {
    event.preventDefault();
    if (!newStaffName.trim()) { setError(t("Enter the staff member's name.")); return; }
    try {
      if (newStaffSalary.trim() && !/^\d+(\.\d{1,2})?$/.test(newStaffSalary.trim())) { setError(t("Enter the monthly salary like 12000.")); return; }
      const created = await createStaff({ name: newStaffName.trim(), monthlySalary: newStaffSalary.trim() || null });
      setStaff((previous) => [...previous, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewStaffName(""); setNewStaffSalary(""); setError("");
    } catch (err) { setError(err.message || t("Unable to add staff member.")); }
  }

  async function toggleStaff(member) {
    try {
      const updated = await updateStaff(member.id, { name: member.name, phone: member.phone, jobTitle: member.jobTitle, active: !member.active, monthlySalary: member.monthlySalary });
      setStaff((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) { setError(err.message || t("Unable to update staff member.")); }
  }

  function handleVoid(expense) {
    setVoidReason(""); setVoiding(expense);
  }

  async function confirmVoid(event) {
    event.preventDefault();
    if (!voidReason.trim()) { setError(t("Write why the expense is being cancelled.")); return; }
    try {
      await voidExpense(voiding.id, voidReason.trim());
      setVoiding(null); setDetails(null); setError("");
      setSuccess(t("Expense cancelled. It stays in the history for your records."));
      await load();
    } catch (err) { setError(expenseErrorMessage(err, t("cancel the expense"))); }
  }

  function quickAdd(categoryName) {
    setEditingId(null);
    setForm({ ...initialForm(), category: categoryName });
    setShowForm(true); setError(""); setSuccess("");
  }

  const quickCategories = QUICK_CATEGORIES.filter((name) => categories.some((category) => category.name === name));
  const hasFilters = Boolean(filters.search || filters.startDate || filters.endDate || filters.category || filters.paymentMethod);

  function exportCsv() {
    const header = ["Date", "Category", "Description", "Supplier", "Payment method", "Amount", "Status", "Reference"];
    const lines = visible.map((expense) => [expense.expenseDate, expense.category, expense.description, supplierName(expense.supplierId), expense.paymentMethod, expense.amount, expense.status, expense.referenceNumber].map((value) => csvCell(value || "")).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "expenses.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="expenses-page">
      <div className="expenses-page__header"><p className="expenses-intro">{t("Money spent on running the shop, such as rent, transport and wages.")}</p><div className="expenses-actions"><button type="button" onClick={exportCsv} disabled={!visible.length}>{t("Export CSV")}</button>{canManageExpenses && <button type="button" onClick={() => setShowStaff(true)}>{t("Staff")}</button>}{canManageExpenses && <button type="button" className="expenses-primary-button" onClick={openCreate}>{t("+ Add expense")}</button>}</div></div>
      <div className="expenses-kpis"><div><span>{t("Spent this month")}</span><strong>{currency(monthTotal)}</strong><small>{monthExpenses.length === 1 ? t("{count} expense", { count: monthExpenses.length }) : t("{count} expenses", { count: monthExpenses.length })}</small></div><div><span>{t("Spent in total")}</span><strong>{currency(total)}</strong><small>{active.length === 1 ? t("{count} expense recorded", { count: active.length }) : t("{count} expenses recorded", { count: active.length })}</small></div><div><span>{t("Biggest spending")}</span><strong>{topCategory}</strong><small>{t("Category with the most spent")}</small></div></div>
      {error && <p className="expenses-alert expenses-error" role="alert">{error}</p>}
      {success && <p className="expenses-alert expenses-success" role="status">{success}</p>}
      {canManageExpenses && quickCategories.length > 0 && <div className="expense-quick-add"><span>{t("Quick add:")}</span>{quickCategories.map((name) => <button type="button" key={name} onClick={() => quickAdd(name)}>+ {name}</button>)}</div>}<section className="expenses-table-card">
        <div className="expenses-toolbar"><input type="search" placeholder={t("Search expenses")} value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} /><input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} aria-label={t("Start date")} /><input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} aria-label={t("End date")} /><select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}><option value="">{t("All categories")}</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select><select value={filters.paymentMethod} onChange={(event) => updateFilter("paymentMethod", event.target.value)}><option value="">{t("All payment methods")}</option>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select><select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="ALL">{t("Recorded and cancelled")}</option><option value="ACTIVE">{t("Recorded")}</option><option value="VOIDED">{t("Cancelled")}</option></select><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="date">{t("Newest first")}</option><option value="amount">{t("Highest amount")}</option></select><button type="button" onClick={() => { setFilters({ search: "", startDate: "", endDate: "", category: "", paymentMethod: "", status: "ALL" }); setPage(1); }}>{t("Clear")}</button></div>
        {loading ? <Skeleton label={t("Loading expenses...")} /> : !rows.length ? (hasFilters || expenses.length ? <EmptyState icon="search" title={t("No expenses match the current filters.")} /> : <EmptyState icon="money" text={t("No expenses yet. Tap + Add expense to record tea, fuel, salary or any other spending.")} actionLabel={canManageExpenses ? t("+ Add expense") : undefined} onAction={openCreate} />) : <div className="expenses-table-wrapper has-mobile-cards"><table className="expenses-table desktop-table"><thead><tr><th>{t("Date")}</th><th>{t("Category")}</th><th>{t("Description")}</th><th>{t("Supplier")}</th><th>{t("Paid by")}</th><th className="num">{t("Amount")}</th><th>{t("Status")}</th><th><span className="visually-hidden">{t("Actions")}</span></th></tr></thead><tbody>{rows.map((expense) => <tr key={expense.id}><td>{formatDate(expense.expenseDate)}</td><td><strong>{expense.category}</strong>{expense.referenceNumber && <small>{t("Ref: {reference}", { reference: expense.referenceNumber })}</small>}</td><td>{expense.description || "—"}</td><td>{supplierName(expense.supplierId)}</td><td>{label(expense.paymentMethod)}</td><td className="num">{currency(expense.amount)}</td><td><span className={`expense-status ${expense.status === "VOIDED" ? "is-voided" : ""}`}>{expense.status === "VOIDED" ? t("Cancelled") : t("Recorded")}</span></td><td><div className="expense-row-actions"><button type="button" onClick={() => setDetails(expense)}>{t("View")}</button>{canManageExpenses && expense.status !== "VOIDED" && <RowMenu label={t("More actions for this {category} expense", { category: expense.category })} items={[{ label: t("Edit expense"), onClick: () => openEdit(expense) }, { label: t("Cancel expense"), onClick: () => handleVoid(expense), danger: true }]} />}</div></td></tr>)}</tbody></table><div className="mobile-cards">{rows.map((expense) => <button type="button" key={expense.id} className="mobile-card" onClick={() => setDetails(expense)}><span className="mobile-card__row"><span className="mobile-card__title">{expense.category}</span><span className="mobile-card__amount">{currency(expense.amount)}</span></span><span className="mobile-card__row"><span className="mobile-card__meta">{formatDate(expense.expenseDate)} · {label(expense.paymentMethod)}</span>{expense.status === "VOIDED" && <span className="expense-status is-voided">{t("Cancelled")}</span>}</span></button>)}</div></div>}
        <div className="expenses-pagination"><span>{t("Showing {from}–{to} of {total}", { from: visible.length ? (page - 1) * pageSize + 1 : 0, to: Math.min(page * pageSize, visible.length), total: visible.length })}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("Previous")}</button><strong>{t("Page {page} of {pages}", { page, pages: pageCount })}</strong><button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>{t("Next")}</button></div></div>
      </section>
      {showForm && <div className="expenses-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setShowForm(false)}><form noValidate className="expenses-modal" onSubmit={submit}><div className="expenses-modal-heading"><h2>{editingId ? t("Edit expense") : t("Record expense")}</h2><button type="button" onClick={() => setShowForm(false)}>{t("Close")}</button></div><div className="expenses-form-grid"><label>{t("Date")} *<input type="date" name="expenseDate" value={form.expenseDate} onChange={changeForm} required />{backdateWarning(form.expenseDate) && <small className="expense-warning">{backdateWarning(form.expenseDate)}</small>}</label><label>{t("Category")} *<div className="expense-category-field"><select name="category" value={form.category} onChange={changeForm} required aria-invalid={!form.category.trim()}><option value="">{t("Select category")}</option>{form.category && !selectedCategory && <option value={form.category}>{form.category}</option>}{categoryGroups.map(([group, items]) => <optgroup key={group} label={group}>{items.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</optgroup>)}</select><button type="button" onClick={() => setShowCategoryForm(true)}>+</button></div></label><p className="expenses-field-wide expense-hint">{selectedCategory?.description ? `${selectedCategory.name}: ${selectedCategory.description}.` : t("Not sure? Tea → Tea & snacks · Petrol → Fuel · Bike repair → Vehicle repairs & servicing · Anything else → Miscellaneous.")}</p><label>{t("Amount (₹)")} *<input type="number" name="amount" min="0.01" step="0.01" value={form.amount} onChange={changeForm} required /></label><label>{t("Payment method")} *<select name="paymentMethod" value={form.paymentMethod} onChange={changeForm}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>{(selectedCategory?.staffPaymentType || selectedCategory?.groupName === "Staff") && <><label>{t("Staff member")}{selectedCategory?.staffPaymentType ? " *" : ""}<select name="staffMemberId" value={form.staffMemberId} onChange={changeForm}><option value="">{t("Choose staff")}</option>{activeStaff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label>{t("For month")}{selectedCategory?.staffPaymentType ? " *" : ""}<input type="month" name="salaryMonth" value={form.salaryMonth} onChange={changeForm} /></label></>}{selectedCategory?.staffPaymentType === "SALARY" && <p className="expenses-field-wide expense-hint">{t("Enter the amount actually paid now. Advances already given for this month are salary paid early, so do not include them again.")}</p>}<label>{t("Paid to (optional)")}<input name="payee" maxLength="150" value={form.payee} onChange={changeForm} placeholder={t("Shop, person or company")} /></label><label>{t("Supplier (optional)")}<select name="supplierId" value={form.supplierId} onChange={changeForm}><option value="">{t("No supplier")}</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label>{t("Reference number")}<input name="referenceNumber" maxLength="100" value={form.referenceNumber} onChange={changeForm} placeholder={t("Receipt or transaction ID")} /></label><label className="expenses-field-wide">{t("Description")}{selectedCategory?.requiresDescription ? " *" : ""}<input name="description" maxLength="500" value={form.description} onChange={changeForm} /></label><label className="expenses-field-wide">{t("Notes")}<textarea name="notes" maxLength="1000" rows="3" value={form.notes} onChange={changeForm} /></label></div><div className="expenses-form-actions"><button type="button" onClick={() => setShowForm(false)}>{t("Cancel")}</button><button type="submit" className="expenses-primary-button" disabled={saving}>{saving ? t("Saving...") : editingId ? t("Save changes") : t("Save expense")}</button></div></form></div>}
      {showCategoryForm && <div className="expenses-modal-backdrop nested" onMouseDown={(event) => event.target === event.currentTarget && setShowCategoryForm(false)}><form className="expenses-small-modal" onSubmit={addCategory}><h2>{t("Add expense category")}</h2><input autoFocus value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder={t("e.g. Office supplies")} maxLength="100" /><div className="expenses-form-actions"><button type="button" onClick={() => setShowCategoryForm(false)}>{t("Cancel")}</button><button className="expenses-primary-button">{t("Add category")}</button></div></form></div>}
      {details && <div className="expenses-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetails(null)}><section className="expenses-small-modal"><div className="expenses-modal-heading"><h2>{t("Expense details")}</h2><button type="button" onClick={() => setDetails(null)}>{t("Close")}</button></div><div className="expense-detail-grid"><p><span>{t("Date")}</span><strong>{formatDate(details.expenseDate)}</strong></p><p><span>{t("Category")}</span><strong>{details.category}</strong></p><p><span>{t("Amount")}</span><strong>{currency(details.amount)}</strong></p><p><span>{t("Paid by")}</span><strong>{label(details.paymentMethod)}</strong></p><p><span>{t("Supplier")}</span><strong>{supplierName(details.supplierId)}</strong></p><p><span>{t("Status")}</span><strong>{details.status === "VOIDED" ? t("Cancelled") : t("Recorded")}</strong></p><p><span>{t("Reference")}</span><strong>{details.referenceNumber || "—"}</strong></p><p><span>{t("Description")}</span><strong>{details.description || "—"}</strong></p><p><span>{t("Paid to")}</span><strong>{details.staffMemberName || details.payee || "—"}</strong></p>{details.salaryPeriod && <p><span>{t("For month")}</span><strong>{String(details.salaryPeriod).slice(0, 7)}</strong></p>}<p><span>{t("Recorded by")}</span><strong>{details.createdBy || "—"}</strong></p>{details.voidedBy && <p><span>{t("Cancelled by")}</span><strong>{details.voidedBy}</strong></p>}</div>{details.notes && <p className="expense-notes"><b>{t("Notes")}</b><br />{details.notes}</p>}<div className="expenses-form-actions">{details.status !== "VOIDED" && <><button type="button" onClick={() => openEdit(details)}>{t("Edit")}</button><button type="button" className="is-danger" onClick={() => handleVoid(details)}>{t("Cancel expense")}</button></>}</div></section></div>}
      {showStaff && <div className="expenses-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowStaff(false)}><section className="expenses-small-modal"><div className="expenses-modal-heading"><h2>{t("Staff")}</h2><button type="button" onClick={() => setShowStaff(false)}>{t("Close")}</button></div><p className="expense-hint">{t("People you pay salary, wages or advances to. Turned-off staff stay in past expenses.")}</p><form className="expense-staff-add" onSubmit={addStaff}><input value={newStaffName} onChange={(event) => setNewStaffName(event.target.value)} placeholder={t("Full name")} maxLength="120" aria-label={t("New staff member name")} /><input value={newStaffSalary} onChange={(event) => setNewStaffSalary(event.target.value)} placeholder={t("Monthly salary (optional)")} inputMode="decimal" aria-label={t("Monthly salary")} /><button type="submit" className="expenses-primary-button">{t("Add")}</button></form><ul className="expense-staff-list">{staff.map((member) => <li key={member.id} className={member.active ? "" : "is-inactive"}><span>{member.name}{member.monthlySalary !== null && member.monthlySalary !== undefined && <small> · ₹{Number(member.monthlySalary).toLocaleString("en-IN")}{t("/month")}</small>}</span><button type="button" onClick={() => toggleStaff(member)}>{member.active ? t("Turn off") : t("Turn on")}</button></li>)}{!staff.length && <li>{t("No staff added yet.")}</li>}</ul></section></div>}
      {voiding && <div className="expenses-modal-backdrop nested" onMouseDown={(event) => event.target === event.currentTarget && setVoiding(null)}><form className="expenses-small-modal" onSubmit={confirmVoid} noValidate><h2>{t("Cancel this expense?")}</h2><p className="expense-hint">{t("{category} · {amount} on {date}. It stays in the history, marked as cancelled.", { category: voiding.category, amount: currency(voiding.amount), date: formatDate(voiding.expenseDate) })}</p><label className="expense-void-reason">{t("Why? (required)")}<input autoFocus value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength="500" placeholder={t("For example: entered twice")} /></label><div className="expenses-form-actions"><button type="button" onClick={() => setVoiding(null)}>{t("Go back")}</button><button type="submit" className="is-danger">{t("Cancel expense")}</button></div></form></div>}
    </main>
  );
}

export default ExpensesPage;
