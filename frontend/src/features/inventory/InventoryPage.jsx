import { useEffect, useState } from "react";

import {
  getProducts,
  getCategories,
  getMeasurementUnits,
  createProduct,
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
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");

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
    setForm({ ...initialForm });
    setSuccess("");
    setError("");
    setShowForm(true);
  }

  function cancelCreateForm() {
    setShowForm(false);
    setForm({ ...initialForm });
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const product = {
      ...form,
      productCode: form.productCode.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      categoryId: Number(form.categoryId),
      unitId: Number(form.unitId),
      purchasePrice: Number(form.purchasePrice),
      sellingPrice: Number(form.sellingPrice),
      gstRate: Number(form.gstRate),
      stockQuantity: Number(form.stockQuantity),
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

    if (
      !Number.isFinite(product.purchasePrice) ||
      !Number.isFinite(product.sellingPrice) ||
      !Number.isFinite(product.gstRate) ||
      !Number.isFinite(product.stockQuantity) ||
      !Number.isFinite(product.lowStockThreshold) ||
      product.purchasePrice < 0 ||
      product.sellingPrice < 0 ||
      product.gstRate < 0 ||
      product.gstRate > 100 ||
      product.stockQuantity < 0 ||
      product.lowStockThreshold < 0
    ) {
      setError(
        "Enter valid non-negative numbers. GST must be between 0 and 100."
      );
      return;
    }

    try {
      setSaving(true);

      await createProduct(product);

      setShowForm(false);
      setForm({ ...initialForm });
      setSuccess("Product created successfully.");

      await loadInventory();
    } catch (err) {
      setError(err.message || "Unable to create product.");
    } finally {
      setSaving(false);
    }
  }

  // Resolve category IDs into readable names.
  function getCategoryName(categoryId) {
    const category = categories.find(
      (item) => String(item.id) === String(categoryId)
    );

    return category?.name || "Unknown";
  }

  // Resolve unit IDs into readable unit codes.
  function getUnitCode(unitId) {
    const unit = units.find(
      (item) => String(item.id) === String(unitId)
    );

    return unit?.code || "—";
  }

  // A product is low on stock when stock is at or below its threshold.
  function isLowStock(product) {
    return (
      Number(product.stockQuantity ?? 0) <=
      Number(product.lowStockThreshold ?? 0)
    );
  }

  // Apply search, category and stock filters together.
  const filteredProducts = products.filter((product) => {
    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      String(product.name || "").toLowerCase().includes(search) ||
      String(product.productCode || "").toLowerCase().includes(search);

    const matchesCategory =
      selectedCategory === "ALL" ||
      String(product.categoryId) === selectedCategory;

    const lowStock = isLowStock(product);

    const matchesStock =
      stockFilter === "ALL" ||
      (stockFilter === "LOW" && lowStock) ||
      (stockFilter === "IN_STOCK" && !lowStock);

    return matchesSearch && matchesCategory && matchesStock;
  });

  const lowStockCount = products.filter(isLowStock).length;

  return (
    <main className="inventory-page">
      {/* Page header */}
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

      {/* Inventory summary cards */}
      <section
        className="inventory-stats"
        aria-label="Inventory summaries"
      >
        <article className="inventory-stat-card">
          <span>Total Products</span>
          <strong>{products.length}</strong>
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

      {/* Success message */}
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

      {/* Error message */}
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

      {/* Create product form */}
      {showForm && (
        <section className="inventory-panel inventory-form-panel">
          <div className="inventory-panel-heading">
            <div>
              <h2>Create Product</h2>
              <p>Enter the product details below.</p>
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
                Opening Stock *
                <input
                  name="stockQuantity"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.stockQuantity}
                  onChange={handleChange}
                  required
                />
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
                onClick={cancelCreateForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="inventory-primary-button"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Product"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Loading state */}
      {loading && (
        <p className="inventory-message" role="status">
          Loading inventory data...
        </p>
      )}

      {/* Inventory products */}
      {!loading && (
        <>
          <section className="inventory-panel">
            <div className="inventory-panel-heading">
              <div>
                <h2>Products</h2>
                <p>Search, filter and review your current inventory.</p>
              </div>
            </div>

            {/* Search and filters */}
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
                  <option
                    key={category.id}
                    value={String(category.id)}
                  >
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

              <button
                className="inventory-secondary-button"
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("ALL");
                  setStockFilter("ALL");
                }}
              >
                Clear Filters
              </button>
            </div>

            <p className="inventory-result-count">
              Showing {filteredProducts.length} of {products.length} products
            </p>

            {products.length === 0 ? (
              <div className="inventory-empty">
                <h3>No products yet</h3>
                <p>
                  Create your first product to start tracking inventory.
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="inventory-empty">
                <h3>No matching products</h3>
                <p>
                  Try a different search term or change your filters.
                </p>

                <button
                  className="inventory-secondary-button"
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategory("ALL");
                    setStockFilter("ALL");
                  }}
                >
                  Reset Search and Filters
                </button>
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
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map((product) => {
                      const lowStock = isLowStock(product);

                      return (
                        <tr
                          key={product.id}
                          className={
                            lowStock ? "inventory-low-stock-row" : ""
                          }
                        >
                          <td>{product.productCode}</td>
                          <td>{product.name}</td>
                          <td>
                            {getCategoryName(product.categoryId)}
                          </td>
                          <td>{getUnitCode(product.unitId)}</td>
                          <td>
                            ₹
                            {Number(
                              product.sellingPrice ?? 0
                            ).toFixed(2)}
                          </td>
                          <td>
                            <strong>
                              {product.stockQuantity ?? 0}
                            </strong>
                          </td>
                          <td>{product.gstRate}%</td>
                          <td>
                            <span
                              className={
                                lowStock
                                  ? "inventory-stock-badge inventory-stock-badge-low"
                                  : "inventory-stock-badge inventory-stock-badge-ok"
                              }
                            >
                              {lowStock ? "Low Stock" : "In Stock"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Categories and measurement units */}
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
                    <span className="inventory-unit-code">
                      {unit.code}
                    </span>
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