
import { useEffect, useMemo, useState } from "react";
import {
  getProductStockMovements,
  recordStockMovement,
} from "../../services/api/inventoryApi";
import "./StockOperationsPanel.css";
import { label } from "../../utils/format";
import { t } from "../../i18n";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";

const EMPTY_FORM = {
  movementType: "PURCHASE",
  quantity: "",
  secondaryQuantity: "",
  referenceNumber: "",
  notes: "",
};

function getErrorMessage(error) {
  return error?.message || t("Something went wrong. Please try again.");
}

export default function StockOperationsPanel({ products = [], units = [], onStockUpdated }) {
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
  const secondaryUnit = units.find(
    (entry) => Number(entry.id) === Number(selectedProduct?.secondaryUnitId)
  )?.code || "";

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
      setError(t("Could not load movement history: {error}", { error: getErrorMessage(err) }));
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
      setError(t("Please select an active product."));
      return;
    }

    const quantity = Number(form.quantity);
    const secondaryQuantity = Number(form.secondaryQuantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError(t("Enter a quantity greater than zero."));
      return;
    }
    if (selectedProduct.secondaryUnitId != null
      && (!Number.isFinite(secondaryQuantity) || secondaryQuantity <= 0)) {
      setError(t("Enter a positive secondary quantity for this dual-unit product."));
      return;
    }

    if (form.movementType === "ADJUSTMENT" && !form.notes.trim()) {
      setError(t("Enter a reason for the stock adjustment."));
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
        secondaryQuantityChange: selectedProduct.secondaryUnitId == null
          ? null
          : form.movementType === "SALE" ? -secondaryQuantity : secondaryQuantity,
        referenceType: "MANUAL",
        referenceNumber: form.referenceNumber.trim() || null,
        notes: form.notes.trim() || null,
      });

      setSuccess(t("Stock movement recorded successfully."));
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
        <h2>{t("Stock Operations")}</h2>
        <p>{t("No active products are available for stock operations.")}</p>
      </section>
    );
  }

  return (
    <section className="stock-operations-panel">
      <div className="stock-operations-heading">
        <div>
          <h2>{t("Stock Operations")}</h2>
          <p>{t("Record purchases, sales and stock adjustments.")}</p>
        </div>
      </div>

      <div className="stock-product-selector">
        <label htmlFor="stock-product">{t("Select product")}</label>
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
              {product.productName || product.name || t("Unnamed product")}
            </option>
          ))}
        </select>
      </div>

      {selectedProduct && (
        <div className="stock-current-balance">
          <span>{t("Current stock")}</span>
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
            <label htmlFor="movementType">{t("What happened?")}</label>
            <select
              id="movementType"
              name="movementType"
              value={form.movementType}
              onChange={handleMovementTypeChange}
              disabled={submitting}
            >
              <option value="PURCHASE">{t("Stock came in")}</option>
              <option value="SALE">{t("Stock went out")}</option>
              <option value="ADJUSTMENT">{t("Correction after counting")}</option>
            </select>
          </div>

          <div className="stock-form-field">
            <label htmlFor="stock-quantity">{t("Quantity")}</label>
            <input
              id="stock-quantity"
              name="quantity"
              type="number"
              min="0.001"
              max="99999999999.999"
              step="0.001"
              value={form.quantity}
              onChange={updateField}
              placeholder={t("Enter quantity")}
              required
              disabled={submitting}
            />
          </div>

          {secondaryUnit && <div className="stock-form-field">
            <label htmlFor="secondary-stock-quantity">{t("Quantity ({unit})", { unit: secondaryUnit })}</label>
            <input
              id="secondary-stock-quantity"
              name="secondaryQuantity"
              type="number"
              min="0.001"
              step="0.001"
              value={form.secondaryQuantity}
              onChange={updateField}
              placeholder={t("Enter {unit} quantity", { unit: secondaryUnit })}
              required
              disabled={submitting}
            />
          </div>}

          <div className="stock-form-field">
            <label htmlFor="referenceNumber">{t("Reference number (optional)")}</label>
            <input
              id="referenceNumber"
              name="referenceNumber"
              type="text"
              maxLength="50"
              value={form.referenceNumber}
              onChange={updateField}
              placeholder={t("e.g. PUR-001")}
              disabled={submitting}
            />
          </div>

          <div className="stock-form-field">
            <label htmlFor="stock-notes">
              {form.movementType === "ADJUSTMENT"
                ? t("Adjustment reason (required)")
                : t("Notes (optional)")}
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
                  ? t("Explain why the stock is changing")
                  : t("Optional transaction details")
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
          {submitting ? t("Saving...") : t("Save stock change")}
        </button>

        <p className="stock-form-note">
          {t("Use this only for changes that did not come from a bill or a supplier purchase, for example after counting the stock. Bills and purchases update stock by themselves.")}
        </p>
      </form>

      <div className="stock-history-section">
        <div className="stock-history-heading">
          <h3>{t("Movement History")}</h3>
          <button
            type="button"
            className="stock-refresh-button"
            onClick={() => loadHistory(productId)}
            disabled={loadingHistory}
          >
            {loadingHistory ? t("Loading...") : t("Refresh")}
          </button>
        </div>

        {loadingHistory ? (
          <Skeleton label={t("Loading movement history...")} rows={3} />
        ) : movements.length === 0 ? (
          <EmptyState text={t("No stock movements recorded for this product yet.")} />
        ) : (
          <div className="stock-history-table-wrapper">
            <table className="stock-history-table">
              <thead>
                <tr>
                  <th>{t("Date")}</th>
                  <th>{t("Type")}</th>
                  <th>{t("Change")}</th>
                  <th>{t("Before")}</th>
                  <th>{t("After")}</th>
                  <th>{t("Reference")}</th>
                  <th>{t("Notes")}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDate(movement.createdAt)}</td>
                    <td>{label(movement.movementType)}</td>
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
