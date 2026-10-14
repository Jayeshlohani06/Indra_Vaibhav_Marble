
import { useCallback, useEffect, useState } from "react";
import {
  createCustomer,
  deactivateCustomer,
  getCustomers,
  updateCustomer,
} from "../../services/api/customerApi";
import "./CustomersPage.css";

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

function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getCustomers();
      setCustomers(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = customers.filter((customer) => {
    const term = search.trim().toLowerCase();

    if (!term) return true;

    return [
      customer.customerCode,
      customer.name,
      customer.phone,
      customer.email,
      customer.gstin,
    ].some((value) => value?.toLowerCase().includes(term));
  });

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
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

    const payload = {
      ...form,
      customerCode: form.customerCode.trim(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      gstin: form.gstin.trim().toUpperCase() || null,
      billingAddress: form.billingAddress.trim() || null,
      shippingAddress: form.shippingAddress.trim() || null,
      creditLimit: Number(form.creditLimit),
    };

    try {
      if (editingId !== null) {
        await updateCustomer(editingId, payload);
        setNotice("Customer updated successfully.");
      } else {
        await createCustomer(payload);
        setNotice("Customer created successfully.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadCustomers();
    } catch (err) {
      setError(err.message || "Unable to save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(customer) {
    const confirmed = window.confirm(
      `Deactivate ${customer.name} (${customer.customerCode})?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await deactivateCustomer(customer.id);
      setNotice("Customer deactivated successfully.");
      await loadCustomers();
    } catch (err) {
      setError(err.message || "Unable to deactivate customer.");
    }
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <section className="customers-page">
      <div className="customers-heading">
        <div>
          <p className="customers-eyebrow">CUSTOMER MANAGEMENT</p>
          <h2>Customers</h2>
          <p className="customers-subtitle">
            Manage customer details and credit limits in one place.
          </p>
        </div>

        <button
          type="button"
          className="customer-primary-button"
          onClick={openCreateForm}
        >
          <span aria-hidden="true">+</span> Add Customer
        </button>
      </div>

      {notice && (
        <div className="customer-alert customer-alert-success" role="status">
          {notice}
        </div>
      )}

      {error && (
        <div className="customer-alert customer-alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="customer-summary">
        <div className="customer-summary-card">
          <span className="customer-summary-label">Active customers</span>
          <strong>{customers.length}</strong>
          <span className="customer-summary-note">
            Registered in the system
          </span>
        </div>

        <div className="customer-summary-card">
          <span className="customer-summary-label">Total credit limits</span>
          <strong>
            {customers
              .reduce(
                (total, customer) =>
                  total + Number(customer.creditLimit || 0),
                0
              )
              .toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 2,
              })}
          </strong>
          <span className="customer-summary-note">
            Combined approved limits
          </span>
        </div>
      </div>

      <div className="customers-panel">
        <div className="customers-toolbar">
          <div>
            <h3>Customer directory</h3>
            <p>Search by name, customer code, phone, email, or GSTIN.</p>
          </div>

          <input
            type="search"
            className="customer-search"
            placeholder="Search customers..."
            aria-label="Search customers"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <div className="customer-empty-state">Loading customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="customer-empty-state">
            <div className="customer-empty-icon" aria-hidden="true">
              ♙
            </div>
            <h3>{search ? "No matching customers" : "No customers found"}</h3>
            <p>
              {search
                ? "Try a different search term."
                : "Add your first customer to get started."}
            </p>
            {!search && (
              <button
                type="button"
                className="customer-primary-button"
                onClick={openCreateForm}
              >
                Add your first customer
              </button>
            )}
          </div>
        ) : (
          <div className="customers-table-wrap">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>GSTIN</th>
                  <th>Credit limit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="customer-name-cell">
                        <span className="customer-avatar">
                          {(customer.name || "C").charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <strong>{customer.name}</strong>
                          <span>{customer.customerCode}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="customer-contact-cell">
                        <span>{customer.phone}</span>
                        <span>{customer.email || "—"}</span>
                      </div>
                    </td>

                    <td>{customer.gstin || "—"}</td>

                    <td className="customer-money">
                      {Number(customer.creditLimit || 0).toLocaleString(
                        "en-IN",
                        {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 2,
                        }
                      )}
                    </td>

                    <td>
                      <span
                        className={`customer-status ${
                          customer.active ? "is-active" : "is-inactive"
                        }`}
                      >
                        {customer.active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="customer-row-actions">
                        <button
                          type="button"
                          className="customer-text-button"
                          onClick={() => openEditForm(customer)}
                        >
                          Edit
                        </button>

                        {customer.active && (
                          <button
                            type="button"
                            className="customer-text-button customer-danger-button"
                            onClick={() => handleDeactivate(customer)}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <div className="customers-panel-footer">
            Showing {filteredCustomers.length} of {customers.length} customers
          </div>
        )}
      </div>

      {showForm && (
        <div
          className="customer-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            className="customer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-form-title"
          >
            <div className="customer-modal-heading">
              <div>
                <p className="customers-eyebrow">
                  CUSTOMER INFORMATION
                </p>
                <h2 id="customer-form-title">
                  {editingId !== null ? "Edit customer" : "Add customer"}
                </h2>
              </div>

              <button
                type="button"
                className="customer-close-button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="customer-form-grid">
                <label>
                  Customer code *
                  <input
                    name="customerCode"
                    value={form.customerCode}
                    onChange={handleChange}
                    maxLength={30}
                    required
                    autoComplete="off"
                  />
                </label>

                <label>
                  Customer name *
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    maxLength={150}
                    required
                    autoComplete="name"
                  />
                </label>

                <label>
                  Phone *
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    maxLength={20}
                    required
                    autoComplete="tel"
                  />
                </label>

                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    maxLength={150}
                    autoComplete="email"
                  />
                </label>

                <label>
                  GSTIN
                  <input
                    name="gstin"
                    value={form.gstin}
                    onChange={handleChange}
                    maxLength={15}
                    placeholder="15-character GSTIN"
                  />
                </label>

                <label>
                  Credit limit (₹)
                  <input
                    name="creditLimit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.creditLimit}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label className="customer-full-width">
                  Billing address
                  <textarea
                    name="billingAddress"
                    value={form.billingAddress}
                    onChange={handleChange}
                    rows={2}
                  />
                </label>

                <label className="customer-full-width">
                  Shipping address
                  <textarea
                    name="shippingAddress"
                    value={form.shippingAddress}
                    onChange={handleChange}
                    rows={2}
                  />
                </label>
              </div>

              <div className="customer-form-actions">
                <button
                  type="button"
                  className="customer-secondary-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="customer-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Save changes"
                      : "Create customer"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

export default CustomersPage;
