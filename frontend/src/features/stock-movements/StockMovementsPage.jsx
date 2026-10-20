import { useEffect, useMemo, useState } from "react";

import {
  getAllStockMovements,
  reverseStockMovement,
  recordStockMovement,
} from "../../services/api/stockMovementApi";
import { getProducts } from "../../services/api/inventoryApi";

import "./StockMovementsPage.css";
import { usePermission } from "../../auth/PermissionsContext";

const PAGE_SIZE = 25;

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function formatQuantity(value, unit = "") {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return "—";
  const formatted = quantity.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

function getDateRange(range) {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  if (range === "TODAY") return { from: end, to: end };
  const start = new Date(today);
  start.setDate(start.getDate() - (range === "WEEK" ? 6 : 29));
  return { from: start.toISOString().slice(0, 10), to: end };
}

function StockMovementsPage() {
  const canManageInventory = usePermission("INVENTORY_MANAGE");
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("ALL");
  const [referenceType, setReferenceType] = useState("ALL");
  const [productId, setProductId] = useState("ALL");
  const [dateRange, setDateRange] = useState("ALL");
  const [sort, setSort] = useState("date-desc");
  const [page, setPage] = useState(1);
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [reversing, setReversing] = useState(false);
  const [reversalNotes, setReversalNotes] = useState("");
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjustment, setAdjustment] = useState({
    productId: "",
    quantity: "",
    notes: "",
  });

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
      setError(err.message || "Unable to load stock movement history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMovements();
  }, []);

  const productMap = useMemo(
    () => new Map(products.map((product) => [String(product.id), product])),
    [products]
  );

  const filteredMovements = useMemo(() => {
    const query = search.trim().toLowerCase();
    const range = dateRange === "ALL" ? null : getDateRange(dateRange);
    const rows = movements.filter((movement) => {
      const product = productMap.get(String(movement.productId));
      const movementDate = movement.createdAt
        ? new Date(movement.createdAt).toISOString().slice(0, 10)
        : "";
      const matchesSearch =
        !query ||
        [
          movement.productId,
          product?.name,
          product?.productCode,
          movement.referenceNumber,
          movement.referenceType,
          movement.notes,
          movement.movementType,
        ].some((value) =>
          String(value ?? "").toLowerCase().includes(query)
        );
      return (
        matchesSearch &&
        (movementType === "ALL" || movement.movementType === movementType) &&
        (referenceType === "ALL" ||
          movement.referenceType === referenceType) &&
        (productId === "ALL" || String(movement.productId) === productId) &&
        (!range || (movementDate >= range.from && movementDate <= range.to))
      );
    });

    return rows.sort((first, second) => {
      if (sort === "date-desc" || sort === "date-asc") {
        const comparison =
          new Date(first.createdAt).getTime() -
          new Date(second.createdAt).getTime();
        return sort === "date-desc" ? -comparison : comparison;
      }
      const firstProduct = productMap.get(String(first.productId));
      const secondProduct = productMap.get(String(second.productId));
      const firstValue =
        sort === "product"
          ? String(firstProduct?.name || "").toLowerCase()
          : Number(first.quantityChange);
      const secondValue =
        sort === "product"
          ? String(secondProduct?.name || "").toLowerCase()
          : Number(second.quantityChange);
      return firstValue > secondValue ? 1 : firstValue < secondValue ? -1 : 0;
    });
  }, [
    dateRange,
    movementType,
    movements,
    productId,
    productMap,
    referenceType,
    search,
    sort,
  ]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredMovements.length / PAGE_SIZE)
  );
  const visibleMovements = filteredMovements.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const metrics = movements.reduce(
    (result, movement) => {
      const quantity = Number(movement.quantityChange || 0);
      result.net += quantity;
      if (movement.movementType === "PURCHASE") result.received += quantity;
      if (movement.movementType === "SALE") result.sold += Math.abs(quantity);
      if (movement.movementType === "ADJUSTMENT") result.adjustments += 1;
      if (movement.movementType === "REVERSAL") result.reversals += 1;
      result.products.add(String(movement.productId));
      return result;
    },
    {
      net: 0,
      received: 0,
      sold: 0,
      adjustments: 0,
      reversals: 0,
      products: new Set(),
    }
  );

  function clearFilters() {
    setSearch("");
    setMovementType("ALL");
    setReferenceType("ALL");
    setProductId("ALL");
    setDateRange("ALL");
    setPage(1);
  }

  function exportCsv() {
    const header = [
      "Date",
      "Product",
      "Product Code",
      "Movement",
      "Quantity Change",
      "Stock Before",
      "Stock After",
      "Reference Type",
      "Reference Number",
      "Notes",
    ];
    const rows = filteredMovements.map((movement) => {
      const product = productMap.get(String(movement.productId));
      return [
        formatDate(movement.createdAt),
        product?.name || `Product #${movement.productId}`,
        product?.productCode || "",
        movement.movementType,
        movement.quantityChange,
        movement.stockBefore,
        movement.stockAfter,
        movement.referenceType || "",
        movement.referenceNumber || "",
        movement.notes || "",
      ].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`);
    });
    const blob = new Blob(
      [[header, ...rows].map((row) => row.join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stock-movements.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleReverse() {
    if (!selectedMovement) return;
    if (!reversalNotes.trim()) {
      setError("Enter a reason for the reversal.");
      return;
    }
    try {
      setReversing(true);
      await reverseStockMovement(selectedMovement.id, reversalNotes.trim());
      setSelectedMovement(null);
      setReversalNotes("");
      await loadMovements();
    } catch (err) {
      setError(err.message || "Unable to reverse this movement.");
    } finally {
      setReversing(false);
    }
  }

  async function handleAdjustment(event) {
    event.preventDefault();
    const quantity = Number(adjustment.quantity);
    if (!adjustment.productId || !Number.isFinite(quantity) || quantity === 0) {
      setError("Select a product and enter a non-zero adjustment.");
      return;
    }
    if (!adjustment.notes.trim()) {
      setError("Enter a reason for the adjustment.");
      return;
    }
    try {
      await recordStockMovement({
        productId: Number(adjustment.productId),
        movementType: "ADJUSTMENT",
        quantityChange: quantity,
        referenceType: "MANUAL",
        notes: adjustment.notes.trim(),
      });
      setShowAdjustment(false);
      setAdjustment({ productId: "", quantity: "", notes: "" });
      await loadMovements();
    } catch (err) {
      setError(err.message || "Unable to record adjustment.");
    }
  }

  return (
    <section className="stock-movements-page">
      <div className="stock-movements-header">
        <div>
          <p className="stock-movements-eyebrow">INVENTORY / AUDIT</p>
          <h2>Stock Movements</h2>
          <p className="stock-movements-description">
            Track every stock increase, sale, adjustment, and reversal.
          </p>
        </div>
        <div className="stock-movements-header-actions">
          {canManageInventory && <button type="button" className="stock-movements-secondary" onClick={() => setShowAdjustment(true)}>
            Record adjustment
          </button>}
          <button type="button" className="stock-movements-refresh" onClick={loadMovements} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button type="button" className="stock-movements-primary" onClick={exportCsv} disabled={!filteredMovements.length}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="stock-movements-stats">
        <article><span>Net stock change</span><strong>{formatQuantity(metrics.net)}</strong></article>
        <article><span>Stock received</span><strong>{formatQuantity(metrics.received)}</strong></article>
        <article><span>Stock sold</span><strong>{formatQuantity(metrics.sold)}</strong></article>
        <article><span>Adjustments</span><strong>{metrics.adjustments}</strong></article>
        <article><span>Reversals</span><strong>{metrics.reversals}</strong></article>
        <article><span>Products affected</span><strong>{metrics.products.size}</strong></article>
      </div>

      <div className="stock-movements-toolbar">
        <input type="search" aria-label="Search stock movements" placeholder="Search product, code, reference, notes..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <select aria-label="Filter by product" value={productId} onChange={(event) => { setProductId(event.target.value); setPage(1); }}>
          <option value="ALL">All products</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
        <select aria-label="Filter by movement type" value={movementType} onChange={(event) => { setMovementType(event.target.value); setPage(1); }}>
          <option value="ALL">All movements</option>
          <option value="SALE">Sales</option>
          <option value="PURCHASE">Purchases</option>
          <option value="ADJUSTMENT">Adjustments</option>
          <option value="REVERSAL">Reversals</option>
        </select>
        <select aria-label="Filter by source" value={referenceType} onChange={(event) => { setReferenceType(event.target.value); setPage(1); }}>
          <option value="ALL">All sources</option>
          <option value="SALES_ORDER">Sales orders</option>
          <option value="PURCHASE">Purchases</option>
          <option value="MANUAL">Manual</option>
          <option value="REVERSAL">Reversals</option>
        </select>
        <select aria-label="Filter by date" value={dateRange} onChange={(event) => { setDateRange(event.target.value); setPage(1); }}>
          <option value="ALL">All dates</option>
          <option value="TODAY">Today</option>
          <option value="WEEK">Last 7 days</option>
          <option value="MONTH">Last 30 days</option>
        </select>
        <select aria-label="Sort movements" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="product">Product A–Z</option>
          <option value="quantity">Quantity change</option>
        </select>
        <button type="button" className="stock-movements-clear" onClick={clearFilters}>Clear filters</button>
      </div>

      {error && <div className="stock-movements-error" role="alert"><p>{error}</p><button type="button" onClick={() => setError("")}>Dismiss</button></div>}

      {loading ? <div className="stock-movements-message">Loading stock movement history...</div> : !filteredMovements.length ? <div className="stock-movements-message">{movements.length ? "No movements match your filters." : "No stock movements have been recorded yet."}</div> : (
        <>
          <div className="stock-movements-table-wrapper">
            <table className="stock-movements-table">
              <thead><tr><th>Date</th><th>Product</th><th>Movement</th><th>Quantity</th><th>Stock before</th><th>Stock after</th><th>Source</th><th>Actions</th></tr></thead>
              <tbody>
                {visibleMovements.map((movement) => {
                  const product = productMap.get(String(movement.productId));
                  const unit = product?.unitCode || product?.unit || "";
                  return <tr key={movement.id} onClick={() => setSelectedMovement(movement)}>
                    <td>{formatDate(movement.createdAt)}</td>
                    <td><strong>{product?.name || `Product #${movement.productId}`}</strong><small>{product?.productCode || `ID: ${movement.productId}`}</small></td>
                    <td><span className={`stock-movement-badge stock-movement-${String(movement.movementType || "unknown").toLowerCase()}`}>{movement.movementType || "Unknown"}</span></td>
                    <td className={Number(movement.quantityChange) < 0 ? "stock-quantity-negative" : "stock-quantity-positive"}>{Number(movement.quantityChange) > 0 ? "+" : ""}{formatQuantity(movement.quantityChange, unit)}</td>
                    <td>{formatQuantity(movement.stockBefore, unit)}</td>
                    <td>{formatQuantity(movement.stockAfter, unit)}</td>
                    <td><strong>{movement.referenceNumber || "Manual"}</strong><small>{movement.referenceType || "—"}</small></td>
                    <td><button type="button" className="stock-row-action" onClick={(event) => { event.stopPropagation(); setSelectedMovement(movement); }}>View</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="stock-movements-pagination">
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredMovements.length)} of {filteredMovements.length}</span>
            <div><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><strong>Page {page} of {pageCount}</strong><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div>
          </div>
        </>
      )}

      {selectedMovement && <div className="stock-movement-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedMovement(null)}>
        <section className="stock-movement-modal" role="dialog" aria-modal="true" aria-labelledby="movement-detail-heading">
          <div className="stock-movement-modal-heading"><div><p className="stock-movements-eyebrow">MOVEMENT DETAIL</p><h3 id="movement-detail-heading">{selectedMovement.movementType}</h3><p>{formatDate(selectedMovement.createdAt)}</p></div><button type="button" onClick={() => setSelectedMovement(null)} aria-label="Close details">×</button></div>
          <div className="stock-movement-detail-grid">
            <p><span>Product</span><strong>{productMap.get(String(selectedMovement.productId))?.name || `Product #${selectedMovement.productId}`}</strong></p>
            <p><span>Quantity change</span><strong>{formatQuantity(selectedMovement.quantityChange)}</strong></p>
            <p><span>Stock before</span><strong>{formatQuantity(selectedMovement.stockBefore)}</strong></p>
            <p><span>Stock after</span><strong>{formatQuantity(selectedMovement.stockAfter)}</strong></p>
            <p><span>Reference</span><strong>{selectedMovement.referenceNumber || "Manual"}</strong></p>
            <p><span>Source type</span><strong>{selectedMovement.referenceType || "—"}</strong></p>
          </div>
          <div className="stock-movement-notes"><span>Notes</span><p>{selectedMovement.notes || "No notes recorded."}</p></div>
          {canManageInventory && selectedMovement.movementType !== "REVERSAL" && <div className="stock-movement-reversal"><label>Reversal reason<input value={reversalNotes} onChange={(event) => setReversalNotes(event.target.value)} placeholder="Why should this movement be reversed?" /></label><button type="button" className="stock-movements-danger" onClick={handleReverse} disabled={reversing}>{reversing ? "Reversing..." : "Reverse movement"}</button></div>}
        </section>
      </div>}

      {showAdjustment && <div className="stock-movement-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowAdjustment(false)}>
        <section className="stock-movement-modal" role="dialog" aria-modal="true" aria-labelledby="adjustment-heading">
          <div className="stock-movement-modal-heading"><div><h3 id="adjustment-heading">Record stock adjustment</h3><p>Use this for a physical count or correction.</p></div><button type="button" onClick={() => setShowAdjustment(false)} aria-label="Close adjustment">×</button></div>
          <form className="stock-adjustment-form" onSubmit={handleAdjustment}>
            <label>Product<select value={adjustment.productId} onChange={(event) => setAdjustment({ ...adjustment, productId: event.target.value })} required><option value="">Select product</option>{products.filter((product) => product.active !== false).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
            <label>Quantity change<input type="number" step="0.001" value={adjustment.quantity} onChange={(event) => setAdjustment({ ...adjustment, quantity: event.target.value })} placeholder="Use negative quantity to reduce stock" required /></label>
            <label>Reason<textarea value={adjustment.notes} onChange={(event) => setAdjustment({ ...adjustment, notes: event.target.value })} rows="3" required /></label>
            <button type="submit" className="stock-movements-primary">Record adjustment</button>
          </form>
        </section>
      </div>}
    </section>
  );
}

export default StockMovementsPage;
