
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
      setError(err.message || t("Unable to load inventory data."));
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
      setError(t("Enter a category name first."));
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
      setSuccess(t("Category added and selected."));
    } catch (err) {
      setError(err.message || t("Unable to add category."));
    } finally {
      setAddingReference("");
    }
  }

  async function handleAddUnit() {
    const name = newUnitName.trim();
    const code = newUnitCode.trim().toUpperCase();
    if (!name || !code) {
      setError(t("Enter both a unit name and unit code first."));
      return;
    }

    try {
      setAddingReference("unit");
      setError("");
      const unit = await createMeasurementUnit({ name, code });
      if (!unit?.id) {
        throw new Error(t("The unit was created but the server returned no unit ID."));
      }
      setUnits((current) =>
        [...current.filter((entry) => entry.id !== unit.id), unit].sort((a, b) =>
          String(a.name).localeCompare(String(b.name))
        )
      );
      setForm((current) => ({ ...current, unitId: String(unit.id) }));
      setNewUnitName("");
      setNewUnitCode("");
      setSuccess(t("Measurement unit added and selected."));
    } catch (err) {
      setError(
        err.message ||
          t("Unable to add measurement unit. Check that the unit code is unique.")
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
        setError(t("Inactive products cannot be edited."));
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
      setError(err.message || t("Unable to load product for editing."));
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
      setError(err.message || t("Unable to load product details."));
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
      setError(t("Product name is required."));
      return;
    }
    if (product.hsnCode && !/^\d{4}(\d{2}){0,2}$/.test(product.hsnCode)) {
      setError(t("HSN code must be 4, 6 or 8 digits, or left empty."));
      return;
    }

    // Number("") is 0, so a blank price would otherwise save as ₹0.
    if (
      [form.purchasePrice, form.sellingPrice, form.gstRate]
        .some((value) => String(value ?? "").trim() === "")
    ) {
      setError(t("Enter the purchase price, selling price, and GST rate."));
      return;
    }

    if (
      !product.categoryId ||
      !product.unitId ||
      !Number.isFinite(product.categoryId) ||
      !Number.isFinite(product.unitId)
    ) {
      setError(t("Please select a category and measurement unit."));
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
        t("Enter valid non-negative numbers. GST must be between 0 and 100.")
      );
      return;
    }

    try {
      setSaving(true);

      if (isEditing) {
        // Stock is intentionally excluded from product updates.
        await updateProduct(editingProductId, product);
        setSuccess(t("Product updated successfully."));
      } else {
        await createProduct(product);
        setSuccess(t("Product created successfully."));
      }

      setShowForm(false);
      setEditingProductId(null);
      setForm({ ...initialForm });

      await loadInventory();
    } catch (err) {
      setError(
        err.message ||
          (isEditing
            ? t("Unable to update product.")
            : t("Unable to create product."))
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(product) {
    const confirmed = window.confirm(
      t('Deactivate "{name}" ({code})?', { name: product.name, code: product.productCode })
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

      setSuccess(t('Product "{name}" deactivated successfully.', { name: product.name }));
      await loadInventory();
    } catch (err) {
      setError(err.message || t("Unable to deactivate product."));
    } finally {
      setDeactivatingProductId(null);
    }
  }

  function getCategoryName(categoryId) {
    const category = categories.find(
      (item) => String(item.id) === String(categoryId)
    );

    return category?.name || t("Unknown");
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
    if (!isActive(product)) return { label: t("Inactive"), alert: true };
    if (Number(product.stockQuantity ?? 0) <= 0) return { label: t("Out of stock"), alert: true };
    if (isLowStock(product)) return { label: t("Running low"), alert: true };
    return { label: t("In stock"), alert: false };
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
          {t("Your products, how much is in stock, and what needs reordering.")}
        </p>

        <div className="inventory-header-actions">
          {canManageInventory && <button
            className="inventory-secondary-button"
            type="button"
            onClick={() => setShowStockOperations(true)}
          >
            {t("Adjust stock")}
          </button>}
          {canManageInventory && <button
            className="inventory-secondary-button"
            type="button"
            onClick={() => setShowInventorySettings(true)}
          >
            {t("Stock settings")}
          </button>}
          {canManageProducts && <button
            className="inventory-primary-button"
            type="button"
            onClick={openCreateForm}
            disabled={loading}
          >
            {t("+ Add product")}
          </button>}
        </div>
      </header>

      <section
        className="inventory-stats"
        aria-label={t("Inventory summaries")}
      >
        <article className="inventory-stat-card">
          <span>{t("Products")}</span>
          <strong>{activeProductCount}</strong>
          <small>{t("Items you currently sell")}</small>
        </article>

        <article className="inventory-stat-card inventory-stat-warning">
          <span>{t("Running low or out")}</span>
          <strong>{lowStockProducts.length + outOfStockProducts.length}</strong>
          <small>{t("{out} out of stock · {low} running low", { out: outOfStockProducts.length, low: lowStockProducts.length })}</small>
        </article>

        <article className="inventory-stat-card">
          <span>{t("Value of stock")}</span>
          <strong>{formatCurrency(inventoryCostValue)}</strong>
          <small>{t("At the price you bought it")}</small>
        </article>
      </section>

      {success && (
        <div className="inventory-success" role="status">
          <p>{success}</p>
          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label={t("Dismiss success message")}
          >
            {t("Dismiss")}
          </button>
        </div>
      )}

      {error && (
        <div className="inventory-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label={t("Dismiss error")}
          >
            {t("Dismiss")}
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
                <h2 id="stock-operations-modal-heading">{t("Stock Operations")}</h2>
                <p>{t("Record purchases, sales and stock adjustments.")}</p>
              </div>
              <button className="inventory-modal-close" type="button" onClick={() => setShowStockOperations(false)} aria-label={t("Close stock operations")}>
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
                <h2 id="inventory-settings-modal-heading">{t("Inventory Settings")}</h2>
                <p>{t("Configure tracking and tile packaging for a product.")}</p>
              </div>
              <button className="inventory-modal-close" type="button" onClick={() => setShowInventorySettings(false)} aria-label={t("Close inventory settings")}>
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
                  ? t("Edit product")
                  : t("Add product")}
              </h2>
              <p>
                {editingProductId !== null
                  ? t("Update product details. Stock is managed separately.")
                  : t("Create the product master record. Stock is added through purchases.")}
              </p>
            </div>
            <button className="inventory-modal-close" type="button" onClick={cancelForm} aria-label={t("Close product form")}>
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="inventory-form">
            <div className="inventory-form-grid">
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
                {t("Product name *")}
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  maxLength={150}
                  placeholder={t("e.g. Italian White Marble")}
                  required
                />
              </label>

              <label>
                {t("Category *")}
                <div className="inventory-inline-field">
                  <select
                    name="categoryId"
                    value={form.categoryId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">{t("Select category")}</option>
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
                    {t("+ Add")}
                  </button>}
                </div>
                {addingReference === "category-form" && (
                  <div className="inventory-reference-creator">
                    <input
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder={t("New category name")}
                      maxLength={100}
                    />
                    <button
                      className="inventory-secondary-button"
                      type="button"
                      onClick={handleAddCategory}
                      disabled={addingReference === "category"}
                    >
                      {addingReference === "category" ? t("Adding...") : t("Add category")}
                    </button>
                  </div>
                )}
              </label>

              <label>
                {t("Unit you sell in *")}
                <div className="inventory-inline-field">
                  <select
                    name="unitId"
                    value={form.unitId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">{t("Select unit")}</option>
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
                    {t("+ Add")}
                  </button>}
                </div>
                {addingReference === "unit-form" && (
                  <div className="inventory-reference-creator">
                    <input
                      value={newUnitName}
                      onChange={(event) => setNewUnitName(event.target.value)}
                      placeholder={t("Unit name * (e.g. Box)")}
                      maxLength={50}
                      required
                      aria-label={t("New measurement unit name")}
                    />
                    <input
                      value={newUnitCode}
                      onChange={(event) => setNewUnitCode(event.target.value)}
                      placeholder={t("Code * (e.g. BDL)")}
                      maxLength={20}
                      required
                      aria-label={t("New measurement unit code")}
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
                      {addingReference === "unit" ? t("Adding...") : t("Add unit")}
                    </button>
                  </div>
                )}
              </label>

              <label>
                {t("Second unit (optional)")}
                <select
                  name="secondaryUnitId"
                  value={form.secondaryUnitId}
                  onChange={handleChange}
                >
                  <option value="">{t("No second unit")}</option>
                  {units.filter((unit) => String(unit.id) !== String(form.unitId)).map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>
                  ))}
                </select>
              </label>

              {form.secondaryUnitId && <label>
                {t("Second units in one main unit (optional)")}
                <input
                  name="secondaryPerPrimary"
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={form.secondaryPerPrimary}
                  onChange={handleChange}
                  placeholder={t("Example: 4")}
                />
              </label>}

              <label>
                {t("Purchase price (₹) *")}
                <input
                  name="purchasePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={handleChange}
                  placeholder={t("What you pay, e.g. 450")}
                  required
                />
              </label>

              <label>
                {t("Selling price (₹) *")}
                <input
                  name="sellingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={handleChange}
                  placeholder={t("What you charge, e.g. 600")}
                  required
                />
              </label>

              <label>
                {t("GST rate (%) *")}
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
                {t("HSN code")}
                <input name="hsnCode" value={form.hsnCode} onChange={handleChange} inputMode="numeric" maxLength={10} placeholder={t("e.g. 6802 (optional)")} />
              </label>

              <label>
                {t("Warn me when stock falls below")}
                <input
                  name="lowStockThreshold"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.lowStockThreshold}
                  onChange={handleChange}
                  placeholder={t("e.g. 20 (optional)")}
                />
              </label>

              <label className="inventory-description-field">
                {t("Description")}
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder={t("Optional product details")}
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
                {t("Cancel")}
              </button>

              <button
                className="inventory-primary-button"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? t("Saving...")
                  : editingProductId !== null
                    ? t("Update Product")
                    : t("Save product")}
              </button>
            </div>
          </form>
          </section>
        </div>
      )}

      {detailsLoading && <Skeleton label={t("Loading product details...")} rows={2} />}

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
                {t("Product Details")}
              </h2>
              <p>
                {selectedProduct.productCode} — {selectedProduct.name}
              </p>
            </div>

            <button
              className="inventory-modal-close"
              type="button"
              onClick={() => setSelectedProduct(null)}
              aria-label={t("Close product details")}
            >
              ×
            </button>
          </div>

          <div className="inventory-form-grid">
            <p><strong>{t("Product ID:")}</strong> {selectedProduct.id}</p>
            <p><strong>{t("Code:")}</strong> {selectedProduct.productCode}</p>
            <p><strong>{t("Name:")}</strong> {selectedProduct.name}</p>
            <p>
              <strong>{t("Category:")}</strong>{" "}
              {getCategoryName(selectedProduct.categoryId)}
            </p>
            <p>
              <strong>{t("Unit:")}</strong> {getUnitCode(selectedProduct.unitId)}
            </p>
            <p>
              <strong>{t("Purchase price:")}</strong>{" "}
              ₹{Number(selectedProduct.purchasePrice ?? 0).toFixed(2)}
            </p>
            <p>
              <strong>{t("Selling price:")}</strong>{" "}
              ₹{Number(selectedProduct.sellingPrice ?? 0).toFixed(2)}
            </p>
            <p><strong>{t("GST:")}</strong> {selectedProduct.gstRate}%</p>
            <p><strong>{t("HSN code:")}</strong> {selectedProduct.hsnCode || t("Not set")}</p>
            <p>
              <strong>{t("Available Stock:")}</strong>{" "}
              {selectedProduct.stockQuantity ?? 0}
            </p>
            <p>
              <strong>{t("Reorder when below:")}</strong>{" "}
              {selectedProduct.lowStockThreshold ?? 0}
            </p>
            <p>
              <strong>{t("Status:")}</strong>{" "}
              {isActive(selectedProduct) ? t("Active") : t("Inactive")}
            </p>
            <p>
              <strong>{t("Description:")}</strong>{" "}
              {selectedProduct.description || t("No description")}
            </p>
          </div>

          {canManageProducts && isActive(selectedProduct) && (
            <div className="inventory-form-actions">
              <button
                className="inventory-primary-button"
                type="button"
                onClick={() => openEditForm(selectedProduct.id)}
              >
                {t("Edit product")}
              </button>
            </div>
          )}
          </section>
        </div>
      )}

      {loading ? (
        <Skeleton label={t("Loading inventory data...")} rows={6} />
      ) : (
        <>
          <section className="inventory-panel">
            <div className="inventory-panel-heading">
              <div>
                <h2>{t("Products")}</h2>
                <p>{t("Tap a product to see its full details.")}</p>
              </div>
            </div>

            {unpricedProducts.length > 0 && (
              <section className="inventory-reorder-panel inventory-price-warning" aria-label={t("Products without a selling price")}>
                <div>
                  <h3>
                    {t(
                      unpricedProducts.length === 1
                        ? "{count} product has no selling price"
                        : "{count} products have no selling price",
                      { count: unpricedProducts.length }
                    )}
                  </h3>
                  <p>{t("Set a selling price so it fills in automatically when you make a bill.")}</p>
                </div>
                <button
                  className="inventory-secondary-button"
                  type="button"
                  onClick={() => setStockFilter("NO_PRICE")}
                >
                  {t("Show them")}
                </button>
              </section>
            )}

            {(outOfStockProducts.length > 0 || lowStockProducts.length > 0) && (
              <section className="inventory-reorder-panel" aria-labelledby="inventory-reorder-heading">
                <div>
                  <h3 id="inventory-reorder-heading">
                    {t(
                      outOfStockProducts.length + lowStockProducts.length === 1
                        ? "{count} product needs reordering"
                        : "{count} products need reordering",
                      { count: outOfStockProducts.length + lowStockProducts.length }
                    )}
                  </h3>
                  <p>{t("They are out of stock or below the level you set.")}</p>
                </div>
                <button
                  className="inventory-secondary-button"
                  type="button"
                  onClick={() => setStockFilter("LOW")}
                >
                  {t("Show them")}
                </button>
              </section>
            )}

            <div className="inventory-toolbar">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("Search product name")}
                aria-label={t("Search products")}
              />

              <select
                value={selectedCategory}
                onChange={(event) =>
                  setSelectedCategory(event.target.value)
                }
                aria-label={t("Filter by category")}
              >
                <option value="ALL">{t("All categories")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
                aria-label={t("Filter by stock status")}
              >
                <option value="ALL">{t("All stock levels")}</option>
                <option value="LOW">{t("Running low or out")}</option>
                <option value="IN_STOCK">{t("Enough stock")}</option>
                <option value="NO_PRICE">{t("No selling price")}</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label={t("Filter by product status")}
              >
                <option value="ACTIVE">{t("Active products")}</option>
                <option value="INACTIVE">{t("Inactive products")}</option>
                <option value="ALL">{t("Active and inactive")}</option>
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
                {t("Clear filters")}
              </button>
              <select
                value={`${sortBy}:${sortDirection}`}
                onChange={(event) => {
                  const [nextSort, nextDirection] = event.target.value.split(":");
                  setSortBy(nextSort);
                  setSortDirection(nextDirection);
                }}
                aria-label={t("Sort products")}
              >
                <option value="name:asc">{t("Sort: Name A–Z")}</option>
                <option value="name:desc">{t("Sort: Name Z–A")}</option>
                <option value="stock:asc">{t("Sort: Stock low to high")}</option>
                <option value="stock:desc">{t("Sort: Stock high to low")}</option>
                <option value="value:desc">{t("Sort: Value high to low")}</option>
              </select>
            </div>

            <p className="inventory-result-count">
              {t("Showing {shown} of {total} products", { shown: filteredProducts.length, total: products.length })}
            </p>

            {filteredProducts.length === 0 ? (
              <div className="inventory-empty">
                <h3>
                  {products.length === 0
                    ? t("No products yet")
                    : t("No matching products")}
                </h3>
                <p>
                  {products.length === 0
                    ? t("Create your first product to start tracking inventory.")
                    : t("Try another search term or change your filters.")}
                </p>
              </div>
            ) : (
              <div className="inventory-table-wrapper has-mobile-cards">
                <table className="inventory-table inventory-products-table desktop-table">
                  <thead>
                    <tr>
                      <th>
                        <button type="button" className="inventory-sort-button" onClick={() => changeSort("name")}>
                          {t("Product")} {sortBy === "name" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                        </button>
                      </th>
                      <th>{t("Category")}</th>
                      <th>
                        <button type="button" className="inventory-sort-button" onClick={() => changeSort("stock")}>
                          {t("In stock")} {sortBy === "stock" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                        </button>
                      </th>
                      <th className="num">{t("Selling price")}</th>
                      <th className="num">{t("Stock value")}</th>
                      <th>{t("Status")}</th>
                      <th><span className="visually-hidden">{t("Actions")}</span></th>
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
                          { label: t("Edit product"), onClick: () => openEditForm(product.id) },
                          {
                            label: deactivating ? t("Deactivating...") : t("Deactivate product"),
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
                          <td className="num">
                            {Number(product.sellingPrice ?? 0) > 0
                              ? formatCurrency(product.sellingPrice)
                              : <span className="inventory-missing-price">{t("Not set")}</span>}
                          </td>
                          <td className="num">
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
                                {t("View")}
                              </button>
                              <RowMenu label={t("More actions for {name}", { name: product.name })} items={menuItems} />
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
                          <span className="mobile-card__meta">{t("In stock:")} {formatStock(product)}</span>
                          <span className="mobile-card__meta">
                            {Number(product.sellingPrice ?? 0) > 0
                              ? formatCurrency(product.sellingPrice)
                              : <span className="inventory-missing-price">{t("No price")}</span>}
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
