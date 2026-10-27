
import { useEffect, useRef, useState } from "react";
import RowMenu from "../../components/RowMenu";
import InventorySettingsPanel from "./InventorySettingsPanel";
import StockOperationsPanel from "./StockOperationsPanel";

import {
  getProducts,
  getCategories,
  getMeasurementUnits,
  createCategory,
  createMeasurementUnit,
  createProduct,
  getProductById,
  updateProduct,
  deactivateProduct,
} from "../../services/api/inventoryApi";

import "./InventoryPage.css";
import { usePermission } from "../../auth/PermissionsContext";

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

function buildProductCode(name, products = []) {
  const prefix =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 35) || "PRODUCT";
  const existingCodes = new Set(
    products.map((item) => String(item.productCode || "").toUpperCase())
  );

  let code = prefix;
  let suffix = 1;
  while (existingCodes.has(code)) {
    code = `${prefix}-${suffix++}`;
  }
  return code;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function InventoryPage() {
  const canManageProducts = usePermission("PRODUCT_MANAGE");
  const canManageInventory = usePermission("INVENTORY_MANAGE");
  const canManageMasterData = usePermission("MASTER_DATA_MANAGE");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [showStockOperations, setShowStockOperations] = useState(false);
  const [showInventorySettings, setShowInventorySettings] = useState(false);
  const [form, setForm] = useState({ ...initialForm });
  const [saving, setSaving] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deactivatingProductId, setDeactivatingProductId] =
    useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitCode, setNewUnitCode] = useState("");
  const [addingReference, setAddingReference] = useState("");
  const formRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");

  async function loadInventory() {
    try {
      setLoading(true);
      setError("");

      const [productData, categoryData, unitData] = await Promise.all([
        getProducts(),
        getCategories(),
        getMeasurementUnits(),
      ]);

      setProducts(Array.isArray(productData) ? productData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setUnits(Array.isArray(unitData) ? unitData : []);
    } catch (err) {
      setError(err.message || "Unable to load inventory data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    if (!showForm && !selectedProduct && !showStockOperations && !showInventorySettings) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key !== "Escape") return;
      setShowForm(false);
      setSelectedProduct(null);
      setShowStockOperations(false);
      setShowInventorySettings(false);
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [
    selectedProduct,
    showForm,
    showInventorySettings,
    showStockOperations,
  ]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openCreateForm() {
    setEditingProductId(null);
    setForm({ ...initialForm });
    setSelectedProduct(null);
    setError("");
    setSuccess("");
    setShowForm(true);
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function cancelForm() {
    setShowForm(false);
    setEditingProductId(null);
    setForm({ ...initialForm });
    setError("");
    setNewCategoryName("");
    setNewUnitName("");
    setNewUnitCode("");
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setError("Enter a category name first.");
      return;
    }

    try {
      setAddingReference("category");
      setError("");
      const category = await createCategory({ name });
      setCategories((current) =>
        [...current, category].sort((a, b) =>
          String(a.name).localeCompare(String(b.name))
        )
      );
      setForm((current) => ({ ...current, categoryId: String(category.id) }));
      setNewCategoryName("");
      setSuccess("Category added and selected.");
    } catch (err) {
      setError(err.message || "Unable to add category.");
    } finally {
      setAddingReference("");
    }
  }

  async function handleAddUnit() {
    const name = newUnitName.trim();
    const code = newUnitCode.trim().toUpperCase();
    if (!name || !code) {
      setError("Enter both a unit name and unit code first.");
      return;
    }

    try {
      setAddingReference("unit");
      setError("");
      const unit = await createMeasurementUnit({ name, code });
      if (!unit?.id) {
        throw new Error("The unit was created but the server returned no unit ID.");
      }
      setUnits((current) =>
        [...current.filter((entry) => entry.id !== unit.id), unit].sort((a, b) =>
          String(a.name).localeCompare(String(b.name))
        )
      );
      setForm((current) => ({ ...current, unitId: String(unit.id) }));
      setNewUnitName("");
      setNewUnitCode("");
      setSuccess("Measurement unit added and selected.");
    } catch (err) {
      setError(
        err.message ||
          "Unable to add measurement unit. Check that the unit code is unique."
      );
    } finally {
      setAddingReference("");
    }
  }

  async function openEditForm(productId) {
    try {
      setError("");
      setSuccess("");
      setSelectedProduct(null);

      const product = await getProductById(productId);

      if (!(product.active ?? product.isActive ?? true)) {
        setError("Inactive products cannot be edited.");
        return;
      }

      setEditingProductId(productId);
      setForm({
        productCode: product.productCode ?? "",
        name: product.name ?? "",
        description: product.description ?? "",
        categoryId: String(product.categoryId ?? ""),
        unitId: String(product.unitId ?? ""),
        secondaryUnitId: String(product.secondaryUnitId ?? ""),
        secondaryPerPrimary: String(product.secondaryPerPrimary ?? ""),
        purchasePrice: String(product.purchasePrice ?? 0),
        sellingPrice: String(product.sellingPrice ?? 0),
        gstRate: String(product.gstRate ?? 0),
        hsnCode: product.hsnCode ?? "",
        lowStockThreshold: String(product.lowStockThreshold ?? 0),
      });

      setShowForm(true);
    } catch (err) {
      setError(err.message || "Unable to load product for editing.");
    }
  }

  async function openProductDetails(productId) {
    try {
      setError("");
      setSuccess("");
      setDetailsLoading(true);

      const product = await getProductById(productId);
      setSelectedProduct(product);
    } catch (err) {
      setError(err.message || "Unable to load product details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const isEditing = editingProductId !== null;
    const productName = form.name.trim();

    const product = {
      productCode:
        form.productCode.trim() ||
        (isEditing ? "" : buildProductCode(productName, products)),
      name: productName,
      description: form.description.trim(),
      categoryId: Number(form.categoryId),
      unitId: Number(form.unitId),
      secondaryUnitId: form.secondaryUnitId ? Number(form.secondaryUnitId) : null,
      secondaryPerPrimary: form.secondaryPerPrimary ? Number(form.secondaryPerPrimary) : null,
      purchasePrice: Number(form.purchasePrice),
      sellingPrice: Number(form.sellingPrice),
      gstRate: Number(form.gstRate),
      hsnCode: form.hsnCode.replace(/\s+/g, "") || null,
      lowStockThreshold: Number(form.lowStockThreshold),
    };

    if (!product.name) {
      setError("Product name is required.");
      return;
    }
    if (product.hsnCode && !/^\d{4}(\d{2}){0,2}$/.test(product.hsnCode)) {
      setError("HSN code must be 4, 6 or 8 digits, or left empty.");
      return;
    }

    // Number("") is 0, so a blank price would otherwise save as ₹0.
    if (
      [form.purchasePrice, form.sellingPrice, form.gstRate]
        .some((value) => String(value ?? "").trim() === "")
    ) {
      setError("Enter the purchase price, selling price, and GST rate.");
      return;
    }

    if (
      !product.categoryId ||
      !product.unitId ||
      !Number.isFinite(product.categoryId) ||
      !Number.isFinite(product.unitId)
    ) {
      setError("Please select a category and measurement unit.");
      return;
    }

    const numericValues = [
      product.purchasePrice,
      product.sellingPrice,
      product.gstRate,
      product.lowStockThreshold,
    ];

    if (
      numericValues.some(
        (value) => !Number.isFinite(value) || value < 0
      ) ||
      product.gstRate > 100
    ) {
      setError(
        "Enter valid non-negative numbers. GST must be between 0 and 100."
      );
      return;
    }

    try {
      setSaving(true);

      if (isEditing) {
        // Stock is intentionally excluded from product updates.
        await updateProduct(editingProductId, product);
        setSuccess("Product updated successfully.");
      } else {
        await createProduct(product);
        setSuccess("Product created successfully.");
      }

      setShowForm(false);
      setEditingProductId(null);
      setForm({ ...initialForm });

      await loadInventory();
    } catch (err) {
      setError(
        err.message ||
          (isEditing
            ? "Unable to update product."
            : "Unable to create product.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(product) {
    const confirmed = window.confirm(
      `Deactivate "${product.name}" (${product.productCode})?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");
      setDeactivatingProductId(product.id);

      await deactivateProduct(product.id);

      if (selectedProduct?.id === product.id) {
        setSelectedProduct(null);
      }

      setSuccess(`Product "${product.name}" deactivated successfully.`);
      await loadInventory();
    } catch (err) {
      setError(err.message || "Unable to deactivate product.");
    } finally {
      setDeactivatingProductId(null);
    }
  }

  function getCategoryName(categoryId) {
    const category = categories.find(
      (item) => String(item.id) === String(categoryId)
    );

    return category?.name || "Unknown";
  }

  function getUnitCode(unitId) {
    const unit = units.find(
      (item) => String(item.id) === String(unitId)
    );

    return unit?.code || "—";
  }

  function isActive(product) {
    return product.active ?? product.isActive ?? true;
  }

  // Stock shown with its units, e.g. "8,824 SQFT + 2,206 PCS".
  function formatStock(product) {
    const amount = (value) =>
      Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
    const primary = `${amount(product.stockQuantity)} ${getUnitCode(product.unitId)}`;
    return product.secondaryUnitId
      ? `${primary} + ${amount(product.secondaryStockQuantity)} ${getUnitCode(product.secondaryUnitId)}`
      : primary;
  }

  function stockStatus(product) {
    if (!isActive(product)) return { label: "Inactive", alert: true };
    if (Number(product.stockQuantity ?? 0) <= 0) return { label: "Out of stock", alert: true };
    if (isLowStock(product)) return { label: "Running low", alert: true };
    return { label: "In stock", alert: false };
  }

  function isLowStock(product) {
    return (
      Number(product.stockQuantity ?? 0) <=
      Number(product.lowStockThreshold ?? 0)
    );
  }

  const filteredProducts = products.filter((product) => {
    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      String(product.name || "").toLowerCase().includes(search) ||
      String(product.productCode || "").toLowerCase().includes(search);

    const matchesCategory =
      selectedCategory === "ALL" ||
      String(product.categoryId) === selectedCategory;

    const matchesStock =
      stockFilter === "ALL" ||
      (stockFilter === "LOW" && isLowStock(product)) ||
      (stockFilter === "IN_STOCK" && !isLowStock(product)) ||
      (stockFilter === "NO_PRICE" && Number(product.sellingPrice ?? 0) <= 0);

    const active = isActive(product);

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && active) ||
      (statusFilter === "INACTIVE" && !active);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesStock &&
      matchesStatus
    );
  });

  const activeProductCount = products.filter(isActive).length;
  const outOfStockProducts = products.filter(
    (product) => isActive(product) && Number(product.stockQuantity ?? 0) <= 0
  );
  const lowStockProducts = products.filter(
    (product) =>
      isActive(product) &&
      Number(product.stockQuantity ?? 0) > 0 &&
      isLowStock(product)
  );
  const inventoryCostValue = products
    .filter(isActive)
    .reduce(
      (total, product) =>
        total +
        Number(product.stockQuantity ?? 0) *
          Number(product.purchasePrice ?? 0),
      0
    );
  const unpricedProducts = products.filter(
    (product) => isActive(product) && Number(product.sellingPrice ?? 0) <= 0
  );

  const sortedProducts = [...filteredProducts].sort((first, second) => {
    const firstValue =
      sortBy === "stock"
        ? Number(first.stockQuantity ?? 0)
        : sortBy === "value"
          ? Number(first.stockQuantity ?? 0) *
            Number(first.purchasePrice ?? 0)
          : String(first[sortBy] ?? "").toLowerCase();
    const secondValue =
      sortBy === "stock"
        ? Number(second.stockQuantity ?? 0)
        : sortBy === "value"
          ? Number(second.stockQuantity ?? 0) *
            Number(second.purchasePrice ?? 0)
          : String(second[sortBy] ?? "").toLowerCase();

    if (firstValue === secondValue) return 0;
    const comparison = firstValue > secondValue ? 1 : -1;
    return sortDirection === "asc" ? comparison : -comparison;
  });

  function changeSort(nextSort) {
    if (sortBy === nextSort) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSort);
    setSortDirection("asc");
  }

  return (
    <main className="inventory-page">
      <header className="inventory-header">
        <p className="inventory-intro">
          Your products, how much is in stock, and what needs reordering.
        </p>

        <div className="inventory-header-actions">
          {canManageInventory && <button
            className="inventory-secondary-button"
            type="button"
            onClick={() => setShowStockOperations(true)}
          >
            Adjust stock
          </button>}
          {canManageInventory && <button
            className="inventory-secondary-button"
            type="button"
            onClick={() => setShowInventorySettings(true)}
          >
            Stock settings
          </button>}
          {canManageProducts && <button
            className="inventory-primary-button"
            type="button"
            onClick={openCreateForm}
            disabled={loading}
          >
            + Add product
          </button>}
        </div>
      </header>

      <section
        className="inventory-stats"
        aria-label="Inventory summaries"
      >
        <article className="inventory-stat-card">
          <span>Products</span>
          <strong>{activeProductCount}</strong>
          <small>Items you currently sell</small>
        </article>

        <article className="inventory-stat-card inventory-stat-warning">
          <span>Running low or out</span>
          <strong>{lowStockProducts.length + outOfStockProducts.length}</strong>
          <small>{outOfStockProducts.length} out of stock · {lowStockProducts.length} running low</small>
        </article>

        <article className="inventory-stat-card">
          <span>Value of stock</span>
          <strong>{formatCurrency(inventoryCostValue)}</strong>
          <small>At the price you bought it</small>
        </article>
      </section>

      {success && (
        <div className="inventory-success" role="status">
          <p>{success}</p>
          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss success message"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="inventory-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {showStockOperations && (
        <div
          className="inventory-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowStockOperations(false);
            }
          }}
        >
          <div className="inventory-modal inventory-wide-modal" role="dialog" aria-modal="true" aria-labelledby="stock-operations-modal-heading">
            <div className="inventory-modal-heading">
              <div>
                <h2 id="stock-operations-modal-heading">Stock Operations</h2>
                <p>Record purchases, sales and stock adjustments.</p>
              </div>
              <button className="inventory-modal-close" type="button" onClick={() => setShowStockOperations(false)} aria-label="Close stock operations">
                ×
              </button>
            </div>
            <StockOperationsPanel products={products} units={units} onStockUpdated={loadInventory} />
          </div>
        </div>
      )}

      {showInventorySettings && (
        <div
          className="inventory-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowInventorySettings(false);
            }
          }}
        >
          <div className="inventory-modal inventory-wide-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-settings-modal-heading">
            <div className="inventory-modal-heading">
              <div>
                <h2 id="inventory-settings-modal-heading">Inventory Settings</h2>
                <p>Configure tracking and tile packaging for a product.</p>
              </div>
              <button className="inventory-modal-close" type="button" onClick={() => setShowInventorySettings(false)} aria-label="Close inventory settings">
                ×
              </button>
            </div>
            <InventorySettingsPanel products={products} />
          </div>
        </div>
      )}

      {showForm && (
        <div className="inventory-modal-backdrop" role="presentation">
          <section
            ref={formRef}
            className="inventory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-product-form-heading"
          >
          <div className="inventory-panel-heading">
            <div>
              <h2 id="inventory-product-form-heading">
                {editingProductId !== null
                  ? "Edit product"
                  : "Add product"}
              </h2>
              <p>
                {editingProductId !== null
                  ? "Update product details. Stock is managed separately."
                  : "Create the product master record. Stock is added through purchases."}
              </p>
            </div>
            <button className="inventory-modal-close" type="button" onClick={cancelForm} aria-label="Close product form">
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="inventory-form">
            <div className="inventory-form-grid">
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
                  placeholder="e.g. Italian White Marble"
                  required
                />
              </label>

              <label>
                Category *
                <div className="inventory-inline-field">
                  <select
                    name="categoryId"
                    value={form.categoryId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {canManageProducts && <button
                    className="inventory-add-reference-button"
                    type="button"
                    onClick={() => setAddingReference(
                      addingReference === "category-form" ? "" : "category-form"
                    )}
                    disabled={saving}
                  >
                    + Add
                  </button>}
                </div>
                {addingReference === "category-form" && (
                  <div className="inventory-reference-creator">
                    <input
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder="New category name"
                      maxLength={100}
                    />
                    <button
                      className="inventory-secondary-button"
                      type="button"
                      onClick={handleAddCategory}
                      disabled={addingReference === "category"}
                    >
                      {addingReference === "category" ? "Adding..." : "Add category"}
                    </button>
                  </div>
                )}
              </label>

              <label>
                Unit you sell in *
                <div className="inventory-inline-field">
                  <select
                    name="unitId"
                    value={form.unitId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select unit</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} ({unit.code})
                      </option>
                    ))}
                  </select>
                  {canManageMasterData && <button
                    className="inventory-add-reference-button"
                    type="button"
                    onClick={() => setAddingReference(
                      addingReference === "unit-form" ? "" : "unit-form"
                    )}
                    disabled={saving}
                  >
                    + Add
                  </button>}
                </div>
                {addingReference === "unit-form" && (
                  <div className="inventory-reference-creator">
                    <input
                      value={newUnitName}
                      onChange={(event) => setNewUnitName(event.target.value)}
                      placeholder="Unit name * (e.g. Box)"
                      maxLength={50}
                      required
                      aria-label="New measurement unit name"
                    />
                    <input
                      value={newUnitCode}
                      onChange={(event) => setNewUnitCode(event.target.value)}
                      placeholder="Code * (e.g. BDL)"
                      maxLength={20}
                      required
                      aria-label="New measurement unit code"
                    />
                    <button
                      className="inventory-secondary-button"
                      type="button"
                      onClick={handleAddUnit}
                      disabled={
                        addingReference === "unit" ||
                        !newUnitName.trim() ||
                        !newUnitCode.trim()
                      }
                    >
                      {addingReference === "unit" ? "Adding..." : "Add unit"}
                    </button>
                  </div>
                )}
              </label>

              <label>
                Second unit (optional)
                <select
                  name="secondaryUnitId"
                  value={form.secondaryUnitId}
                  onChange={handleChange}
                >
                  <option value="">No second unit</option>
                  {units.filter((unit) => String(unit.id) !== String(form.unitId)).map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>
                  ))}
                </select>
              </label>

              {form.secondaryUnitId && <label>
                Second units in one main unit (optional)
                <input
                  name="secondaryPerPrimary"
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={form.secondaryPerPrimary}
                  onChange={handleChange}
                  placeholder="Example: 4"
                />
              </label>}

              <label>
                Purchase price (₹) *
                <input
                  name="purchasePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={handleChange}
                  placeholder="What you pay, e.g. 450"
                  required
                />
              </label>

              <label>
                Selling price (₹) *
                <input
                  name="sellingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={handleChange}
                  placeholder="What you charge, e.g. 600"
                  required
                />
              </label>

              <label>
                GST rate (%) *
                <input
                  name="gstRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.gstRate}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                HSN code
                <input name="hsnCode" value={form.hsnCode} onChange={handleChange} inputMode="numeric" maxLength={10} placeholder="e.g. 6802 (optional)" />
              </label>

              <label>
                Warn me when stock falls below
                <input
                  name="lowStockThreshold"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.lowStockThreshold}
                  onChange={handleChange}
                  placeholder="e.g. 20 (optional)"
                />
              </label>

              <label className="inventory-description-field">
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Optional product details"
                />
              </label>
            </div>

            <div className="inventory-form-actions">
              <button
                className="inventory-secondary-button"
                type="button"
                onClick={cancelForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="inventory-primary-button"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingProductId !== null
                    ? "Update Product"
                    : "Save product"}
              </button>
            </div>
          </form>
          </section>
        </div>
      )}

      {detailsLoading && (
        <p className="inventory-message" role="status">
          Loading product details...
        </p>
      )}

      {selectedProduct && (
        <div
          className="inventory-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedProduct(null);
            }
          }}
        >
          <section
            className="inventory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-product-details-heading"
          >
          <div className="inventory-panel-heading">
            <div>
              <h2 id="inventory-product-details-heading">
                Product Details
              </h2>
              <p>
                {selectedProduct.productCode} — {selectedProduct.name}
              </p>
            </div>

            <button
              className="inventory-modal-close"
              type="button"
              onClick={() => setSelectedProduct(null)}
              aria-label="Close product details"
            >
              ×
            </button>
          </div>

          <div className="inventory-form-grid">
            <p><strong>Product ID:</strong> {selectedProduct.id}</p>
            <p><strong>Code:</strong> {selectedProduct.productCode}</p>
            <p><strong>Name:</strong> {selectedProduct.name}</p>
            <p>
              <strong>Category:</strong>{" "}
              {getCategoryName(selectedProduct.categoryId)}
            </p>
            <p>
              <strong>Unit:</strong> {getUnitCode(selectedProduct.unitId)}
            </p>
            <p>
              <strong>Purchase price:</strong>{" "}
              ₹{Number(selectedProduct.purchasePrice ?? 0).toFixed(2)}
            </p>
            <p>
              <strong>Selling price:</strong>{" "}
              ₹{Number(selectedProduct.sellingPrice ?? 0).toFixed(2)}
            </p>
            <p><strong>GST:</strong> {selectedProduct.gstRate}%</p>
            <p><strong>HSN code:</strong> {selectedProduct.hsnCode || "Not set"}</p>
            <p>
              <strong>Available Stock:</strong>{" "}
              {selectedProduct.stockQuantity ?? 0}
            </p>
            <p>
              <strong>Reorder when below:</strong>{" "}
              {selectedProduct.lowStockThreshold ?? 0}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              {isActive(selectedProduct) ? "Active" : "Inactive"}
            </p>
            <p>
              <strong>Description:</strong>{" "}
              {selectedProduct.description || "No description"}
            </p>
          </div>

          {canManageProducts && isActive(selectedProduct) && (
            <div className="inventory-form-actions">
              <button
                className="inventory-primary-button"
                type="button"
                onClick={() => openEditForm(selectedProduct.id)}
              >
                Edit product
              </button>
            </div>
          )}
          </section>
        </div>
      )}

      {loading ? (
        <p className="inventory-message" role="status">
          Loading inventory data...
        </p>
      ) : (
        <>
          <section className="inventory-panel">
            <div className="inventory-panel-heading">
              <div>
                <h2>Products</h2>
                <p>Tap a product to see its full details.</p>
              </div>
            </div>

            {unpricedProducts.length > 0 && (
              <section className="inventory-reorder-panel inventory-price-warning" aria-label="Products without a selling price">
                <div>
                  <h3>
                    {unpricedProducts.length}{" "}
                    {unpricedProducts.length === 1 ? "product has" : "products have"} no selling price
                  </h3>
                  <p>Set a selling price so it fills in automatically when you make a bill.</p>
                </div>
                <button
                  className="inventory-secondary-button"
                  type="button"
                  onClick={() => setStockFilter("NO_PRICE")}
                >
                  Show them
                </button>
              </section>
            )}

            {(outOfStockProducts.length > 0 || lowStockProducts.length > 0) && (
              <section className="inventory-reorder-panel" aria-labelledby="inventory-reorder-heading">
                <div>
                  <h3 id="inventory-reorder-heading">
                    {outOfStockProducts.length + lowStockProducts.length}{" "}
                    {outOfStockProducts.length + lowStockProducts.length === 1
                      ? "product needs"
                      : "products need"}{" "}
                    reordering
                  </h3>
                  <p>They are out of stock or below the level you set.</p>
                </div>
                <button
                  className="inventory-secondary-button"
                  type="button"
                  onClick={() => setStockFilter("LOW")}
                >
                  Show them
                </button>
              </section>
            )}

            <div className="inventory-toolbar">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search product name"
                aria-label="Search products"
              />

              <select
                value={selectedCategory}
                onChange={(event) =>
                  setSelectedCategory(event.target.value)
                }
                aria-label="Filter by category"
              >
                <option value="ALL">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
                aria-label="Filter by stock status"
              >
                <option value="ALL">All stock levels</option>
                <option value="LOW">Running low or out</option>
                <option value="IN_STOCK">Enough stock</option>
                <option value="NO_PRICE">No selling price</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by product status"
              >
                <option value="ACTIVE">Active products</option>
                <option value="INACTIVE">Inactive products</option>
                <option value="ALL">Active and inactive</option>
              </select>

              <button
                className="inventory-secondary-button"
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("ALL");
                  setStockFilter("ALL");
                  setStatusFilter("ACTIVE");
                }}
              >
                Clear filters
              </button>
              <select
                value={`${sortBy}:${sortDirection}`}
                onChange={(event) => {
                  const [nextSort, nextDirection] = event.target.value.split(":");
                  setSortBy(nextSort);
                  setSortDirection(nextDirection);
                }}
                aria-label="Sort products"
              >
                <option value="name:asc">Sort: Name A–Z</option>
                <option value="name:desc">Sort: Name Z–A</option>
                <option value="stock:asc">Sort: Stock low to high</option>
                <option value="stock:desc">Sort: Stock high to low</option>
                <option value="value:desc">Sort: Value high to low</option>
              </select>
            </div>

            <p className="inventory-result-count">
              Showing {filteredProducts.length} of {products.length} products
            </p>

            {filteredProducts.length === 0 ? (
              <div className="inventory-empty">
                <h3>
                  {products.length === 0
                    ? "No products yet"
                    : "No matching products"}
                </h3>
                <p>
                  {products.length === 0
                    ? "Create your first product to start tracking inventory."
                    : "Try another search term or change your filters."}
                </p>
              </div>
            ) : (
              <div className="inventory-table-wrapper has-mobile-cards">
                <table className="inventory-table inventory-products-table desktop-table">
                  <thead>
                    <tr>
                      <th>
                        <button type="button" className="inventory-sort-button" onClick={() => changeSort("name")}>
                          Product {sortBy === "name" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                        </button>
                      </th>
                      <th>Category</th>
                      <th>
                        <button type="button" className="inventory-sort-button" onClick={() => changeSort("stock")}>
                          In stock {sortBy === "stock" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                        </button>
                      </th>
                      <th>Selling price</th>
                      <th>Stock value</th>
                      <th>Status</th>
                      <th><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedProducts.map((product) => {
                      const active = isActive(product);
                      const status = stockStatus(product);
                      const deactivating =
                        deactivatingProductId === product.id;
                      const menuItems = active && canManageProducts
                        ? [
                          { label: "Edit product", onClick: () => openEditForm(product.id) },
                          {
                            label: deactivating ? "Deactivating..." : "Deactivate product",
                            onClick: () => handleDeactivate(product),
                            danger: true,
                          },
                        ]
                        : [];

                      return (
                        <tr
                          key={product.id}
                          className={status.alert ? "inventory-low-stock-row" : ""}
                        >
                          <td>
                            <div className="inventory-stock-product">
                              <strong>{product.name}</strong>
                              <span>{product.productCode}</span>
                            </div>
                          </td>
                          <td>{getCategoryName(product.categoryId)}</td>
                          <td>
                            <strong>{formatStock(product)}</strong>
                          </td>
                          <td>
                            {Number(product.sellingPrice ?? 0) > 0
                              ? formatCurrency(product.sellingPrice)
                              : <span className="inventory-missing-price">Not set</span>}
                          </td>
                          <td>
                            {formatCurrency(
                              Number(product.stockQuantity ?? 0) *
                                Number(product.purchasePrice ?? 0)
                            )}
                          </td>
                          <td>
                            <span className={`inventory-stock-badge ${status.alert ? "inventory-stock-badge-low" : "inventory-stock-badge-ok"}`}>
                              {status.label}
                            </span>
                          </td>
                          <td>
                            <div className="inventory-row-actions">
                              <button
                                className="inventory-secondary-button"
                                type="button"
                                onClick={() => openProductDetails(product.id)}
                              >
                                View
                              </button>
                              <RowMenu label={`More actions for ${product.name}`} items={menuItems} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="mobile-cards">
                  {sortedProducts.map((product) => {
                    const status = stockStatus(product);
                    return (
                      <button
                        type="button"
                        key={product.id}
                        className="mobile-card"
                        onClick={() => openProductDetails(product.id)}
                      >
                        <span className="mobile-card__row">
                          <span className="mobile-card__title">{product.name}</span>
                          <span className={`inventory-stock-badge ${status.alert ? "inventory-stock-badge-low" : "inventory-stock-badge-ok"}`}>
                            {status.label}
                          </span>
                        </span>
                        <span className="mobile-card__row">
                          <span className="mobile-card__meta">In stock: {formatStock(product)}</span>
                          <span className="mobile-card__meta">
                            {Number(product.sellingPrice ?? 0) > 0
                              ? formatCurrency(product.sellingPrice)
                              : <span className="inventory-missing-price">No price</span>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

        </>
      )}
    </main>
  );
}

export default InventoryPage;
