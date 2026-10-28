import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCustomer,
  deactivateCustomer,
  getCustomers,
  reactivateCustomer,
  updateCustomer,
} from "../../services/api/customerApi";
import "./CustomersPage.css";
import { usePermission } from "../../auth/PermissionsContext";
import RowMenu from "../../components/RowMenu";
import { formatDate } from "../../utils/format";
import { t } from "../../i18n";
import Skeleton from "../../components/Skeleton";

import FitText from "../../components/FitText";
const emptyForm = {
  customerCode: "",
  name: "",
  phone: "",
  email: "",
  gstin: "",
  billingAddress: "",
  shippingAddress: "",
  creditLimit: "0",
};
const PAGE_SIZE = 25;

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

function CustomersPage() {
  const canManageCustomers = usePermission("CUSTOMER_MANAGE");
  const canManageSales = usePermission("SALES_MANAGE");
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCustomers({ status });
      setCustomers(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || t("Unable to load customers."));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setShowForm(false);
        setSelectedCustomer(null);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = customers.filter((customer) =>
      !term ||
      [
        customer.customerCode,
        customer.name,
        customer.phone,
        customer.email,
        customer.gstin,
      ].some((value) => String(value || "").toLowerCase().includes(term))
    );
    return [...rows].sort((first, second) => {
      if (sort === "creditLimit") {
        return Number(first.creditLimit || 0) - Number(second.creditLimit || 0);
      }
      if (sort === "balanceDue") {
        return Number(second.balanceDue || 0) - Number(first.balanceDue || 0);
      }
      return String(first[sort] || "").localeCompare(
        String(second[sort] || "")
      );
    });
  }, [customers, search, sort]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredCustomers.length / PAGE_SIZE)
  );
  const visibleCustomers = filteredCustomers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const activeCount = customers.filter((customer) => customer.active).length;
  const owingCustomers = customers.filter(
    (customer) => Number(customer.balanceDue || 0) > 0
  );
  const totalDue = owingCustomers.reduce(
    (total, customer) => total + Number(customer.balanceDue || 0),
    0
  );

  function openCreateForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function openEditForm(customer) {
    setEditingId(customer.id);
    setForm({
      customerCode: customer.customerCode || "",
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      gstin: customer.gstin || "",
      billingAddress: customer.billingAddress || "",
      shippingAddress: customer.shippingAddress || "",
      creditLimit: String(customer.creditLimit ?? 0),
    });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const phone = form.phone.trim();
    const creditLimit = Number(form.creditLimit);
    if (!/^[0-9+()\- ]{7,20}$/.test(phone)) {
      setError(t("Enter a valid phone number."));
      setSaving(false);
      return;
    }
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      setError(t("Credit limit must be zero or greater."));
      setSaving(false);
      return;
    }
    const payload = {
      customerCode: editingId === null ? null : form.customerCode.trim(),
      name: form.name.trim(),
      phone,
      email: form.email.trim() || null,
      gstin: form.gstin.trim().toUpperCase() || null,
      billingAddress: form.billingAddress.trim() || null,
      shippingAddress: form.shippingAddress.trim() || null,
      creditLimit,
    };
    try {
      if (editingId !== null) {
        await updateCustomer(editingId, payload);
        setNotice(t("Customer updated successfully."));
      } else {
        await createCustomer(payload);
        setNotice(t("Customer created successfully. Customer code was generated automatically."));
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      await loadCustomers();
    } catch (err) {
      setError(err.message || t("Unable to save customer."));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(customer) {
    if (!window.confirm(customer.active ? t("Deactivate {name}?", { name: customer.name }) : t("Reactivate {name}?", { name: customer.name }))) {
      return;
    }
    try {
      setError("");
      if (customer.active) await deactivateCustomer(customer.id);
      else await reactivateCustomer(customer.id);
      setNotice(customer.active ? t("Customer deactivated successfully.") : t("Customer reactivated successfully."));
      await loadCustomers();
    } catch (err) {
      setError(err.message || (customer.active ? t("Unable to deactivate customer.") : t("Unable to reactivate customer.")));
    }
  }

  function exportCsv() {
    const header = ["Customer Code", "Name", "Phone", "Email", "GSTIN", "Credit Limit", "Status"];
    const rows = filteredCustomers.map((customer) =>
      [
        customer.customerCode,
        customer.name,
        customer.phone,
        customer.email || "",
        customer.gstin || "",
        customer.creditLimit,
        customer.active ? "Active" : "Inactive",
      ].map((value) => {
        // Prefix cells that spreadsheet apps would run as formulas.
        const text = String(value ?? "");
        const isFormula = /^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?$/.test(text);
        const safe = isFormula ? `'${text}` : text;
        return `"${safe.replaceAll('"', '""')}"`;
      })
    );
    const blob = new Blob(
      [[header, ...rows].map((row) => row.join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "customers.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="customers-page">
      <div className="customers-heading">
        <p className="customers-subtitle">
          {t("Everyone you sell to, and how much each of them owes you.")}
        </p>
        <div className="customer-header-actions">
          <button type="button" className="customer-secondary-button" onClick={exportCsv} disabled={!filteredCustomers.length}>
            {t("Export CSV")}
          </button>
          {canManageCustomers && <button type="button" className="customer-primary-button" onClick={openCreateForm}>
            <span aria-hidden="true">+</span> {t("Add customer")}
          </button>}
        </div>
      </div>

      {notice && <div className="customer-alert customer-alert-success" role="status">{notice}</div>}
      {error && <div className="customer-alert customer-alert-error" role="alert">{error}<button type="button" onClick={() => setError("")}>{t("Dismiss")}</button></div>}

      <div className="customer-summary" aria-label={t("Customer overview")}>
        <div className="customer-summary-card is-amber">
          <span className="customer-summary-label">{t("Customers owe you")}</span>
          <FitText>{money(totalDue)}</FitText>
          <span className="customer-summary-note">{owingCustomers.length === 1 ? t("From {count} customer", { count: owingCustomers.length }) : t("From {count} customers", { count: owingCustomers.length })}</span>
        </div>
        <div className="customer-summary-card is-blue">
          <span className="customer-summary-label">{t("Customers")}</span>
          <FitText>{activeCount}</FitText>
          <span className="customer-summary-note">{t("Active customers you can bill")}</span>
        </div>
      </div>

      <div className="customers-panel">
        <div className="customers-toolbar">
          <div><h3>{t("All customers")}</h3><p>{t("Tap a customer to see their details.")}</p></div>
          <div className="customer-toolbar-controls">
            <input type="search" className="customer-search" placeholder={t("Search name or phone")} aria-label={t("Search customers")} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <select value={status} aria-label={t("Customer status")} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="ACTIVE">{t("Active customers")}</option>
              <option value="INACTIVE">{t("Inactive customers")}</option>
              <option value="ALL">{t("All customers")}</option>
            </select>
            <select value={sort} aria-label={t("Sort customers")} onChange={(event) => setSort(event.target.value)}>
              <option value="name">{t("Sort: Name")}</option>
              <option value="balanceDue">{t("Sort: Owes the most")}</option>
              <option value="customerCode">{t("Sort: Code")}</option>
            </select>
            <button type="button" className="customer-secondary-button" onClick={() => { setSearch(""); setStatus("ACTIVE"); setSort("name"); setPage(1); }}>{t("Clear")}</button>
          </div>
        </div>

        {loading ? <Skeleton label={t("Loading customers...")} /> : !visibleCustomers.length ? (
          <div className="customer-empty-state"><div className="customer-empty-icon" aria-hidden="true">♙</div><h3>{search ? t("No matching customers") : t("No customers found")}</h3><p>{search ? t("Try a different search term.") : t("Add your first customer to get started.")}</p>{!search && canManageCustomers && <button type="button" className="customer-primary-button" onClick={openCreateForm}>{t("Add your first customer")}</button>}</div>
        ) : (
          <div className="customers-table-wrap has-mobile-cards">
            <table className="customers-table desktop-table">
              <thead><tr><th>{t("Customer")}</th><th>{t("Contact")}</th><th className="num">{t("Owes you")}</th><th>{t("Status")}</th><th><span className="visually-hidden">{t("Actions")}</span></th></tr></thead>
              <tbody>{visibleCustomers.map((customer) => <tr key={customer.id} onClick={() => setSelectedCustomer(customer)}>
                <td><div className="customer-name-cell"><span className="customer-avatar">{(customer.name || "C").charAt(0).toUpperCase()}</span><div><strong>{customer.name}</strong><span>{customer.customerCode}</span></div></div></td>
                <td><div className="customer-contact-cell"><span>{customer.phone}</span><span>{customer.email || "—"}</span></div></td>
                <td className={`customer-money num ${Number(customer.balanceDue) > 0 ? "is-due" : ""}`}>{Number(customer.balanceDue) > 0 ? money(customer.balanceDue) : "—"}</td>
                <td><span className={`customer-status ${customer.active ? "is-active" : "is-inactive"}`}>{customer.active ? t("Active") : t("Inactive")}</span></td>
                <td><div className="customer-row-actions"><button type="button" className="customer-secondary-button customer-view-button" onClick={(event) => { event.stopPropagation(); setSelectedCustomer(customer); }}>{t("View")}</button>{canManageCustomers && <RowMenu label={t("More actions for {name}", { name: customer.name })} items={[
                  { label: t("Edit details"), onClick: () => openEditForm(customer) },
                  { label: customer.active ? t("Deactivate customer") : t("Reactivate customer"), onClick: () => changeStatus(customer), danger: customer.active },
                ]} />}</div></td>
              </tr>)}</tbody>
            </table>

            <div className="mobile-cards">
              {visibleCustomers.map((customer) => (
                <button type="button" key={customer.id} className="mobile-card" onClick={() => setSelectedCustomer(customer)}>
                  <span className="mobile-card__row">
                    <span className="mobile-card__title">{customer.name}</span>
                    {Number(customer.balanceDue) > 0
                      ? <span className="mobile-card__amount customer-card-due">{t("{amount} due", { amount: money(customer.balanceDue) })}</span>
                      : <span className="mobile-card__meta">{t("Nothing due")}</span>}
                  </span>
                  <span className="mobile-card__row">
                    <span className="mobile-card__meta">{customer.phone}</span>
                    {!customer.active && <span className="customer-status is-inactive">{t("Inactive")}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && <div className="customers-panel-footer"><span>{t("Showing {from}–{to} of {total} customers", { from: filteredCustomers.length ? (page - 1) * PAGE_SIZE + 1 : 0, to: Math.min(page * PAGE_SIZE, filteredCustomers.length), total: filteredCustomers.length })}</span><div className="customer-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{t("Previous")}</button><strong>{t("Page {page} of {pages}", { page, pages: pageCount })}</strong><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>{t("Next")}</button></div></div>}
      </div>

      {showForm && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setShowForm(false)}>
        <section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
          <div className="customer-modal-heading"><div><h2 id="customer-form-title">{editingId !== null ? t("Edit customer") : t("Add customer")}</h2></div><button type="button" className="customer-close-button" onClick={() => !saving && setShowForm(false)} disabled={saving} aria-label={t("Close form")}>×</button></div>
          <form onSubmit={handleSubmit}><div className="customer-form-grid">
            <label>{t("Customer code")} {editingId !== null && "*"}<input name="customerCode" value={form.customerCode} onChange={handleChange} maxLength={30} disabled={editingId === null} placeholder={editingId === null ? t("Generated automatically") : ""} required={editingId !== null} /><small>{editingId === null ? t("A unique code will be generated when you save.") : t("Customer codes cannot be changed.")}</small></label>
            <label>{t("Customer name")} *<input name="name" value={form.name} onChange={handleChange} maxLength={150} required autoFocus /></label>
            <label>{t("Phone")} *<input name="phone" type="tel" value={form.phone} onChange={handleChange} maxLength={20} required /></label>
            <label>{t("Email")}<input name="email" type="email" value={form.email} onChange={handleChange} maxLength={150} /></label>
            <label>GSTIN<input name="gstin" value={form.gstin} onChange={handleChange} maxLength={15} placeholder={t("15-character GSTIN")} /></label>
            <label>{t("Credit limit (₹)")}<input name="creditLimit" type="number" min="0" step="0.01" value={form.creditLimit} onChange={handleChange} required /></label>
            <label className="customer-full-width">{t("Billing address")}<textarea name="billingAddress" value={form.billingAddress} onChange={handleChange} rows={2} /></label>
            <label className="customer-full-width"><span className="customer-address-label">{t("Shipping address")} <button type="button" onClick={() => setForm((current) => ({ ...current, shippingAddress: current.billingAddress }))}>{t("Same as billing")}</button></span><textarea name="shippingAddress" value={form.shippingAddress} onChange={handleChange} rows={2} /></label>
          </div><div className="customer-form-actions"><button type="button" className="customer-secondary-button" onClick={() => !saving && setShowForm(false)} disabled={saving}>{t("Cancel")}</button><button type="submit" className="customer-primary-button" disabled={saving}>{saving ? t("Saving...") : editingId !== null ? t("Save changes") : t("Create customer")}</button></div></form>
        </section>
      </div>}

      {selectedCustomer && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedCustomer(null)}>
        <section className="customer-modal customer-details-modal" role="dialog" aria-modal="true" aria-labelledby="customer-details-title">
          <div className="customer-modal-heading"><div><h2 id="customer-details-title">{selectedCustomer.name}</h2><p>{selectedCustomer.customerCode}</p></div><button type="button" className="customer-close-button" onClick={() => setSelectedCustomer(null)} aria-label={t("Close customer details")}>×</button></div>
          <div className="customer-detail-grid"><p><span>{t("Phone")}</span><strong>{selectedCustomer.phone}</strong></p><p><span>{t("Email")}</span><strong>{selectedCustomer.email || "—"}</strong></p><p><span>GSTIN</span><strong>{selectedCustomer.gstin || t("Unregistered")}</strong></p><p><span>{t("Owes you")}</span><strong>{money(selectedCustomer.balanceDue)}</strong></p><p><span>{t("Credit limit")}</span><strong>{money(selectedCustomer.creditLimit)}</strong></p><p><span>{t("Status")}</span><strong>{selectedCustomer.active ? t("Active") : t("Inactive")}</strong></p><p><span>{t("Created")}</span><strong>{formatDate(selectedCustomer.createdAt)}</strong></p></div>
          <div className="customer-address-grid"><div><span>{t("Billing address")}</span><p>{selectedCustomer.billingAddress || t("Not provided")}</p></div><div><span>{t("Shipping address")}</span><p>{selectedCustomer.shippingAddress || t("Not provided")}</p></div></div>
          <div className="customer-form-actions">{canManageCustomers && <button type="button" className="customer-secondary-button" onClick={() => { setSelectedCustomer(null); openEditForm(selectedCustomer); }}>{t("Edit customer")}</button>}{canManageSales && <button type="button" className="customer-primary-button" onClick={() => { window.location.hash = "billing"; }}>{t("New sale")}</button>}</div>
        </section>
      </div>}
    </section>
  );
}

export default CustomersPage;
