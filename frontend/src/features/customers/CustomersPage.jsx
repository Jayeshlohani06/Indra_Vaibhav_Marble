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
      setError(err.message || "Unable to load customers.");
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
  const inactiveCount = customers.length - activeCount;
  const totalCredit = customers.reduce(
    (total, customer) => total + Number(customer.creditLimit || 0),
    0
  );
  const gstRegisteredCount = customers.filter((customer) => customer.gstin).length;

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
      setError("Enter a valid phone number.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      setError("Credit limit must be zero or greater.");
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
        setNotice("Customer updated successfully.");
      } else {
        await createCustomer(payload);
        setNotice("Customer created successfully. Customer code was generated automatically.");
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      await loadCustomers();
    } catch (err) {
      setError(err.message || "Unable to save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(customer) {
    const action = customer.active ? "deactivate" : "reactivate";
    if (!window.confirm(`${action[0].toUpperCase() + action.slice(1)} ${customer.name}?`)) {
      return;
    }
    try {
      setError("");
      if (customer.active) await deactivateCustomer(customer.id);
      else await reactivateCustomer(customer.id);
      setNotice(`Customer ${action}d successfully.`);
      await loadCustomers();
    } catch (err) {
      setError(err.message || `Unable to ${action} customer.`);
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
      ].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
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
        <div>
          <p className="customers-eyebrow">CUSTOMER MANAGEMENT</p>
          <h2>Customers</h2>
          <p className="customers-subtitle">
            Manage customer profiles, contact details, and approved credit.
          </p>
        </div>
        <div className="customer-header-actions">
          <button type="button" className="customer-secondary-button" onClick={exportCsv} disabled={!filteredCustomers.length}>
            Export CSV
          </button>
          {canManageCustomers && <button type="button" className="customer-primary-button" onClick={openCreateForm}>
            <span aria-hidden="true">+</span> Add Customer
          </button>}
        </div>
      </div>

      {notice && <div className="customer-alert customer-alert-success" role="status">{notice}</div>}
      {error && <div className="customer-alert customer-alert-error" role="alert">{error}<button type="button" onClick={() => setError("")}>Dismiss</button></div>}

      <div className="customer-summary" aria-label="Customer overview">
        <div className="customer-summary-card is-blue">
          <div className="customer-summary-top"><span className="customer-summary-label">Active customers</span><span className="customer-summary-icon">A</span></div>
          <strong>{activeCount}</strong>
          <span className="customer-summary-note">Available for new sales</span>
        </div>
        <div className="customer-summary-card is-slate">
          <div className="customer-summary-top"><span className="customer-summary-label">Inactive customers</span><span className="customer-summary-icon">I</span></div>
          <strong>{inactiveCount}</strong>
          <span className="customer-summary-note">Retained for history</span>
        </div>
        <div className="customer-summary-card is-green">
          <div className="customer-summary-top"><span className="customer-summary-label">Approved credit</span><span className="customer-summary-icon">₹</span></div>
          <strong>{money(totalCredit)}</strong>
          <span className="customer-summary-note">Combined configured limits</span>
        </div>
        <div className="customer-summary-card is-amber">
          <div className="customer-summary-top"><span className="customer-summary-label">GST registered</span><span className="customer-summary-icon">G</span></div>
          <strong>{gstRegisteredCount}</strong>
          <span className="customer-summary-note">Profiles with a GSTIN</span>
        </div>
      </div>

      <div className="customers-panel">
        <div className="customers-toolbar">
          <div><h3>Customer directory</h3><p>Search by name, code, phone, email, or GSTIN.</p></div>
          <div className="customer-toolbar-controls">
            <input type="search" className="customer-search" placeholder="Search customers..." aria-label="Search customers" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <select value={status} aria-label="Customer status" onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="ACTIVE">Active customers</option>
              <option value="INACTIVE">Inactive customers</option>
              <option value="ALL">All customers</option>
            </select>
            <select value={sort} aria-label="Sort customers" onChange={(event) => setSort(event.target.value)}>
              <option value="name">Sort: Name</option>
              <option value="customerCode">Sort: Code</option>
              <option value="phone">Sort: Phone</option>
              <option value="creditLimit">Sort: Credit limit</option>
            </select>
            <button type="button" className="customer-secondary-button" onClick={() => { setSearch(""); setStatus("ACTIVE"); setSort("name"); setPage(1); }}>Clear</button>
          </div>
        </div>

        {loading ? <div className="customer-empty-state">Loading customers...</div> : !visibleCustomers.length ? (
          <div className="customer-empty-state"><div className="customer-empty-icon" aria-hidden="true">♙</div><h3>{search ? "No matching customers" : "No customers found"}</h3><p>{search ? "Try a different search term." : "Add your first customer to get started."}</p>{!search && canManageCustomers && <button type="button" className="customer-primary-button" onClick={openCreateForm}>Add your first customer</button>}</div>
        ) : (
          <div className="customers-table-wrap">
            <table className="customers-table">
              <thead><tr><th>Customer</th><th>Contact</th><th>GSTIN</th><th>Credit limit</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{visibleCustomers.map((customer) => <tr key={customer.id} onClick={() => setSelectedCustomer(customer)}>
                <td><div className="customer-name-cell"><span className="customer-avatar">{(customer.name || "C").charAt(0).toUpperCase()}</span><div><strong>{customer.name}</strong><span>{customer.customerCode}</span></div></div></td>
                <td><div className="customer-contact-cell"><span>{customer.phone}</span><span>{customer.email || "—"}</span></div></td>
                <td>{customer.gstin || "—"}</td>
                <td className="customer-money">{money(customer.creditLimit)}</td>
                <td><span className={`customer-status ${customer.active ? "is-active" : "is-inactive"}`}>{customer.active ? "Active" : "Inactive"}</span></td>
                <td><div className="customer-row-actions"><button type="button" className="customer-text-button" onClick={(event) => { event.stopPropagation(); setSelectedCustomer(customer); }}>View</button>{canManageCustomers && <><button type="button" className="customer-text-button" onClick={(event) => { event.stopPropagation(); openEditForm(customer); }}>Edit</button><button type="button" className={`customer-text-button ${customer.active ? "customer-danger-button" : ""}`} onClick={(event) => { event.stopPropagation(); changeStatus(customer); }}>{customer.active ? "Deactivate" : "Reactivate"}</button></>}</div></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}

        {!loading && <div className="customers-panel-footer"><span>Showing {filteredCustomers.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredCustomers.length)} of {filteredCustomers.length} customers</span><div className="customer-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><strong>Page {page} of {pageCount}</strong><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>}
      </div>

      {showForm && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setShowForm(false)}>
        <section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
          <div className="customer-modal-heading"><div><p className="customers-eyebrow">CUSTOMER INFORMATION</p><h2 id="customer-form-title">{editingId !== null ? "Edit customer" : "Add customer"}</h2></div><button type="button" className="customer-close-button" onClick={() => !saving && setShowForm(false)} disabled={saving} aria-label="Close form">×</button></div>
          <form onSubmit={handleSubmit}><div className="customer-form-grid">
            <label>Customer code {editingId !== null && "*"}<input name="customerCode" value={form.customerCode} onChange={handleChange} maxLength={30} disabled={editingId === null} placeholder={editingId === null ? "Generated automatically" : ""} required={editingId !== null} /><small>{editingId === null ? "A unique code will be generated when you save." : "Customer codes cannot be changed."}</small></label>
            <label>Customer name *<input name="name" value={form.name} onChange={handleChange} maxLength={150} required autoFocus /></label>
            <label>Phone *<input name="phone" type="tel" value={form.phone} onChange={handleChange} maxLength={20} required /></label>
            <label>Email<input name="email" type="email" value={form.email} onChange={handleChange} maxLength={150} /></label>
            <label>GSTIN<input name="gstin" value={form.gstin} onChange={handleChange} maxLength={15} placeholder="15-character GSTIN" /></label>
            <label>Credit limit (₹)<input name="creditLimit" type="number" min="0" step="0.01" value={form.creditLimit} onChange={handleChange} required /></label>
            <label className="customer-full-width">Billing address<textarea name="billingAddress" value={form.billingAddress} onChange={handleChange} rows={2} /></label>
            <label className="customer-full-width"><span className="customer-address-label">Shipping address <button type="button" onClick={() => setForm((current) => ({ ...current, shippingAddress: current.billingAddress }))}>Same as billing</button></span><textarea name="shippingAddress" value={form.shippingAddress} onChange={handleChange} rows={2} /></label>
          </div><div className="customer-form-actions"><button type="button" className="customer-secondary-button" onClick={() => !saving && setShowForm(false)} disabled={saving}>Cancel</button><button type="submit" className="customer-primary-button" disabled={saving}>{saving ? "Saving..." : editingId !== null ? "Save changes" : "Create customer"}</button></div></form>
        </section>
      </div>}

      {selectedCustomer && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedCustomer(null)}>
        <section className="customer-modal customer-details-modal" role="dialog" aria-modal="true" aria-labelledby="customer-details-title">
          <div className="customer-modal-heading"><div><p className="customers-eyebrow">CUSTOMER PROFILE</p><h2 id="customer-details-title">{selectedCustomer.name}</h2><p>{selectedCustomer.customerCode}</p></div><button type="button" className="customer-close-button" onClick={() => setSelectedCustomer(null)} aria-label="Close customer details">×</button></div>
          <div className="customer-detail-grid"><p><span>Phone</span><strong>{selectedCustomer.phone}</strong></p><p><span>Email</span><strong>{selectedCustomer.email || "—"}</strong></p><p><span>GSTIN</span><strong>{selectedCustomer.gstin || "Unregistered"}</strong></p><p><span>Credit limit</span><strong>{money(selectedCustomer.creditLimit)}</strong></p><p><span>Status</span><strong>{selectedCustomer.active ? "Active" : "Inactive"}</strong></p><p><span>Created</span><strong>{selectedCustomer.createdAt ? new Date(selectedCustomer.createdAt).toLocaleDateString("en-IN") : "—"}</strong></p></div>
          <div className="customer-address-grid"><div><span>Billing address</span><p>{selectedCustomer.billingAddress || "Not provided"}</p></div><div><span>Shipping address</span><p>{selectedCustomer.shippingAddress || "Not provided"}</p></div></div>
          <div className="customer-form-actions">{canManageCustomers && <button type="button" className="customer-secondary-button" onClick={() => { setSelectedCustomer(null); openEditForm(selectedCustomer); }}>Edit customer</button>}{canManageSales && <button type="button" className="customer-primary-button" onClick={() => { window.location.hash = "billing"; }}>Create sales order</button>}</div>
        </section>
      </div>}
    </section>
  );
}

export default CustomersPage;
