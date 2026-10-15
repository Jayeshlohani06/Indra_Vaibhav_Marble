
import { useEffect, useState } from "react";
import InventorySettingsPanel from "./InventorySettingsPanel";
import StockOperationsPanel from "./StockOperationsPanel";

import {
  getProducts,
  getCategories,
  getMeasurementUnits,
  createProduct,
  getProductById,
  updateProduct,
  deactivateProduct,
} from "../../services/api/inventoryApi";

import "./InventoryPage.css";

const initialForm = {
  productCode: "",
  name: "",
  description: "",
  categoryId: "",
  unitId: "",
  purchasePrice: "0",
  sellingPrice: "0",
  gstRate: "18",
  stockQuantity: "0",
  lowStockThreshold: "0",
};

function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...initialForm });
  const [saving, setSaving] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deactivatingProductId, setDeactivatingProductId] =
    useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");

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
  }

  function cancelForm() {
    setShowForm(false);
    setEditingProductId(null);
    setForm({ ...initialForm });
    setError("");
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
        purchasePrice: String(product.purchasePrice ?? 0),
        sellingPrice: String(product.sellingPrice ?? 0),
        gstRate: String(product.gstRate ?? 0),
        stockQuantity: String(product.stockQuantity ?? 0),
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

    const product = {
      productCode: form.productCode.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      categoryId: Number(form.categoryId),
      unitId: Number(form.unitId),
      purchasePrice: Number(form.purchasePrice),
      sellingPrice: Number(form.sellingPrice),
      gstRate: Number(form.gstRate),
      lowStockThreshold: Number(form.lowStockThreshold),
    };

    if (!product.productCode || !product.name) {
      setError("Product code and product name are required.");
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

    if (!isEditing) {
      product.stockQuantity = Number(form.stockQuantity);

      if (
        !Number.isFinite(product.stockQuantity) ||
        product.stockQuantity < 0
      ) {
        setError("Opening stock must be a valid non-negative number.");
        return;
      }
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
      (stockFilter === "IN_STOCK" && !isLowStock(product));

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

  const lowStockCount = products.filter(
    (product) => isActive(product) && isLowStock(product)
  ).length;

  const activeProductCount = products.filter(isActive).length;

  return (
    <main className="inventory-page">
      <header className="inventory-header">
        <div>
          <p className="inventory-eyebrow">WORKSPACE / INVENTORY</p>
          <h1>Inventory Management</h1>
          <p>Manage your marble, granite, tiles and sanitaryware.</p>
        </div>

        <button
          className="inventory-primary-button"
          type="button"
          onClick={openCreateForm}
          disabled={loading}
        >
          + Create Product
        </button>
      </header>

      <section
        className="inventory-stats"
        aria-label="Inventory summaries"
      >
        <article className="inventory-stat-card">
          <span>Total Products</span>
          <strong>{products.length}</strong>
        </article>

        <article className="inventory-stat-card">
          <span>Active Products</span>
          <strong>{activeProductCount}</strong>
        </article>

        <article className="inventory-stat-card">
          <span>Categories</span>
          <strong>{categories.length}</strong>
        </article>

        <article className="inventory-stat-card">
          <span>Measurement Units</span>
          <strong>{units.length}</strong>
        </article>

        <article className="inventory-stat-card inventory-low-stock-stat">
          <span>Low-Stock Products</span>
          <strong>{lowStockCount}</strong>
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

      <StockOperationsPanel
        products={products}
        onStockUpdated={loadInventory}
      />

      <InventorySettingsPanel products={products} />

      {showForm && (
        <section className="inventory-panel inventory-form-panel">
          <div className="inventory-panel-heading">
            <div>
              <h2>
                {editingProductId !== null
                  ? "Edit Product"
                  : "Create Product"}
              </h2>
              <p>
                {editingProductId !== null
                  ? "Update product details. Stock is managed separately."
                  : "Enter product details and the verified opening stock."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="inventory-form">
            <div className="inventory-form-grid">
              <label>
                Product Code *
                <input
                  name="productCode"
                  value={form.productCode}
                  onChange={handleChange}
                  maxLength={50}
                  placeholder="e.g. MAR-001"
                  required
                />
              </label>

              <label>
                Product Name *
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
              </label>

              <label>
                Measurement Unit *
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
              </label>

              <label>
                Purchase Price (₹) *
                <input
                  name="purchasePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Selling Price (₹) *
                <input
                  name="sellingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                GST Rate (%) *
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
                Opening Stock {editingProductId === null ? "*" : ""}
                <input
                  name="stockQuantity"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.stockQuantity}
                  onChange={handleChange}
                  disabled={editingProductId !== null || saving}
                  required={editingProductId === null}
                />
                {editingProductId !== null && (
                  <small>Stock cannot be changed through product editing.</small>
                )}
              </label>

              <label>
                Low-Stock Threshold *
                <input
                  name="lowStockThreshold"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.lowStockThreshold}
                  onChange={handleChange}
                  required
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
                    : "Save Product"}
              </button>
            </div>
          </form>
        </section>
      )}

      {detailsLoading && (
        <p className="inventory-message" role="status">
          Loading product details...
        </p>
      )}

      {selectedProduct && (
        <section
          className="inventory-panel"
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
              className="inventory-secondary-button"
              type="button"
              onClick={() => setSelectedProduct(null)}
            >
              Close Details
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
              <strong>Purchase Price:</strong>{" "}
              ₹{Number(selectedProduct.purchasePrice ?? 0).toFixed(2)}
            </p>
            <p>
              <strong>Selling Price:</strong>{" "}
              ₹{Number(selectedProduct.sellingPrice ?? 0).toFixed(2)}
            </p>
            <p><strong>GST:</strong> {selectedProduct.gstRate}%</p>
            <p>
              <strong>Available Stock:</strong>{" "}
              {selectedProduct.stockQuantity ?? 0}
            </p>
            <p>
              <strong>Low-Stock Threshold:</strong>{" "}
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

          {isActive(selectedProduct) && (
            <div className="inventory-form-actions">
              <button
                className="inventory-primary-button"
                type="button"
                onClick={() => openEditForm(selectedProduct.id)}
              >
                Edit Product
              </button>
            </div>
          )}
        </section>
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
                <p>Search, filter and manage your current inventory.</p>
              </div>
            </div>

            <div className="inventory-toolbar">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search product name or code..."
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
                <option value="LOW">Low stock</option>
                <option value="IN_STOCK">Above threshold</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by product status"
              >
                <option value="ACTIVE">Active products</option>
                <option value="INACTIVE">Inactive products</option>
                <option value="ALL">All product statuses</option>
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
                Clear Filters
              </button>
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
              <div className="inventory-table-wrapper">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Product Code</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Unit</th>
                      <th>Selling Price</th>
                      <th>Available Stock</th>
                      <th>GST</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map((product) => {
                      const lowStock = isLowStock(product);
                      const active = isActive(product);
                      const deactivating =
                        deactivatingProductId === product.id;

                      return (
                        <tr
                          key={product.id}
                          className={
                            active && lowStock
                              ? "inventory-low-stock-row"
                              : ""
                          }
                        >
                          <td>{product.productCode}</td>
                          <td>{product.name}</td>
                          <td>{getCategoryName(product.categoryId)}</td>
                          <td>{getUnitCode(product.unitId)}</td>
                          <td>
                            ₹
                            {Number(product.sellingPrice ?? 0).toFixed(2)}
                          </td>
                          <td>
                            <strong>{product.stockQuantity ?? 0}</strong>
                          </td>
                          <td>{product.gstRate}%</td>
                          <td>
                            <span
                              className={
                                !active
                                  ? "inventory-stock-badge inventory-stock-badge-low"
                                  : lowStock
                                    ? "inventory-stock-badge inventory-stock-badge-low"
                                    : "inventory-stock-badge inventory-stock-badge-ok"
                              }
                            >
                              {!active
                                ? "Inactive"
                                : lowStock
                                  ? "Low Stock"
                                  : "In Stock"}
                            </span>
                          </td>
                          <td>
                            <div className="inventory-form-actions">
                              <button
                                className="inventory-secondary-button"
                                type="button"
                                onClick={() => openProductDetails(product.id)}
                              >
                                View
                              </button>

                              {active && (
                                <>
                                  <button
                                    className="inventory-secondary-button"
                                    type="button"
                                    onClick={() => openEditForm(product.id)}
                                  >
                                    Edit
                                  </button>

                                  <button
                                    className="inventory-secondary-button"
                                    type="button"
                                    disabled={deactivating}
                                    onClick={() => handleDeactivate(product)}
                                  >
                                    {deactivating
                                      ? "Deactivating..."
                                      : "Deactivate"}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="inventory-reference-grid">
            <section className="inventory-panel">
              <h2>Product Categories</h2>
              <ul className="inventory-reference-list">
                {categories.map((category) => (
                  <li key={category.id}>
                    <span>{category.name}</span>
                    <span className="inventory-reference-status">
                      {(category.active ?? category.isActive) === false
                        ? "Inactive"
                        : "Active"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="inventory-panel">
              <h2>Measurement Units</h2>
              <ul className="inventory-reference-list">
                {units.map((unit) => (
                  <li key={unit.id}>
                    <span>{unit.name}</span>
                    <span className="inventory-unit-code">{unit.code}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

export default InventoryPage;
