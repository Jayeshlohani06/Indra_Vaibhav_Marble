import { useEffect, useState } from "react";
import {
  createProduct,
  getCategories,
  getMeasurementUnits,
  saveInventorySettings,
} from "../../services/api/inventoryApi";
const initialForm = {
  productCode: "",
  name: "",
  description: "",
  categoryId: "",
  unitId: "",
  purchasePrice: "0",
  sellingPrice: "0",
  gstRate: "18",
  lowStockThreshold: "0",
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
          setError(err.message || "Unable to load categories and units.");
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
      purchasePrice: Number(form.purchasePrice),
      sellingPrice: Number(form.sellingPrice),
      gstRate: Number(form.gstRate),
      stockQuantity: 0,
      lowStockThreshold: Number(form.lowStockThreshold),
    };
    if (!product.name) {
      setError("Product name is required.");
      return;
    }
    if (!product.categoryId || !product.unitId) {
      setError("Select a category and measurement unit.");
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
      setError("Enter valid prices and thresholds. GST must be between 0 and 100.");
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
      setError("For tiles, enter positive dimensions and a positive whole number of pieces per box.");
      return;
    }
    setSaving(true);
    try {
      const createdProduct = await createProduct(product);
      if (!createdProduct?.id) {
        setError("The product response did not contain an ID. Check Inventory before retrying.");
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
          `Product "${createdProduct.name}" was created with zero stock, but inventory settings could not be saved: ${settingsError.message}. Do not create it again. Configure its tracking settings in Inventory.`
        );
        onCreated(createdProduct, false);
        return;
      }
      onCreated(createdProduct, true);
    } catch (err) {
      setError(err.message || "Unable to create product.");
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
            <h3 id="create-purchase-product-title">Create New Product</h3>
            <p>The product will be added to your catalogue with zero stock.</p>
          </div>
          <button
            type="button"
            className="purchase-secondary-button"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>
        </div>
        {error && <div className="purchase-alert purchase-error" role="alert">{error}</div>}
        {notice && <div className="purchase-alert purchase-error" role="alert">{notice}</div>}
        {loading ? (
          <p>Loading categories and measurement units...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="purchase-form-grid">
              <label>
                Product code
                <input
                  name="productCode"
                  value={form.productCode}
                  onChange={handleChange}
                  maxLength={50}
                  placeholder="Optional — generated from product name"
                />
                <small>Leave blank to generate a unique code automatically.</small>
              </label>
              <label>
                Product name *
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  maxLength={150}
                  required
                />
              </label>
              <label>
                Category *
                <select name="categoryId" value={form.categoryId} onChange={handleChange} required>
                  <option value="">Select category</option>
                  {categories.filter((item) => item.active !== false && item.isActive !== false).map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Measurement unit *
                <select name="unitId" value={form.unitId} onChange={handleChange} required>
                  <option value="">Select unit</option>
                  {units.filter((item) => item.active !== false && item.isActive !== false).map((item) => (
                    <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                  ))}
                </select>
              </label>
              <label>
                Purchase price (₹) *
                <input name="purchasePrice" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={handleChange} required />
              </label>
              <label>
                Selling price (₹) *
                <input name="sellingPrice" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={handleChange} required />
              </label>
              <label>
                GST (%) *
                <input name="gstRate" type="number" min="0" max="100" step="0.01" value={form.gstRate} onChange={handleChange} required />
              </label>
              <label>
                Low-stock threshold *
                <input name="lowStockThreshold" type="number" min="0" step="0.001" value={form.lowStockThreshold} onChange={handleChange} required />
              </label>
              <label>
                Inventory tracking type *
                <select value={trackingType} onChange={(event) => setTrackingType(event.target.value)} required>
                  <option value="STANDARD">Standard quantity</option>
                  <option value="TILE">Tiles — boxes and coverage</option>
                  <option value="SLAB">Individual slabs</option>
                  <option value="BAG">Bags</option>
                </select>
              </label>
              {trackingType === "TILE" && (
                <>
                  <label>
                    Tile length (feet) *
                    <input type="number" min="0.001" step="0.001" value={tileLengthFt} onChange={(event) => setTileLengthFt(event.target.value)} required />
                  </label>
                  <label>
                    Tile width (feet) *
                    <input type="number" min="0.001" step="0.001" value={tileWidthFt} onChange={(event) => setTileWidthFt(event.target.value)} required />
                  </label>
                  <label>
                    Pieces per box *
                    <input type="number" min="1" step="1" value={piecesPerBox} onChange={(event) => setPiecesPerBox(event.target.value)} required />
                  </label>
                </>
              )}
              <label className="purchase-wide-field">
                Description
                <textarea name="description" rows={2} value={form.description} onChange={handleChange} />
              </label>
            </div>
            <div className="purchase-note">
              <strong>Stock protection</strong>
              <p>This form does not add opening stock. Record and receive the purchase separately when the goods arrive.</p>
            </div>
            <div className="purchase-form-actions">
              <button type="button" className="purchase-secondary-button" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="purchase-primary-button" disabled={saving || loading}>
                {saving ? "Creating product..." : "Create and Select Product"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
export default CreateProductForm;
