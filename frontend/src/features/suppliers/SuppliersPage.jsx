
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
import { t } from "../../i18n";
import Skeleton from "../../components/Skeleton";

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
  { name: "phone", label: "Phone", type: "tel", maxLength: 20, half: true },
  { name: "alternatePhone", label: "Alternate Phone", type: "tel", maxLength: 20, half: true },
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
  { name: "city", label: "City", maxLength: 100, half: true },
  { name: "state", label: "State", maxLength: 100, half: true },
  { name: "postalCode", label: "Postal Code", inputMode: "numeric", maxLength: 10 },
];


function validateSupplier(form) {
  if (!form.name.trim()) {
    return t("Supplier name is required.");
  }

  if (form.email.trim()) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(form.email.trim())) {
      return t("Please enter a valid email address.");
    }
  }

  if (form.gstin.trim() && form.gstin.trim().length !== 15) {
    return t("GSTIN must contain exactly 15 characters.");
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
      setError(err.message || t("Unable to load suppliers."));
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
        ? t("Supplier updated successfully.")
        : t("Supplier created successfully.")
    );

    await loadSuppliers();
  } catch (err) {
    setError(err.message || t("Unable to save supplier."));
  } finally {
    setSaving(false);
  }
}


  async function handleStatusChange(supplier) {
    const action = supplier.active ? "deactivate" : "reactivate";
    const confirmed = window.confirm(
      supplier.active
        ? t("Deactivate \"{name}\"?", { name: supplier.name })
        : t("Reactivate \"{name}\"?", { name: supplier.name })
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
      setSuccess(action === "deactivate"
        ? t("{name} was deactivated.", { name: supplier.name })
        : t("{name} was reactivated.", { name: supplier.name }));
      await loadSuppliers();
    } catch (err) {
      setError(err.message || (action === "deactivate"
        ? t("Unable to deactivate supplier.")
        : t("Unable to reactivate supplier.")));
    }
  }

  return (
    <section className="suppliers-page">
      <div className="suppliers-heading">
        <p className="suppliers-subtitle">
          {t("The companies you buy from and how to reach them.")}
        </p>

        {canManageSuppliers && <button className="supplier-primary-button" onClick={openAddForm}>
          {t("+ Add supplier")}
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
        <div className="supplier-summary-card is-blue"><span>{t("Suppliers")}</span><strong>{activeCount}</strong><small>{t("Active suppliers you buy from")}</small></div>
        <div className="supplier-summary-card is-green"><span>{t("With GSTIN")}</span><strong>{gstCount}</strong><small>{t("Registered for GST")}</small></div>
        <div className="supplier-summary-card is-slate"><span>{t("Inactive")}</span><strong>{inactiveCount}</strong><small>{t("Kept for old records")}</small></div>
      </div>

      {showForm && (
        <div className="supplier-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setShowForm(false)}>
        <form className="supplier-form-card supplier-modal" onSubmit={handleSubmit}>
          <div className="supplier-form-heading">
            <h3>{editingId !== null ? t("Edit supplier") : t("Add supplier")}</h3>
            {canManageSuppliers && <button
              type="button"
              className="supplier-text-button"
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
            >
              {t("Cancel")}
            </button>}
          </div>

          <div className="supplier-form-grid">
            {fields.map((field) => (
              <label className={`supplier-field${field.half ? " field-half" : ""}`} key={field.name}>
                <span>
                  {t(field.label)}
                  {field.required && <b> *</b>}
                </span>

                <input
                  name={field.name}
                  type={field.type || "text"}
                  inputMode={field.inputMode}
                  value={form[field.name] ?? ""}
                  onChange={handleChange}
                  required={field.required || false}
                  maxLength={field.maxLength}
                />
              </label>
            ))}

            <label className="supplier-field supplier-field-wide">
              <span>{t("Address")}</span>
              <textarea
                name="addressLine"
                value={form.addressLine}
                onChange={handleChange}
                rows={2}
              />
            </label>

            <label className="supplier-field supplier-field-wide">
              <span>{t("Notes")}</span>
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
              {t("Cancel")}
            </button>

            <button
              type="submit"
              className="supplier-primary-button"
              disabled={saving}
            >
              {saving
                ? t("Saving...")
                : editingId !== null
                  ? t("Save Changes")
                  : t("Create Supplier")}
            </button>
          </div>
        </form>
        </div>
      )}

      <div className="supplier-table-card">
        <div className="supplier-table-toolbar">
          <div>
            <h3>{t("All suppliers")}</h3>
            <p>{t("Tap a supplier to see their full details.")}</p>
          </div>

          <input
            className="supplier-search"
            type="search"
            placeholder={t("Search name, code, phone...")}
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            aria-label={t("Search suppliers")}
          />
          <select value={status} aria-label={t("Supplier status")} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="ACTIVE">{t("Active suppliers")}</option>
            <option value="INACTIVE">{t("Inactive suppliers")}</option>
            <option value="ALL">{t("All suppliers")}</option>
          </select>
          <select value={sort} aria-label={t("Sort suppliers")} onChange={(event) => setSort(event.target.value)}>
            <option value="name">{t("Sort: Name")}</option>
            <option value="supplierCode">{t("Sort: Code")}</option>
            <option value="city">{t("Sort: City")}</option>
          </select>
          <button type="button" className="supplier-secondary-button" onClick={() => { setSearch(""); setStatus("ACTIVE"); setSort("name"); setPage(1); }}>{t("Clear")}</button>
        </div>

        {loading ? (
          <Skeleton label={t("Loading suppliers...")} />
        ) : filteredSuppliers.length === 0 ? (
          <div className="supplier-empty-state">
            <h3>{search ? t("No matching suppliers") : t("No suppliers found")}</h3>
            <p>
              {search
                ? t("Try a different search term.")
                : t("Add your first supplier to get started.")}
            </p>
          </div>
        ) : (
          <div className="supplier-table-scroll has-mobile-cards">
            <table className="supplier-table desktop-table">
              <thead>
                <tr>
                  <th>{t("Supplier")}</th>
                  <th>{t("Contact")}</th>
                  <th>{t("GSTIN")}</th>
                  <th>{t("Location")}</th>
                  <th><span className="visually-hidden">{t("Actions")}</span></th>
                </tr>
              </thead>

              <tbody>
                {visibleSuppliers.map((supplier) => (
                  <tr key={supplier.id} onClick={() => setDetailsSupplier(supplier)}>
                    <td>
                      <strong>{supplier.name}</strong>
                      <small>{supplier.supplierCode || t("No supplier code")}</small>
                    </td>
                    <td>
                      <span>{supplier.contactPerson || "—"}</span>
                      <small>{supplier.phone || t("No phone")}</small>
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
                          {t("View")}
                        </button>
                        {canManageSuppliers && <RowMenu label={t("More actions for {name}", { name: supplier.name })} items={[
                          { label: t("Edit details"), onClick: () => openEditForm(supplier) },
                          {
                            label: supplier.active ? t("Deactivate supplier") : t("Reactivate supplier"),
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
                    {!supplier.active && <span className="mobile-card__meta">{t("Inactive")}</span>}
                  </span>
                  <span className="mobile-card__meta">
                    {[supplier.phone, [supplier.city, supplier.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || t("No contact details")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="supplier-pagination"><span>{t("Showing {from}–{to} of {total}", { from: filteredSuppliers.length ? (page - 1) * PAGE_SIZE + 1 : 0, to: Math.min(page * PAGE_SIZE, filteredSuppliers.length), total: filteredSuppliers.length })}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{t("Previous")}</button><strong>{t("Page {page} of {count}", { page, count: pageCount })}</strong><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>{t("Next")}</button></div></div>
      </div>

      {detailsSupplier && (
        <div className="supplier-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetailsSupplier(null)}>
          <section className="supplier-details-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-details-title">
            <div className="supplier-form-heading"><div><h2 id="supplier-details-title">{detailsSupplier.name}</h2><p>{detailsSupplier.supplierCode || t("No supplier code")}</p></div><button type="button" className="supplier-secondary-button" onClick={() => setDetailsSupplier(null)}>{t("Close")}</button></div>
            <div className="supplier-detail-grid"><p><span>{t("Contact person")}</span><strong>{detailsSupplier.contactPerson || "—"}</strong></p><p><span>{t("Phone")}</span><strong>{detailsSupplier.phone || "—"}</strong></p><p><span>{t("Email")}</span><strong>{detailsSupplier.email || "—"}</strong></p><p><span>{t("GSTIN")}</span><strong>{detailsSupplier.gstin || t("Unregistered")}</strong></p><p><span>{t("Location")}</span><strong>{[detailsSupplier.city, detailsSupplier.state, detailsSupplier.postalCode].filter(Boolean).join(", ") || "—"}</strong></p><p><span>{t("Status")}</span><strong>{detailsSupplier.active ? t("Active") : t("Inactive")}</strong></p></div>
            <div className="supplier-detail-address"><span>{t("Address")}</span><p>{detailsSupplier.addressLine || t("Not provided")}</p></div>
            <div className="supplier-form-actions">{canManageSuppliers && <button type="button" className="supplier-secondary-button" onClick={() => { setDetailsSupplier(null); openEditForm(detailsSupplier); }}>{t("Edit supplier")}</button>}{canManageSuppliers && <button type="button" className={`supplier-primary-button ${detailsSupplier.active ? "supplier-danger-button" : ""}`} onClick={() => { setDetailsSupplier(null); handleStatusChange(detailsSupplier); }}>{detailsSupplier.active ? t("Deactivate") : t("Reactivate")}</button>}</div>
          </section>
        </div>
      )}
    </section>
  );
}

export default SuppliersPage;
