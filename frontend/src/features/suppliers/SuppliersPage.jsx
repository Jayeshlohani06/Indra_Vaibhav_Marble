
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createSupplier,
  deactivateSupplier,
  getSuppliers,
  reactivateSupplier,
  updateSupplier,
} from "../../services/api/supplierApi";
import "./SuppliersPage.css";
import RowMenu from "../../components/RowMenu";
import { usePermission } from "../../auth/PermissionsContext";

const emptyForm = {
  supplierCode: "",
  name: "",
  contactPerson: "",
  phone: "",
  alternatePhone: "",
  email: "",
  gstin: "",
  addressLine: "",
  city: "",
  state: "",
  postalCode: "",
  notes: "",
};

const fields = [
  { name: "supplierCode", label: "Supplier Code", maxLength: 50 },
  { name: "name", label: "Supplier Name", required: true, maxLength: 150 },
  { name: "contactPerson", label: "Contact Person", maxLength: 120 },
  { name: "phone", label: "Phone", maxLength: 20 },
  { name: "alternatePhone", label: "Alternate Phone", maxLength: 20 },
  {
  name: "email",
  label: "Email",
  type: "email",
  maxLength: 150,
},
{
  name: "gstin",
  label: "GSTIN",
  maxLength: 15,
},
  { name: "city", label: "City", maxLength: 100 },
  { name: "state", label: "State", maxLength: 100 },
  { name: "postalCode", label: "Postal Code", maxLength: 10 },
];


function validateSupplier(form) {
  if (!form.name.trim()) {
    return "Supplier name is required.";
  }

  if (form.email.trim()) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(form.email.trim())) {
      return "Please enter a valid email address.";
    }
  }

  if (form.gstin.trim() && form.gstin.trim().length !== 15) {
    return "GSTIN must contain exactly 15 characters.";
  }

  return "";
}


