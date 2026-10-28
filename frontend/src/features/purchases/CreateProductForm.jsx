import { useEffect, useState } from "react";
import {
  createProduct,
  createCategory,
  createMeasurementUnit,
  getCategories,
  getMeasurementUnits,
  saveInventorySettings,
} from "../../services/api/inventoryApi";
import { t } from "../../i18n";
import Skeleton from "../../components/Skeleton";
const initialForm = {
  productCode: "",
  name: "",
  description: "",
  categoryId: "",
  unitId: "",
  secondaryUnitId: "",
  secondaryPerPrimary: "",
  purchasePrice: "",
  sellingPrice: "",
  gstRate: "18",
  hsnCode: "",
  lowStockThreshold: "",
};

function buildProductCode(name) {
  return (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 35) || "PRODUCT"
  );
}

function CreateProductForm({ onClose, onCreated }) {
  const [form, setForm] = useState({ ...initialForm });
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [trackingType, setTrackingType] = useState("STANDARD");
  const [tileLengthFt, setTileLengthFt] = useState("");
  const [tileWidthFt, setTileWidthFt] = useState("");
  const [piecesPerBox, setPiecesPerBox] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitCode, setNewUnitCode] = useState("");
  const [addingReference, setAddingReference] = useState("");
  useEffect(() => {
    let cancelled = false;
    Promise.all([getCategories(), getMeasurementUnits()])
      .then(([categoryData, unitData]) => {
        if (cancelled) return;
        setCategories(Array.isArray(categoryData) ? categoryData : []);
        setUnits(Array.isArray(unitData) ? unitData : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || t("Unable to load categories and units."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }
  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setError(t("Enter a category name first."));
      return;
    }
    try {
      setAddingReference("category");
      const created = await createCategory({ name });
      setCategories((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((current) => ({ ...current, categoryId: String(created.id) }));
      setNewCategoryName("");
      setNotice(t("Category created and selected."));
    } catch (err) {
      setError(err.message || t("Unable to create category."));
    } finally {
      setAddingReference("");
    }
  }
  async function addUnit() {
    const name = newUnitName.trim();
    const code = newUnitCode.trim().toUpperCase();
    if (!name || !code) {
      setError(t("Enter both a unit name and code."));
      return;
    }
    try {
      setAddingReference("unit");
      const created = await createMeasurementUnit({ name, code });
      setUnits((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((current) => ({ ...current, unitId: String(created.id) }));
      setNewUnitName("");
      setNewUnitCode("");
      setNotice(t("Measurement unit created and selected."));
    } catch (err) {
      setError(err.message || t("Unable to create measurement unit."));
    } finally {
      setAddingReference("");
    }
  }
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const product = {
      productCode:
        form.productCode.trim() || buildProductCode(form.name.trim()),
      name: form.name.trim(),
      description: form.description.trim(),
      categoryId: Number(form.categoryId),
      unitId: Number(form.unitId),
      secondaryUnitId: form.secondaryUnitId ? Number(form.secondaryUnitId) : null,
      secondaryPerPrimary: form.secondaryPerPrimary ? Number(form.secondaryPerPrimary) : null,
      purchasePrice: Number(form.purchasePrice),
      sellingPrice: Number(form.sellingPrice),
      gstRate: Number(form.gstRate),
      hsnCode: form.hsnCode.replace(/\s+/g, "") || null,
      stockQuantity: 0,
      lowStockThreshold: Number(form.lowStockThreshold),
    };
    if (!product.name) {
      setError(t("Product name is required."));
      return;
    }
    if (product.hsnCode && !/^\d{4}(\d{2}){0,2}$/.test(product.hsnCode)) {
      setError(t("HSN code must be 4, 6 or 8 digits, or left empty."));
      return;
    }
    // Number("") is 0, so a cleared field would otherwise save as ₹0.
    if (
      [form.purchasePrice, form.sellingPrice, form.gstRate]
        .some((value) => String(value ?? "").trim() === "")
    ) {
      setError(t("Enter the purchase price, selling price, and GST rate."));
      return;
    }
    if (!product.categoryId || !product.unitId) {
      setError(t("Select a category and measurement unit."));
      return;
    }
    if (product.secondaryUnitId && product.secondaryUnitId === product.unitId) {
      setError(t("Primary and secondary units must be different."));
      return;
    }
    if (product.secondaryUnitId && product.secondaryPerPrimary !== null
      && (!Number.isFinite(product.secondaryPerPrimary) || product.secondaryPerPrimary <= 0)) {
      setError(t("Enter a positive secondary-units-per-primary conversion."));
      return;
    }
    if (
      [
        product.purchasePrice,
        product.sellingPrice,
        product.gstRate,
        product.lowStockThreshold,
      ].some((value) => !Number.isFinite(value) || value < 0) ||
      product.gstRate > 100
    ) {
      setError(t("Enter valid prices and thresholds. GST must be between 0 and 100."));
      return;
    }
    if (
      trackingType === "TILE" &&
      (
        !tileLengthFt ||
        !tileWidthFt ||
        !piecesPerBox ||
        !Number.isFinite(Number(tileLengthFt)) ||
        !Number.isFinite(Number(tileWidthFt)) ||
        !Number.isInteger(Number(piecesPerBox)) ||
        Number(tileLengthFt) <= 0 ||
        Number(tileWidthFt) <= 0 ||
        Number(piecesPerBox) <= 0
      )
    ) {
      setError(t("For tiles, enter positive dimensions and a positive whole number of pieces per box."));
      return;
    }
    setSaving(true);
    try {
      const createdProduct = await createProduct(product);
      if (!createdProduct?.id) {
        setError(t("The product response did not contain an ID. Check Inventory before retrying."));
        return;
      }
      try {
        await saveInventorySettings(createdProduct.id, {
          trackingType,
          tileLengthFt: trackingType === "TILE" ? Number(tileLengthFt) : null,
          tileWidthFt: trackingType === "TILE" ? Number(tileWidthFt) : null,
          piecesPerBox: trackingType === "TILE" ? Number(piecesPerBox) : null,
        });
      } catch (settingsError) {
        setNotice(
          t("Product \"{name}\" was created with zero stock, but inventory settings could not be saved: {error}. Do not create it again. Configure its tracking settings in Inventory.", { name: createdProduct.name, error: settingsError.message })
        );
        onCreated(createdProduct, false);
        return;
      }
      onCreated(createdProduct, true);
    } catch (err) {
      setError(err.message || t("Unable to create product."));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="purchase-modal-backdrop">
      <section
        className="purchase-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-purchase-product-title"
      >
        <div className="purchase-section-heading">
          <div>
            <h3 id="create-purchase-product-title">{t("Create New Product")}</h3>
            <p>{t("The product will be added to your catalogue with zero stock.")}</p>
          </div>
          <button
            type="button"
            className="purchase-secondary-button"
            onClick={onClose}
            disabled={saving}
          >
            {t("Close")}
          </button>
        </div>
        {error && <div className="purchase-alert purchase-error" role="alert">{error}</div>}
        {notice && <div className="purchase-alert purchase-error" role="alert">{notice}</div>}
        {loading ? (
          <Skeleton label={t("Loading categories and measurement units...")} rows={3} columns={2} />
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="purchase-form-grid">
              <label>
                {t("Product code")}
                <input
                  name="productCode"
                  value={form.productCode}
                  onChange={handleChange}
                  maxLength={50}
                  placeholder={t("Optional — generated from product name")}
                />
                <small>{t("Leave blank to generate a unique code automatically.")}</small>
              </label>
              <label>
                {t("Product name")} *
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  maxLength={150}
                  required
                />
              </label>
              <label>
                {t("Category")} *
                <div className="purchase-reference-row">
                  <select name="categoryId" value={form.categoryId} onChange={handleChange} required>
                    <option value="">{t("Select category")}</option>
                    {categories.filter((item) => item.active !== false && item.isActive !== false).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <button type="button" className="purchase-secondary-button" onClick={() => setAddingReference(addingReference === "category-form" ? "" : "category-form")}>{t("+ Add")}</button>
                </div>
                {addingReference === "category-form" && <div className="purchase-reference-creator"><input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder={t("New category name")} maxLength={100} /><button type="button" className="purchase-secondary-button" onClick={addCategory} disabled={addingReference === "category"}>{t("Add category")}</button></div>}
              </label>
              <label>
                {t("Measurement unit")} *
                <div className="purchase-reference-row">
                  <select name="unitId" value={form.unitId} onChange={handleChange} required>
                    <option value="">{t("Select unit")}</option>
                    {units.filter((item) => item.active !== false && item.isActive !== false).map((item) => (
                      <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                    ))}
                  </select>
                  <button type="button" className="purchase-secondary-button" onClick={() => setAddingReference(addingReference === "unit-form" ? "" : "unit-form")}>{t("+ Add")}</button>
                </div>
                {addingReference === "unit-form" && <div className="purchase-reference-creator"><input value={newUnitName} onChange={(event) => setNewUnitName(event.target.value)} placeholder={t("Unit name")} maxLength={50} /><input value={newUnitCode} onChange={(event) => setNewUnitCode(event.target.value)} placeholder={t("Code")} maxLength={20} /><button type="button" className="purchase-secondary-button" onClick={addUnit} disabled={addingReference === "unit"}>{t("Add unit")}</button></div>}
              </label>
              <label>
                {t("Second unit (optional)")}
                <select name="secondaryUnitId" value={form.secondaryUnitId} onChange={handleChange}>
                  <option value="">{t("No second unit")}</option>
                  {units.filter((item) => String(item.id) !== String(form.unitId) && item.active !== false && item.isActive !== false).map((item) => (
                    <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                  ))}
                </select>
              </label>
              {form.secondaryUnitId && <label>
                {t("Second units in one main unit (optional)")}
                <input name="secondaryPerPrimary" type="number" min="0.000001" step="0.000001" value={form.secondaryPerPrimary} onChange={handleChange} placeholder={t("Example: 4")} />
                <small>{t("Used to calculate a missing quantity when possible.")}</small>
              </label>}
              <label>
                {t("Purchase price (₹)")} *
                <input name="purchasePrice" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={handleChange} placeholder={t("What you pay, e.g. 450")} required />
              </label>
              <label>
                {t("Selling price (₹)")} *
                <input name="sellingPrice" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={handleChange} placeholder={t("What you charge, e.g. 600")} required />
              </label>
              <label>
                {t("GST rate (%)")} *
                <input name="gstRate" type="number" min="0" max="100" step="0.01" value={form.gstRate} onChange={handleChange} required />
              </label>
              <label>
                {t("HSN code")}
                <input name="hsnCode" value={form.hsnCode} onChange={handleChange} inputMode="numeric" maxLength={10} placeholder={t("e.g. 6802 (optional)")} />
              </label>
              <label>
                {t("Warn me when stock falls below")}
                <input name="lowStockThreshold" type="number" min="0" step="0.001" value={form.lowStockThreshold} onChange={handleChange} placeholder={t("e.g. 20 (optional)")} />
              </label>
              <label>
                {t("Inventory tracking type")} *
                <select value={trackingType} onChange={(event) => setTrackingType(event.target.value)} required>
                  <option value="STANDARD">{t("Standard quantity")}</option>
                  <option value="TILE">{t("Tiles — boxes and coverage")}</option>
                  <option value="SLAB">{t("Individual slabs")}</option>
                  <option value="BAG">{t("Bags")}</option>
                </select>
              </label>
              {trackingType === "TILE" && (
                <>
                  <label>
                    {t("Tile length (feet)")} *
                    <input type="number" min="0.001" step="0.001" value={tileLengthFt} onChange={(event) => setTileLengthFt(event.target.value)} required />
                  </label>
                  <label>
                    {t("Tile width (feet)")} *
                    <input type="number" min="0.001" step="0.001" value={tileWidthFt} onChange={(event) => setTileWidthFt(event.target.value)} required />
                  </label>
                  <label>
                    {t("Pieces per box")} *
                    <input type="number" min="1" step="1" value={piecesPerBox} onChange={(event) => setPiecesPerBox(event.target.value)} required />
                  </label>
                </>
              )}
              <label className="purchase-wide-field">
                {t("Description")}
                <textarea name="description" rows={2} value={form.description} onChange={handleChange} />
              </label>
            </div>
            <div className="purchase-note">
              <strong>{t("Stock protection")}</strong>
              <p>{t("This form does not add opening stock. Record and receive the purchase separately when the goods arrive.")}</p>
            </div>
            <div className="purchase-form-actions">
              <button type="button" className="purchase-secondary-button" onClick={onClose} disabled={saving}>
                {t("Cancel")}
              </button>
              <button type="submit" className="purchase-primary-button" disabled={saving || loading}>
                {saving ? t("Creating product...") : t("Create and Select Product")}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
export default CreateProductForm;
