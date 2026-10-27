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
import { usePermission } from "../../auth/PermissionsContext";
import RowMenu from "../../components/RowMenu";
import { formatDate, label } from "../../utils/format";

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
const newRequestId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : null);
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
    ? `Unable to ${action}. Please try again in a moment.`
    : error?.message || `Unable to ${action}.`;

function ExpensesPage() {
  const canManageExpenses = usePermission("EXPENSE_MANAGE");
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showStaff, setShowStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
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
          ? "Expenses could not be loaded. Check your internet connection and try again."
          : err.message || "Unable to load expenses."
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
      setError("Enter a date, category, and a valid amount with at most two decimal places.");
      return;
    }
    if (selectedCategory?.requiresDescription && !form.description.trim()) {
      setError(`Add a description for ${selectedCategory.name} expenses.`);
      return;
    }
    if (selectedCategory?.staffPaymentType && (!form.staffMemberId || !form.salaryMonth)) {
      setError("Choose the staff member and the month this payment is for.");
      return;
    }
    setSaving(true); setError("");
    const payload = { ...form, category: form.category.trim(), description: form.description.trim() || null, amount: form.amount, supplierId: form.supplierId ? Number(form.supplierId) : null, referenceNumber: form.referenceNumber.trim() || null, notes: form.notes.trim() || null, payee: form.payee.trim() || null, staffMemberId: form.staffMemberId ? Number(form.staffMemberId) : null, salaryPeriod: form.salaryMonth ? `${form.salaryMonth}-01` : null, requestId: form.requestId };
    delete payload.salaryMonth;
    try {
      if (editingId) await updateExpense(editingId, payload);
      else await createExpense(payload);
      setShowForm(false); setSuccess(editingId ? "Expense updated successfully." : "Expense saved successfully."); await load();
    } catch (err) { setError(err.message || "Unable to save expense."); } finally { setSaving(false); }
  }

  async function addCategory(event) {
    event.preventDefault();
    const categoryName = newCategory.trim();
    if (!categoryName) {
      setError("Enter a category name.");
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
    } catch (err) { setError(err.message || "Unable to add category."); }
  }

  async function addStaff(event) {
    event.preventDefault();
    if (!newStaffName.trim()) { setError("Enter the staff member's name."); return; }
    try {
      const created = await createStaff({ name: newStaffName.trim() });
      setStaff((previous) => [...previous, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewStaffName(""); setError("");
    } catch (err) { setError(err.message || "Unable to add staff member."); }
  }

  async function toggleStaff(member) {
    try {
      const updated = await updateStaff(member.id, { name: member.name, phone: member.phone, jobTitle: member.jobTitle, active: !member.active });
      setStaff((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) { setError(err.message || "Unable to update staff member."); }
  }

  async function handleVoid(expense) {
    const reason = window.prompt("Why are you cancelling this expense?");
    if (!reason?.trim()) return;
    try { await voidExpense(expense.id, reason); setDetails(null); setSuccess("Expense cancelled. It stays in the history for your records."); await load(); }
    catch (err) { setError(expenseErrorMessage(err, "void expense")); }
  }

  function exportCsv() {
    const header = ["Date", "Category", "Description", "Supplier", "Payment method", "Amount", "Status", "Reference"];
    const lines = visible.map((expense) => [expense.expenseDate, expense.category, expense.description, supplierName(expense.supplierId), expense.paymentMethod, expense.amount, expense.status, expense.referenceNumber].map((value) => csvCell(value || "")).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "expenses.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="expenses-page">
      <div className="expenses-page__header"><p className="expenses-intro">Money spent on running the shop, such as rent, transport and wages.</p><div className="expenses-actions"><button type="button" onClick={exportCsv} disabled={!visible.length}>Export CSV</button>{canManageExpenses && <button type="button" onClick={() => setShowStaff(true)}>Staff</button>}{canManageExpenses && <button type="button" className="expenses-primary-button" onClick={openCreate}>+ Add expense</button>}</div></div>
      <div className="expenses-kpis"><div><span>Spent this month</span><strong>{currency(monthTotal)}</strong><small>{monthExpenses.length} {monthExpenses.length === 1 ? "expense" : "expenses"}</small></div><div><span>Spent in total</span><strong>{currency(total)}</strong><small>{active.length} {active.length === 1 ? "expense" : "expenses"} recorded</small></div><div><span>Biggest spending</span><strong>{topCategory}</strong><small>Category with the most spent</small></div></div>
      {error && <p className="expenses-alert expenses-error" role="alert">{error}</p>}
      {success && <p className="expenses-alert expenses-success" role="status">{success}</p>}
      <section className="expenses-table-card">
        <div className="expenses-toolbar"><input type="search" placeholder="Search expenses" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} /><input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} aria-label="Start date" /><input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} aria-label="End date" /><select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select><select value={filters.paymentMethod} onChange={(event) => updateFilter("paymentMethod", event.target.value)}><option value="">All payment methods</option>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="ALL">Recorded and cancelled</option><option value="ACTIVE">Recorded</option><option value="VOIDED">Cancelled</option></select><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="date">Newest first</option><option value="amount">Highest amount</option></select><button type="button" onClick={() => { setFilters({ search: "", startDate: "", endDate: "", category: "", paymentMethod: "", status: "ALL" }); setPage(1); }}>Clear</button></div>
        {loading ? <p className="expenses-empty">Loading expenses...</p> : !rows.length ? <p className="expenses-empty">No expenses match the current filters.</p> : <div className="expenses-table-wrapper has-mobile-cards"><table className="expenses-table desktop-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Supplier</th><th>Paid by</th><th>Amount</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{rows.map((expense) => <tr key={expense.id}><td>{formatDate(expense.expenseDate)}</td><td><strong>{expense.category}</strong>{expense.referenceNumber && <small>Ref: {expense.referenceNumber}</small>}</td><td>{expense.description || "—"}</td><td>{supplierName(expense.supplierId)}</td><td>{label(expense.paymentMethod)}</td><td>{currency(expense.amount)}</td><td><span className={`expense-status ${expense.status === "VOIDED" ? "is-voided" : ""}`}>{expense.status === "VOIDED" ? "Cancelled" : "Recorded"}</span></td><td><div className="expense-row-actions"><button type="button" onClick={() => setDetails(expense)}>View</button>{canManageExpenses && expense.status !== "VOIDED" && <RowMenu label={`More actions for this ${expense.category} expense`} items={[{ label: "Edit expense", onClick: () => openEdit(expense) }, { label: "Cancel expense", onClick: () => handleVoid(expense), danger: true }]} />}</div></td></tr>)}</tbody></table><div className="mobile-cards">{rows.map((expense) => <button type="button" key={expense.id} className="mobile-card" onClick={() => setDetails(expense)}><span className="mobile-card__row"><span className="mobile-card__title">{expense.category}</span><span className="mobile-card__amount">{currency(expense.amount)}</span></span><span className="mobile-card__row"><span className="mobile-card__meta">{formatDate(expense.expenseDate)} · {label(expense.paymentMethod)}</span>{expense.status === "VOIDED" && <span className="expense-status is-voided">Cancelled</span>}</span></button>)}</div></div>}
        <div className="expenses-pagination"><span>Showing {visible.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, visible.length)} of {visible.length}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><strong>Page {page} of {pageCount}</strong><button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button></div></div>
      </section>
      {showForm && <div className="expenses-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setShowForm(false)}><form noValidate className="expenses-modal" onSubmit={submit}><div className="expenses-modal-heading"><h2>{editingId ? "Edit expense" : "Record expense"}</h2><button type="button" onClick={() => setShowForm(false)}>Close</button></div><div className="expenses-form-grid"><label>Date *<input type="date" name="expenseDate" value={form.expenseDate} onChange={changeForm} required /></label><label>Category *<div className="expense-category-field"><select name="category" value={form.category} onChange={changeForm} required aria-invalid={!form.category.trim()}><option value="">Select category</option>{form.category && !selectedCategory && <option value={form.category}>{form.category}</option>}{categoryGroups.map(([group, items]) => <optgroup key={group} label={group}>{items.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</optgroup>)}</select><button type="button" onClick={() => setShowCategoryForm(true)}>+</button></div></label><label>Amount (₹) *<input type="number" name="amount" min="0.01" step="0.01" value={form.amount} onChange={changeForm} required /></label><label>Payment method *<select name="paymentMethod" value={form.paymentMethod} onChange={changeForm}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{(selectedCategory?.staffPaymentType || selectedCategory?.groupName === "Staff") && <><label>Staff member{selectedCategory?.staffPaymentType ? " *" : ""}<select name="staffMemberId" value={form.staffMemberId} onChange={changeForm}><option value="">Choose staff</option>{activeStaff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label>For month{selectedCategory?.staffPaymentType ? " *" : ""}<input type="month" name="salaryMonth" value={form.salaryMonth} onChange={changeForm} /></label></>}{selectedCategory?.staffPaymentType === "SALARY" && <p className="expenses-field-wide expense-hint">Enter the amount actually paid now. Advances already given for this month are salary paid early, so do not include them again.</p>}<label>Paid to (optional)<input name="payee" maxLength="150" value={form.payee} onChange={changeForm} placeholder="Shop, person or company" /></label><label>Supplier (optional)<select name="supplierId" value={form.supplierId} onChange={changeForm}><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label>Reference number<input name="referenceNumber" maxLength="100" value={form.referenceNumber} onChange={changeForm} placeholder="Receipt or transaction ID" /></label><label className="expenses-field-wide">Description{selectedCategory?.requiresDescription ? " *" : ""}<input name="description" maxLength="500" value={form.description} onChange={changeForm} /></label><label className="expenses-field-wide">Notes<textarea name="notes" maxLength="1000" rows="3" value={form.notes} onChange={changeForm} /></label></div><div className="expenses-form-actions"><button type="button" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="expenses-primary-button" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Save expense"}</button></div></form></div>}
      {showCategoryForm && <div className="expenses-modal-backdrop nested" onMouseDown={(event) => event.target === event.currentTarget && setShowCategoryForm(false)}><form className="expenses-small-modal" onSubmit={addCategory}><h2>Add expense category</h2><input autoFocus value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="e.g. Office supplies" maxLength="100" /><div className="expenses-form-actions"><button type="button" onClick={() => setShowCategoryForm(false)}>Cancel</button><button className="expenses-primary-button">Add category</button></div></form></div>}
      {details && <div className="expenses-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetails(null)}><section className="expenses-small-modal"><div className="expenses-modal-heading"><h2>Expense details</h2><button type="button" onClick={() => setDetails(null)}>Close</button></div><div className="expense-detail-grid"><p><span>Date</span><strong>{formatDate(details.expenseDate)}</strong></p><p><span>Category</span><strong>{details.category}</strong></p><p><span>Amount</span><strong>{currency(details.amount)}</strong></p><p><span>Paid by</span><strong>{label(details.paymentMethod)}</strong></p><p><span>Supplier</span><strong>{supplierName(details.supplierId)}</strong></p><p><span>Status</span><strong>{details.status === "VOIDED" ? "Cancelled" : "Recorded"}</strong></p><p><span>Reference</span><strong>{details.referenceNumber || "—"}</strong></p><p><span>Description</span><strong>{details.description || "—"}</strong></p><p><span>Paid to</span><strong>{details.staffMemberName || details.payee || "—"}</strong></p>{details.salaryPeriod && <p><span>For month</span><strong>{String(details.salaryPeriod).slice(0, 7)}</strong></p>}<p><span>Recorded by</span><strong>{details.createdBy || "—"}</strong></p>{details.voidedBy && <p><span>Cancelled by</span><strong>{details.voidedBy}</strong></p>}</div>{details.notes && <p className="expense-notes"><b>Notes</b><br />{details.notes}</p>}<div className="expenses-form-actions">{details.status !== "VOIDED" && <><button type="button" onClick={() => openEdit(details)}>Edit</button><button type="button" className="is-danger" onClick={() => handleVoid(details)}>Cancel expense</button></>}</div></section></div>}
      {showStaff && <div className="expenses-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowStaff(false)}><section className="expenses-small-modal"><div className="expenses-modal-heading"><h2>Staff</h2><button type="button" onClick={() => setShowStaff(false)}>Close</button></div><p className="expense-hint">People you pay salary, wages or advances to. Turned-off staff stay in past expenses.</p><form className="expense-staff-add" onSubmit={addStaff}><input value={newStaffName} onChange={(event) => setNewStaffName(event.target.value)} placeholder="Full name" maxLength="120" aria-label="New staff member name" /><button type="submit" className="expenses-primary-button">Add</button></form><ul className="expense-staff-list">{staff.map((member) => <li key={member.id} className={member.active ? "" : "is-inactive"}><span>{member.name}</span><button type="button" onClick={() => toggleStaff(member)}>{member.active ? "Turn off" : "Turn on"}</button></li>)}{!staff.length && <li>No staff added yet.</li>}</ul></section></div>}
    </main>
  );
}

export default ExpensesPage;