function SuppliersPage() {
  const canManageSuppliers = usePermission("SUPPLIER_MANAGE");
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [detailsSupplier, setDetailsSupplier] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getSuppliers({ status });
      setSuppliers(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Unable to load suppliers.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  
  const filteredSuppliers = useMemo(() => suppliers.filter((supplier) => {
    const term = search.trim().toLowerCase();

    if (!term) return true;

    return [
      supplier.supplierCode,
      supplier.name,
      supplier.contactPerson,
      supplier.phone,
      supplier.alternatePhone,
      supplier.email,
      supplier.gstin,
      supplier.addressLine,
      supplier.city,
      supplier.state,
      supplier.postalCode,
    ].some((value) =>
      String(value ?? "").toLowerCase().includes(term)
    );
  }).sort((first, second) =>
    String(first[sort] || "").localeCompare(String(second[sort] || ""))
  ), [search, sort, suppliers]);
  const PAGE_SIZE = 10;
  const pageCount = Math.max(1, Math.ceil(filteredSuppliers.length / PAGE_SIZE));
  const visibleSuppliers = filteredSuppliers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const activeCount = suppliers.filter((supplier) => supplier.active).length;
  const inactiveCount = suppliers.length - activeCount;
  const gstCount = suppliers.filter((supplier) => supplier.gstin).length;

  function openAddForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(supplier) {
    setEditingId(supplier.id);

    setForm({
      ...emptyForm,
      ...supplier,
      supplierCode: supplier.supplierCode || "",
      name: supplier.name || "",
      contactPerson: supplier.contactPerson || "",
      phone: supplier.phone || "",
      alternatePhone: supplier.alternatePhone || "",
      email: supplier.email || "",
      gstin: supplier.gstin || "",
      addressLine: supplier.addressLine || "",
      city: supplier.city || "",
      state: supplier.state || "",
      postalCode: supplier.postalCode || "",
      notes: supplier.notes || "",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  
async function handleSubmit(event) {
  event.preventDefault();

  const validationError = validateSupplier(form);

  if (validationError) {
    setError(validationError);
    setSuccess("");
    return;
  }

  setSaving(true);
  setError("");
  setSuccess("");

  const payload = {
    ...form,
    supplierCode: form.supplierCode.trim() || null,
    name: form.name.trim(),
    contactPerson: form.contactPerson.trim() || null,
    phone: form.phone.trim() || null,
    alternatePhone: form.alternatePhone.trim() || null,
    email: form.email.trim() || null,
    gstin: form.gstin.trim().toUpperCase() || null,
    addressLine: form.addressLine.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    postalCode: form.postalCode.trim() || null,
    notes: form.notes.trim() || null,
  };

  try {
    if (editingId !== null) {
      await updateSupplier(editingId, payload);
    } else {
      await createSupplier(payload);
    }

    setShowForm(false);
    setForm({ ...emptyForm });
    setEditingId(null);

    setSuccess(
      editingId !== null
        ? "Supplier updated successfully."
        : "Supplier created successfully."
    );

    await loadSuppliers();
  } catch (err) {
    setError(err.message || "Unable to save supplier.");
  } finally {
    setSaving(false);
  }
}


  async function handleStatusChange(supplier) {
    const action = supplier.active ? "deactivate" : "reactivate";
    const confirmed = window.confirm(
      `${action[0].toUpperCase() + action.slice(1)} "${supplier.name}"?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      if (supplier.active) {
        await deactivateSupplier(supplier.id);
      } else {
        await reactivateSupplier(supplier.id);
      }
      setSuccess(`${supplier.name} was ${action}d.`);
      await loadSuppliers();
    } catch (err) {
      setError(err.message || `Unable to ${action} supplier.`);
    }
  }

  return (
    <section className="suppliers-page">
      <div className="suppliers-heading">
        <p className="suppliers-subtitle">
          The companies you buy from and how to reach them.
        </p>

        {canManageSuppliers && <button className="supplier-primary-button" onClick={openAddForm}>
          + Add supplier
        </button>}
      </div>

      {error && (
        <div className="supplier-alert supplier-alert-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="supplier-alert supplier-alert-success" role="status">
          {success}
        </div>
      )}

      <div className="supplier-summary">
        <div className="supplier-summary-card is-blue"><span>Suppliers</span><strong>{activeCount}</strong><small>Active suppliers you buy from</small></div>
        <div className="supplier-summary-card is-green"><span>With GSTIN</span><strong>{gstCount}</strong><small>Registered for GST</small></div>
        <div className="supplier-summary-card is-slate"><span>Inactive</span><strong>{inactiveCount}</strong><small>Kept for old records</small></div>
      </div>

      {showForm && (
        <div className="supplier-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setShowForm(false)}>
        <form className="supplier-form-card supplier-modal" onSubmit={handleSubmit}>
          <div className="supplier-form-heading">
            <h3>{editingId !== null ? "Edit supplier" : "Add supplier"}</h3>
            {canManageSuppliers && <button
              type="button"
              className="supplier-text-button"
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
            >
              Cancel
            </button>}
          </div>

          <div className="supplier-form-grid">
            {fields.map((field) => (
              <label className="supplier-field" key={field.name}>
                <span>
                  {field.label}
                  {field.required && <b> *</b>}
                </span>

                <input
                  name={field.name}
                  type={field.type || "text"}
                  value={form[field.name] ?? ""}
                  onChange={handleChange}
                  required={field.required || false}
                  maxLength={field.maxLength}
                />
              </label>
            ))}

            <label className="supplier-field supplier-field-wide">
              <span>Address</span>
              <textarea
                name="addressLine"
                value={form.addressLine}
                onChange={handleChange}
                rows={2}
              />
            </label>

            <label className="supplier-field supplier-field-wide">
              <span>Notes</span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
              />
            </label>
          </div>

          <div className="supplier-form-actions">
            <button
              type="button"
              className="supplier-secondary-button"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="supplier-primary-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Save Changes"
                  : "Create Supplier"}
            </button>
          </div>
        </form>
        </div>
      )}

      <div className="supplier-table-card">
        <div className="supplier-table-toolbar">
          <div>
            <h3>All suppliers</h3>
            <p>Tap a supplier to see their full details.</p>
          </div>

          <input
            className="supplier-search"
            type="search"
            placeholder="Search name, code, phone..."
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            aria-label="Search suppliers"
          />
          <select value={status} aria-label="Supplier status" onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="ACTIVE">Active suppliers</option>
            <option value="INACTIVE">Inactive suppliers</option>
            <option value="ALL">All suppliers</option>
          </select>
          <select value={sort} aria-label="Sort suppliers" onChange={(event) => setSort(event.target.value)}>
            <option value="name">Sort: Name</option>
            <option value="supplierCode">Sort: Code</option>
            <option value="city">Sort: City</option>
          </select>
          <button type="button" className="supplier-secondary-button" onClick={() => { setSearch(""); setStatus("ACTIVE"); setSort("name"); setPage(1); }}>Clear</button>
        </div>

        {loading ? (
          <div className="supplier-empty-state">Loading suppliers...</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="supplier-empty-state">
            <h3>{search ? "No matching suppliers" : "No suppliers found"}</h3>
            <p>
              {search
                ? "Try a different search term."
                : "Add your first supplier to get started."}
            </p>
          </div>
        ) : (
          <div className="supplier-table-scroll has-mobile-cards">
            <table className="supplier-table desktop-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact</th>
                  <th>GSTIN</th>
                  <th>Location</th>
                  <th><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>

              <tbody>
                {visibleSuppliers.map((supplier) => (
                  <tr key={supplier.id} onClick={() => setDetailsSupplier(supplier)}>
                    <td>
                      <strong>{supplier.name}</strong>
                      <small>{supplier.supplierCode || "No supplier code"}</small>
                    </td>
                    <td>
                      <span>{supplier.contactPerson || "—"}</span>
                      <small>{supplier.phone || "No phone"}</small>
                      {supplier.email && <small>{supplier.email}</small>}
                    </td>
                    <td>{supplier.gstin || "—"}</td>
                    <td>
                      {[supplier.city, supplier.state]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td>
                      <div className="supplier-row-actions">
                        <button
                          type="button"
                          className="supplier-action-button"
                          onClick={(event) => { event.stopPropagation(); setDetailsSupplier(supplier); }}
                        >
                          View
                        </button>
                        {canManageSuppliers && <RowMenu label={`More actions for ${supplier.name}`} items={[
                          { label: "Edit details", onClick: () => openEditForm(supplier) },
                          {
                            label: supplier.active ? "Deactivate supplier" : "Reactivate supplier",
                            onClick: () => handleStatusChange(supplier),
                            danger: supplier.active,
                          },
                        ]} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mobile-cards">
              {visibleSuppliers.map((supplier) => (
                <button type="button" key={supplier.id} className="mobile-card" onClick={() => setDetailsSupplier(supplier)}>
                  <span className="mobile-card__row">
                    <span className="mobile-card__title">{supplier.name}</span>
                    {!supplier.active && <span className="mobile-card__meta">Inactive</span>}
                  </span>
                  <span className="mobile-card__meta">
                    {[supplier.phone, [supplier.city, supplier.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "No contact details"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="supplier-pagination"><span>Showing {filteredSuppliers.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredSuppliers.length)} of {filteredSuppliers.length}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><strong>Page {page} of {pageCount}</strong><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
      </div>

      {detailsSupplier && (
        <div className="supplier-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetailsSupplier(null)}>
          <section className="supplier-details-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-details-title">
            <div className="supplier-form-heading"><div><h2 id="supplier-details-title">{detailsSupplier.name}</h2><p>{detailsSupplier.supplierCode || "No supplier code"}</p></div><button type="button" className="supplier-secondary-button" onClick={() => setDetailsSupplier(null)}>Close</button></div>
            <div className="supplier-detail-grid"><p><span>Contact person</span><strong>{detailsSupplier.contactPerson || "—"}</strong></p><p><span>Phone</span><strong>{detailsSupplier.phone || "—"}</strong></p><p><span>Email</span><strong>{detailsSupplier.email || "—"}</strong></p><p><span>GSTIN</span><strong>{detailsSupplier.gstin || "Unregistered"}</strong></p><p><span>Location</span><strong>{[detailsSupplier.city, detailsSupplier.state, detailsSupplier.postalCode].filter(Boolean).join(", ") || "—"}</strong></p><p><span>Status</span><strong>{detailsSupplier.active ? "Active" : "Inactive"}</strong></p></div>
            <div className="supplier-detail-address"><span>Address</span><p>{detailsSupplier.addressLine || "Not provided"}</p></div>
            <div className="supplier-form-actions">{canManageSuppliers && <button type="button" className="supplier-secondary-button" onClick={() => { setDetailsSupplier(null); openEditForm(detailsSupplier); }}>Edit supplier</button>}{canManageSuppliers && <button type="button" className={`supplier-primary-button ${detailsSupplier.active ? "supplier-danger-button" : ""}`} onClick={() => { setDetailsSupplier(null); handleStatusChange(detailsSupplier); }}>{detailsSupplier.active ? "Deactivate" : "Reactivate"}</button>}</div>
          </section>
        </div>
      )}
    </section>
  );
}

export default SuppliersPage;
