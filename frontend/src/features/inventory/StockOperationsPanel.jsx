
import { useEffect, useMemo, useState } from "react";
import {
  getProductStockMovements,
  recordStockMovement,
} from "../../services/api/inventoryApi";
import "./StockOperationsPanel.css";

const EMPTY_FORM = {
  movementType: "PURCHASE",
  quantity: "",
  referenceNumber: "",
  notes: "",
};

function getErrorMessage(error) {
  return error?.message || "Something went wrong. Please try again.";
}

export default function StockOperationsPanel({ products = [], onStockUpdated }) {
  const activeProducts = useMemo(
    () => products.filter((product) => product.active !== false),
    [products]
  );

  const [productId, setProductId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [movements, setMovements] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!activeProducts.length) {
      setProductId("");
      return;
    }

    const exists = activeProducts.some(
      (product) => String(product.id) === String(productId)
    );

    if (!exists) {
      setProductId(String(activeProducts[0].id));
    }
  }, [activeProducts, productId]);

  const selectedProduct = activeProducts.find(
    (product) => String(product.id) === String(productId)
  );

  const stockQuantity = Number(
    selectedProduct?.stockQuantity ??
    selectedProduct?.stock_quantity ??
    0
  );

  const unit = selectedProduct?.unitCode || selectedProduct?.unit || "";

  async function loadHistory(id) {
    if (!id) {
      setMovements([]);
      return;
    }

    setLoadingHistory(true);

    try {
      const response = await getProductStockMovements(id);
      setMovements(Array.isArray(response) ? response : []);
    } catch (err) {
      setError(`Could not load movement history: ${getErrorMessage(err)}`);
      setMovements([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (productId) {
      loadHistory(productId);
    }
  }, [productId]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setError("");
    setSuccess("");
  }

  function handleMovementTypeChange(event) {
    setForm((previous) => ({
      ...previous,
      movementType: event.target.value,
    }));
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedProduct) {
      setError("Please select an active product.");
      return;
    }

    const quantity = Number(form.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }

    if (form.movementType === "ADJUSTMENT" && !form.notes.trim()) {
      setError("Enter a reason for the stock adjustment.");
      return;
    }

    const quantityChange =
      form.movementType === "SALE" ? -quantity : quantity;

    setSubmitting(true);

    try {
      await recordStockMovement({
        productId: Number(productId),
        movementType: form.movementType,
        quantityChange,
        referenceType: "MANUAL",
        referenceNumber: form.referenceNumber.trim() || null,
        notes: form.notes.trim() || null,
      });

      setSuccess("Stock movement recorded successfully.");
      setForm(EMPTY_FORM);

      await loadHistory(productId);

      if (typeof onStockUpdated === "function") {
        await onStockUpdated();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString();
  }

  if (!activeProducts.length) {
    return (
      <section className="stock-operations-panel">
        <h2>Stock Operations</h2>
        <p>No active products are available for stock operations.</p>
      </section>
    );
  }

  return (
    <section className="stock-operations-panel">
      <div className="stock-operations-heading">
        <div>
          <h2>Stock Operations</h2>
          <p>Record purchases, sales and stock adjustments.</p>
        </div>
      </div>

      <div className="stock-product-selector">
        <label htmlFor="stock-product">Select product</label>
        <select
          id="stock-product"
          value={productId}
          onChange={(event) => {
            setProductId(event.target.value);
            setError("");
            setSuccess("");
          }}
        >
          {activeProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {product.productCode || product.code || product.id}
              {" — "}
              {product.productName || product.name || "Unnamed product"}
            </option>
          ))}
        </select>
      </div>

      {selectedProduct && (
        <div className="stock-current-balance">
          <span>Current stock</span>
          <strong>
            {stockQuantity.toLocaleString(undefined, {
              maximumFractionDigits: 3,
            })}{" "}
            {unit}
          </strong>
        </div>
      )}

      <form className="stock-movement-form" onSubmit={handleSubmit}>
        <div className="stock-form-grid">
          <div className="stock-form-field">
            <label htmlFor="movementType">Movement type</label>
            <select
              id="movementType"
              name="movementType"
              value={form.movementType}
              onChange={handleMovementTypeChange}
              disabled={submitting}
            >
              <option value="PURCHASE">Stock In — Purchase</option>
              <option value="SALE">Stock Out — Sale</option>
              <option value="ADJUSTMENT">Stock Adjustment</option>
              <option value="REVERSAL">Reversal</option>
            </select>
          </div>

          <div className="stock-form-field">
            <label htmlFor="stock-quantity">Quantity</label>
            <input
              id="stock-quantity"
              name="quantity"
              type="number"
              min="0.001"
              max="99999999999.999"
              step="0.001"
              value={form.quantity}
              onChange={updateField}
              placeholder="Enter quantity"
              required
              disabled={submitting}
            />
          </div>

          <div className="stock-form-field">
            <label htmlFor="referenceNumber">Reference number (optional)</label>
            <input
              id="referenceNumber"
              name="referenceNumber"
              type="text"
              maxLength="50"
              value={form.referenceNumber}
              onChange={updateField}
              placeholder="e.g. PUR-001"
              disabled={submitting}
            />
          </div>

          <div className="stock-form-field">
            <label htmlFor="stock-notes">
              {form.movementType === "ADJUSTMENT"
                ? "Adjustment reason (required)"
                : "Notes (optional)"}
            </label>
            <textarea
              id="stock-notes"
              name="notes"
              maxLength="500"
              rows="2"
              value={form.notes}
              onChange={updateField}
              placeholder={
                form.movementType === "ADJUSTMENT"
                  ? "Explain why the stock is changing"
                  : "Optional transaction details"
              }
              required={form.movementType === "ADJUSTMENT"}
              disabled={submitting}
            />
          </div>
        </div>

        {error && (
          <div className="stock-message stock-message-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="stock-message stock-message-success" role="status">
            {success}
          </div>
        )}

        <button
          className="stock-submit-button"
          type="submit"
          disabled={submitting || !selectedProduct}
        >
          {submitting ? "Recording movement..." : "Record Stock Movement"}
        </button>

        <p className="stock-form-note">
          Stock is updated by the backend. A sale reduces stock; purchases and
          positive adjustments increase it. Check the movement type carefully
          before submitting.
        </p>
      </form>

      <div className="stock-history-section">
        <div className="stock-history-heading">
          <h3>Movement History</h3>
          <button
            type="button"
            className="stock-refresh-button"
            onClick={() => loadHistory(productId)}
            disabled={loadingHistory}
          >
            {loadingHistory ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loadingHistory ? (
          <p>Loading movement history...</p>
        ) : movements.length === 0 ? (
          <p>No stock movements recorded for this product yet.</p>
        ) : (
          <div className="stock-history-table-wrapper">
            <table className="stock-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Change</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Reference</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDate(movement.createdAt)}</td>
                    <td>{movement.movementType}</td>
                    <td>
                      {Number(movement.quantityChange) > 0 ? "+" : ""}
                      {Number(movement.quantityChange).toLocaleString(
                        undefined,
                        { maximumFractionDigits: 3 }
                      )}
                    </td>
                    <td>{movement.stockBefore}</td>
                    <td>{movement.stockAfter}</td>
                    <td>{movement.referenceNumber || "—"}</td>
                    <td>{movement.notes || "—"}</td>
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
