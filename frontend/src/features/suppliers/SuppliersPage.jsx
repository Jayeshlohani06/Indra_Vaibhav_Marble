
import { useCallback, useEffect, useState } from "react";
import {
  createSupplier,
  deactivateSupplier,
  getSuppliers,
  updateSupplier,
} from "../../services/api/supplierApi";
import "./SuppliersPage.css";

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
  { name: "email", label: "Email", type: "email", maxLength: 150 },
  { name: "gstin", label: "GSTIN", maxLength: 15 },
  { name: "city", label: "City", maxLength: 100 },
  { name: "state", label: "State", maxLength: 100 },
  { name: "postalCode", label: "Postal Code", maxLength: 10 },
];

function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
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
      const result = await getSuppliers();
      setSuppliers(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Unable to load suppliers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const filteredSuppliers = suppliers.filter((supplier) => {
    const term = search.trim().toLowerCase();

    if (!term) return true;

    return [
      supplier.supplierCode,
      supplier.name,
      supplier.contactPerson,
      supplier.phone,
      supplier.email,
      supplier.gstin,
      supplier.city,
    ].some((value) => value?.toLowerCase().includes(term));
  });

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
        setSuccess("Supplier updated successfully.");
      } else {
        await createSupplier(payload);
        setSuccess("Supplier created successfully.");
      }

      setShowForm(false);
      setForm({ ...emptyForm });
      setEditingId(null);
      await loadSuppliers();
    } catch (err) {
      setError(err.message || "Unable to save supplier.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(supplier) {
    const confirmed = window.confirm(
      `Deactivate "${supplier.name}"? This supplier will no longer appear in the active supplier list.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await deactivateSupplier(supplier.id);
      setSuccess(`${supplier.name} was deactivated.`);
      await loadSuppliers();
    } catch (err) {
      setError(err.message || "Unable to deactivate supplier.");
    }
  }

  return (
    <section className="suppliers-page">
      <div className="suppliers-heading">
        <div>
          <p className="suppliers-eyebrow">PURCHASE MANAGEMENT</p>
          <h2>Suppliers</h2>
          <p className="suppliers-subtitle">
            Manage supplier companies and their contact information.
          </p>
        </div>

        <button className="supplier-primary-button" onClick={openAddForm}>
          + Add Supplier
        </button>
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
        <div className="supplier-summary-card">
          <span>Active Suppliers</span>
          <strong>{suppliers.length}</strong>
        </div>

        <div className="supplier-summary-card">
          <span>Matching Results</span>
          <strong>{filteredSuppliers.length}</strong>
        </div>
      </div>

      {showForm && (
        <form className="supplier-form-card" onSubmit={handleSubmit}>
          <div className="supplier-form-heading">
            <h3>{editingId !== null ? "Edit Supplier" : "Add Supplier"}</h3>
            <button
              type="button"
              className="supplier-text-button"
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
            >
              Cancel
            </button>
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
      )}

      <div className="supplier-table-card">
        <div className="supplier-table-toolbar">
          <div>
            <h3>Supplier Directory</h3>
            <p>Contact details for your business suppliers.</p>
          </div>

          <input
            className="supplier-search"
            type="search"
            placeholder="Search name, code, phone..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search suppliers"
          />
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
          <div className="supplier-table-scroll">
            <table className="supplier-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact</th>
                  <th>GSTIN</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
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
                          onClick={() => openEditForm(supplier)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="supplier-action-button supplier-danger-button"
                          onClick={() => handleDeactivate(supplier)}
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default SuppliersPage;
