import { useEffect, useState } from "react";

import { getAllStockMovements } from "../../services/api/stockMovementApi";
import { getProducts } from "../../services/api/inventoryApi";

import "./StockMovementsPage.css";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatQuantity(value) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity)) return "—";

  return quantity.toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function StockMovementsPage() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("ALL");

  async function loadMovements() {
    setLoading(true);
    setError("");

    try {
      const [movementData, productData] = await Promise.all([
        getAllStockMovements(),
        getProducts(),
      ]);

      setMovements(Array.isArray(movementData) ? movementData : []);
      setProducts(Array.isArray(productData) ? productData : []);
    } catch (err) {
      setError(
        err.message || "Unable to load stock movement history."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMovements();
  }, []);

  // Map each product ID to its name.
  const productNames = new Map(
    products.map((product) => [
      String(product.id),
      product.name,
    ])
  );

  const filteredMovements = movements.filter((movement) => {
    const query = search.trim().toLowerCase();

    const productName =
      productNames.get(String(movement.productId)) || "";

    const matchesSearch =
      !query ||
      [
        movement.productId,
        productName,
        movement.referenceNumber,
        movement.referenceType,
        movement.notes,
        movement.movementType,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );

    const matchesType =
      movementType === "ALL" ||
      movement.movementType === movementType;

    return matchesSearch && matchesType;
  });

  const totalMovements = movements.length;

  const salesMovements = movements.filter(
    (movement) => movement.movementType === "SALE"
  ).length;

  return (
    <section className="stock-movements-page">
      <div className="stock-movements-header">
        <div>
          <p className="stock-movements-eyebrow">INVENTORY</p>

          <h2>Stock Movement History</h2>

          <p className="stock-movements-description">
            Review stock changes, quantities, and their references.
          </p>
        </div>

        <button
          type="button"
          className="stock-movements-refresh"
          onClick={loadMovements}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh history"}
        </button>
      </div>

      <div className="stock-movements-stats">
        <article className="stock-movement-stat">
          <span>Total movements</span>
          <strong>{totalMovements}</strong>
        </article>

        <article className="stock-movement-stat">
          <span>Sales movements</span>
          <strong>{salesMovements}</strong>
        </article>
      </div>

      <div className="stock-movements-toolbar">
        <input
          type="search"
          aria-label="Search stock movements"
          placeholder="Search product name, order number, notes..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          aria-label="Filter by movement type"
          value={movementType}
          onChange={(event) => setMovementType(event.target.value)}
        >
          <option value="ALL">All movement types</option>
          <option value="SALE">Sale</option>
          <option value="PURCHASE">Purchase</option>
          <option value="ADJUSTMENT">Adjustment</option>
          <option value="REVERSAL">Reversal</option>
        </select>
      </div>

      {error && (
        <div className="stock-movements-error" role="alert">
          <p>{error}</p>

          <button type="button" onClick={loadMovements}>
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="stock-movements-message">
          Loading stock movement history...
        </div>
      ) : !error && filteredMovements.length === 0 ? (
        <div className="stock-movements-message">
          {movements.length === 0
            ? "No stock movements have been recorded yet."
            : "No movements match your search or filter."}
        </div>
      ) : !error ? (
        <div className="stock-movements-table-wrapper">
          <table className="stock-movements-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Movement</th>
                <th>Quantity change</th>
                <th>Stock before</th>
                <th>Stock after</th>
                <th>Reference</th>
                <th>Notes</th>
              </tr>
            </thead>

            <tbody>
              {filteredMovements.map((movement) => {
                const productName =
                  productNames.get(String(movement.productId));

                return (
                  <tr key={movement.id}>
                    <td>{formatDate(movement.createdAt)}</td>

                    <td>
                      <div className="stock-movement-product-name">
                        {productName ||
                          `Product #${movement.productId}`}
                      </div>

                      <small className="stock-movement-product-id">
                        ID: {movement.productId}
                      </small>
                    </td>

                    <td>
                      <span
                        className={`stock-movement-badge stock-movement-${String(
                          movement.movementType || "unknown"
                        ).toLowerCase()}`}
                      >
                        {movement.movementType || "Unknown"}
                      </span>
                    </td>

                    <td
                      className={
                        Number(movement.quantityChange) < 0
                          ? "stock-quantity-negative"
                          : "stock-quantity-positive"
                      }
                    >
                      {formatQuantity(movement.quantityChange)}
                    </td>

                    <td>{formatQuantity(movement.stockBefore)}</td>

                    <td>{formatQuantity(movement.stockAfter)}</td>

                    <td>
                      <div>{movement.referenceNumber || "—"}</div>
                      <small>{movement.referenceType || ""}</small>
                    </td>

                    <td>{movement.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && !error && filteredMovements.length > 0 && (
        <p className="stock-movements-result-count">
          Showing {filteredMovements.length} of {movements.length} movements
        </p>
      )}
    </section>
  );
}

export default StockMovementsPage;