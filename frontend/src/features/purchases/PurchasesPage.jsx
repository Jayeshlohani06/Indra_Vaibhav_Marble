
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSuppliers } from "../../services/api/supplierApi";
import {
  getCategories,
  getMeasurementUnits,
  getProducts,
} from "../../services/api/inventoryApi";
import {
  createPurchase,
  getPurchases,
  receivePurchase,
} from "../../services/api/purchaseApi";
import {
  getPurchasePayments,
  recordPurchasePayment,
  getPurchaseBalance,
} from "../../services/api/paymentApi";
import CreateProductForm from "./CreateProductForm";
import "./PurchasesPage.css";

const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const emptyLine = {
  productId: "",
  quantity: "1",
  purchaseRate: "0",
  discountAmount: "0",
  gstRate: "0",
};

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });

const round2 = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

function PurchasesPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);

  const [supplierId, setSupplierId] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [invoiceDiscount, setInvoiceDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ ...emptyLine }]);

  const [createProductForIndex, setCreateProductForIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receivingId, setReceivingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paymentPurchase, setPaymentPurchase] = useState(null);
  const [paymentBalance, setPaymentBalance] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        supplierData,
        productData,
        purchaseData,
        categoryData,
        unitData,
      ] = await Promise.all([
        getSuppliers(),
        getProducts(),
        getPurchases(),
        getCategories(),
        getMeasurementUnits(),
      ]);

      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setProducts(Array.isArray(productData) ? productData : []);
      setPurchases(Array.isArray(purchaseData) ? purchaseData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setUnits(Array.isArray(unitData) ? unitData : []);
    } catch (err) {
      setError(err.message || "Unable to load purchase data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculations = useMemo(() => {
    let subtotal = 0;
    let lineDiscounts = 0;
    let gstAmount = 0;

    const calculatedItems = items.map((item) => {
      const quantity = Number(item.quantity);
      const rate = Number(item.purchaseRate);
      const discount = Number(item.discountAmount);
      const gstRate = Number(item.gstRate);

      const gross =
        quantity > 0 && rate >= 0 ? round2(quantity * rate) : 0;

      const safeDiscount =
        discount >= 0 && discount <= gross ? discount : 0;

      const taxable = round2(gross - safeDiscount);
      const gst = round2((taxable * gstRate) / 100);
      const total = round2(taxable + gst);

      subtotal += gross;
      lineDiscounts += safeDiscount;
      gstAmount += gst;

      return { ...item, gross, taxable, gst, total };
    });

    const extraDiscount = Math.max(0, Number(invoiceDiscount) || 0);

    return {
      items: calculatedItems,
      subtotal: round2(subtotal),
      lineDiscounts: round2(lineDiscounts),
      invoiceDiscount: round2(extraDiscount),
      totalDiscount: round2(lineDiscounts + extraDiscount),
      gstAmount: round2(gstAmount),
      totalAmount: round2(
        subtotal - lineDiscounts - extraDiscount + gstAmount
      ),
    };
  }, [items, invoiceDiscount]);

  function updateItem(index, field, value) {
    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  function selectProduct(index, value) {
    if (!value) {
      setItems((previous) =>
        previous.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...emptyLine } : item
        )
      );
      setError("");
      return;
    }

    const product = products.find(
      (entry) => String(entry.id) === String(value)
    );

    if (!product) {
      setError("Product not found. Refresh the page and try again.");
      return;
    }

    if (product.active === false || product.isActive === false) {
      setError("This product is inactive and cannot be added to a purchase.");
      return;
    }

    setError("");
    setSuccess("");

    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              productId: String(product.id),
              purchaseRate: String(product.purchasePrice ?? 0),
              gstRate: String(product.gstRate ?? 0),
            }
          : item
      )
    );
  }

  function addLine() {
    setItems((previous) => [...previous, { ...emptyLine }]);
    setError("");
  }

  function removeLine(index) {
    setItems((previous) =>
      previous.length === 1
        ? previous
        : previous.filter((_, itemIndex) => itemIndex !== index)
    );
    setError("");
  }

  function resetForm() {
    setSupplierId("");
    setSupplierInvoiceNumber("");
    setPurchaseDate(today());
    setInvoiceDiscount("0");
    setNotes("");
    setItems([{ ...emptyLine }]);
    setError("");
  }

  async function handleProductCreated(product, settingsSaved) {
    const targetIndex = createProductForIndex;
    setCreateProductForIndex(null);
    setError("");

    try {
      const refreshedProducts = await getProducts();
      const productList = Array.isArray(refreshedProducts)
        ? refreshedProducts
        : [];

      const createdProduct =
        productList.find(
          (entry) => String(entry.id) === String(product.id)
        ) || product;

      setProducts(productList);

      if (targetIndex !== null && createdProduct.id != null) {
        setItems((previous) =>
          previous.map((item, index) =>
            index === targetIndex
              ? {
                  ...item,
                  productId: String(createdProduct.id),
                  purchaseRate: String(createdProduct.purchasePrice ?? 0),
                  gstRate: String(createdProduct.gstRate ?? 0),
                }
              : item
          )
        );
      }

      setSuccess(
        settingsSaved
          ? `"${createdProduct.name}" was created with zero stock and selected for this purchase.`
          : `"${createdProduct.name}" was created and selected with zero stock. Inventory tracking settings need attention. Do not create the product again.`
      );
    } catch (err) {
      // The creation request may already have succeeded. Avoid creating it twice.
      setError(
        `The product may already have been created. Refresh the page before retrying. ${err.message || ""}`
      );
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!supplierId) {
      setError("Please select a supplier.");
      return;
    }

    if (!purchaseDate || purchaseDate > today()) {
      setError("Select a valid purchase date that is not in the future.");
      return;
    }

    if (items.some((item) => !item.productId)) {
      setError("Please select a product for every purchase line.");
      return;
    }

    if (
      items.some(
        (item) =>
          !Number.isFinite(Number(item.quantity)) ||
          Number(item.quantity) <= 0 ||
          !Number.isFinite(Number(item.purchaseRate)) ||
          Number(item.purchaseRate) < 0 ||
          !Number.isFinite(Number(item.discountAmount)) ||
          Number(item.discountAmount) < 0 ||
          !Number.isFinite(Number(item.gstRate)) ||
          Number(item.gstRate) < 0 ||
          Number(item.gstRate) > 100
      )
    ) {
      setError("Check quantity, purchase rate, discount, and GST values.");
      return;
    }

    if (
      calculations.items.some(
        (item) => Number(item.discountAmount) > item.gross
      )
    ) {
      setError("A line discount cannot exceed that line's gross amount.");
      return;
    }

    if (
      !Number.isFinite(Number(invoiceDiscount)) ||
      Number(invoiceDiscount) < 0 ||
      Number(invoiceDiscount) >
        calculations.subtotal - calculations.lineDiscounts
    ) {
      setError(
        "Invoice discount is invalid or exceeds the remaining subtotal."
      );
      return;
    }

    const payload = {
      supplierId: Number(supplierId),
      supplierInvoiceNumber: supplierInvoiceNumber.trim() || null,
      purchaseDate,
      discountAmount: Number(invoiceDiscount),
      notes: notes.trim() || null,
      items: items.map((item) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        purchaseRate: Number(item.purchaseRate),
        discountAmount: Number(item.discountAmount),
        gstRate: Number(item.gstRate),
      })),
    };

    setSaving(true);

    try {
      const created = await createPurchase(payload);

      setSuccess(
        `Purchase ${created.purchaseNumber || `#${created.id}`} saved as ${created.status || "DRAFT"}. Stock has not been changed.`
      );

      resetForm();
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to save purchase.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReceivePurchase(purchase) {
    const confirmed = window.confirm(
      `Receive purchase ${purchase.purchaseNumber}? This will add its quantities to inventory.`
    );

    if (!confirmed) return;

    setReceivingId(purchase.id);
    setError("");
    setSuccess("");

    try {
      const received = await receivePurchase(purchase.id);

      setSuccess(
        `Purchase ${received.purchaseNumber} received successfully. Inventory stock has been updated.`
      );

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to receive purchase.");
    } finally {
      setReceivingId(null);
    }
  }

  async function openPaymentPanel(purchase) {
    setPaymentPurchase(purchase);
    setPaymentBalance(null);
    setPaymentHistory([]);
    setPaymentError("");
    setPaymentAmount("");
    setPaymentDate(today());
    setPaymentMethod("UPI");
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentLoading(true);

    try {
      const [balance, history] = await Promise.all([
        getPurchaseBalance(purchase.id),
        getPurchasePayments(purchase.id),
      ]);

      setPaymentBalance(balance);
      setPaymentHistory(Array.isArray(history) ? history : []);
    } catch (err) {
      setPaymentError(err.message || "Unable to load payment details.");
    } finally {
      setPaymentLoading(false);
    }
  }

  async function handleRecordPayment(event) {
    event.preventDefault();
    if (!paymentPurchase) return;

    setPaymentError("");

    const amount = Number(paymentAmount);

    if (!paymentDate || paymentDate > today()) {
      setPaymentError("Select a valid payment date.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a payment amount greater than zero.");
      return;
    }

    if (!paymentMethod) {
      setPaymentError("Select a payment method.");
      return;
    }

    setPaymentSaving(true);

    try {
      await recordPurchasePayment(paymentPurchase.id, {
        paymentDate,
        amount,
        paymentMethod,
        referenceNumber: paymentReference.trim() || null,
        notes: paymentNotes.trim() || null,
      });

      const [balance, history] = await Promise.all([
        getPurchaseBalance(paymentPurchase.id),
        getPurchasePayments(paymentPurchase.id),
      ]);

      setPaymentBalance(balance);
      setPaymentHistory(Array.isArray(history) ? history : []);
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
      setSuccess("Supplier payment recorded successfully.");
    } catch (err) {
      setPaymentError(err.message || "Unable to record supplier payment.");
    } finally {
      setPaymentSaving(false);
    }
  }

  return (
    <section className="purchases-page">
      <div className="purchases-heading">
        <div>
          <p className="purchases-eyebrow">PURCHASE MANAGEMENT</p>
          <h2>Purchases</h2>
          <p className="purchases-subtitle">
            Record supplier invoices and purchase items.
          </p>
        </div>

        <div className="purchase-count-card">
          <span>Saved purchases</span>
          <strong>{purchases.length}</strong>
        </div>
      </div>

      {error && (
        <div className="purchase-alert purchase-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="purchase-alert purchase-success" role="status">
          {success}
        </div>
      )}

      {loading ? (
        <div className="purchase-card">
          Loading suppliers, products, categories, units, and purchases...
        </div>
      ) : (
        <>
          <form className="purchase-card" onSubmit={handleSubmit}>
            <div className="purchase-section-heading">
              <div>
                <h3>New Purchase</h3>
                <p>
                  Enter the details exactly as shown on the supplier invoice.
                </p>
              </div>
            </div>

            <div className="purchase-form-grid">
              <label>
                Supplier <b>*</b>
                <select
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  required
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Supplier invoice number
                <input
                  value={supplierInvoiceNumber}
                  onChange={(event) =>
                    setSupplierInvoiceNumber(event.target.value)
                  }
                  maxLength={100}
                  placeholder="Number from supplier bill"
                />
              </label>

              <label>
                Purchase date <b>*</b>
                <input
                  type="date"
                  value={purchaseDate}
                  max={today()}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  required
                />
              </label>

              <label>
                Invoice-level discount (₹)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceDiscount}
                  onChange={(event) => setInvoiceDiscount(event.target.value)}
                  required
                />
              </label>

              <label className="purchase-wide-field">
                Notes
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional purchase notes"
                />
              </label>
            </div>

            <div className="purchase-section-heading purchase-items-heading">
              <div>
                <h3>Purchase Items</h3>
                <p>
                  Select a product or create a new one without leaving this page.
                </p>
              </div>

              <button
                type="button"
                className="purchase-secondary-button"
                onClick={addLine}
              >
                + Add item
              </button>
            </div>

            {products.length === 0 && (
              <div className="purchase-alert purchase-error">
                No products are available yet. Use “Create New Product” below
                to add one to your catalogue.
              </div>
            )}

            <div className="purchase-items-list">
              {items.map((item, index) => {
                const product = products.find(
                  (entry) => String(entry.id) === String(item.productId)
                );
                const calc = calculations.items[index];

                return (
                  <div className="purchase-item-row" key={index}>
                    <div className="purchase-item-title">
                      <strong>Item {index + 1}</strong>
                      <button
                        type="button"
                        className="purchase-remove-button"
                        onClick={() => removeLine(index)}
                        disabled={items.length === 1}
                      >
                        Remove
                      </button>
                    </div>

                    <label className="purchase-product-field">
                      Product <b>*</b>
                      <select
                        value={item.productId}
                        onChange={(event) =>
                          selectProduct(index, event.target.value)
                        }
                        required
                      >
                        <option value="">Select product</option>

                        {products.map((entry) => {
                          const inactive =
                            entry.active === false ||
                            entry.isActive === false;

                          return (
                            <option
                              key={entry.id}
                              value={String(entry.id)}
                              disabled={inactive}
                            >
                              {entry.productCode
                                ? `${entry.productCode} — `
                                : ""}
                              {entry.name}
                              {inactive ? " (Inactive)" : ""}
                            </option>
                          );
                        })}
                      </select>

                      {product && (
                        <small>
                          Current purchase price:{" "}
                          {money(product.purchasePrice)}
                        </small>
                      )}

                      <button
                        type="button"
                        className="purchase-secondary-button purchase-create-product-button"
                        onClick={() => {
                          setError("");
                          setSuccess("");
                          setCreateProductForIndex(index);
                        }}
                      >
                        + Create New Product
                      </button>
                    </label>

                    <div className="purchase-line-fields">
                      <label>
                        Quantity
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(index, "quantity", event.target.value)
                          }
                          required
                        />
                      </label>

                      <label>
                        Rate (₹)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.purchaseRate}
                          onChange={(event) =>
                            updateItem(index, "purchaseRate", event.target.value)
                          }
                          required
                        />
                      </label>

                      <label>
                        Line discount (₹)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.discountAmount}
                          onChange={(event) =>
                            updateItem(
                              index,
                              "discountAmount",
                              event.target.value
                            )
                          }
                          required
                        />
                      </label>

                      <label>
                        GST (%)
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.gstRate}
                          onChange={(event) =>
                            updateItem(index, "gstRate", event.target.value)
                          }
                          required
                        />
                      </label>
                    </div>

                    <div className="purchase-line-total">
                      <span>Taxable: {money(calc.taxable)}</span>
                      <span>GST: {money(calc.gst)}</span>
                      <strong>Line total: {money(calc.total)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="purchase-bottom-grid">
              <div className="purchase-note">
                <strong>Draft purchase</strong>
                <p>
                  Saving records the purchase only. It does not increase
                  inventory or record a supplier payment.
                </p>
              </div>

              <div className="purchase-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>{money(calculations.subtotal)}</strong>
                </div>
                <div>
                  <span>Line discounts</span>
                  <strong>- {money(calculations.lineDiscounts)}</strong>
                </div>
                <div>
                  <span>Invoice discount</span>
                  <strong>- {money(calculations.invoiceDiscount)}</strong>
                </div>
                <div>
                  <span>GST</span>
                  <strong>{money(calculations.gstAmount)}</strong>
                </div>
                <div className="purchase-grand-total">
                  <span>Invoice total</span>
                  <strong>{money(calculations.totalAmount)}</strong>
                </div>
              </div>
            </div>

            <div className="purchase-form-actions">
              <button
                type="button"
                className="purchase-secondary-button"
                disabled={saving}
                onClick={resetForm}
              >
                Clear form
              </button>

              <button
                type="submit"
                className="purchase-primary-button"
                disabled={
                  saving || products.length === 0 || suppliers.length === 0
                }
              >
                {saving ? "Saving purchase..." : "Save Draft Purchase"}
              </button>
            </div>
          </form>

          <div className="purchase-card">
            <div className="purchase-section-heading">
              <div>
                <h3>Purchase History</h3>
                <p>Previously saved purchase records.</p>
              </div>
            </div>

            {purchases.length === 0 ? (
              <div className="purchase-empty-state">
                No purchases found. Your first saved purchase will appear here.
              </div>
            ) : (
              <div className="purchase-table-scroll">
                <table className="purchase-table">
                  <thead>
                    <tr>
                      <th>Purchase No.</th>
                      <th>Date</th>
                      <th>Supplier</th>
                      <th>Supplier Invoice</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((purchase) => (
                      <tr key={purchase.id}>
                        <td>
                          <strong>{purchase.purchaseNumber}</strong>
                        </td>
                        <td>{purchase.purchaseDate || "—"}</td>
                        <td>
                          {purchase.supplierName ||
                            `Supplier #${purchase.supplierId}`}
                        </td>
                        <td>{purchase.supplierInvoiceNumber || "—"}</td>
                        <td>
                          <span className="purchase-status">
                            {purchase.status}
                          </span>
                        </td>
                        <td>{money(purchase.totalAmount)}</td>
                        <td>
                          {purchase.status === "DRAFT" ? (
                            <button
                              type="button"
                              className="purchase-primary-button"
                              disabled={receivingId !== null}
                              onClick={() => handleReceivePurchase(purchase)}
                            >
                              {receivingId === purchase.id
                                ? "Receiving..."
                                : "Receive Purchase"}
                            </button>
                          ) : (
                            <div className="purchase-action-group">
                              <span>Received</span>
                              <button
                                type="button"
                                className="purchase-secondary-button"
                                onClick={() => openPaymentPanel(purchase)}
                              >
                                Payments
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {paymentPurchase && (
            <div className="purchase-card payment-panel">
              <div className="purchase-section-heading">
                <div>
                  <h3>Supplier Payments</h3>
                  <p>
                    {paymentPurchase.purchaseNumber} ·{" "}
                    {paymentPurchase.supplierName ||
                      `Supplier #${paymentPurchase.supplierId}`}
                  </p>
                </div>

                <button
                  type="button"
                  className="purchase-secondary-button"
                  onClick={() => {
                    setPaymentPurchase(null);
                    setPaymentBalance(null);
                    setPaymentHistory([]);
                    setPaymentError("");
                  }}
                >
                  Close
                </button>
              </div>

              {paymentLoading ? (
                <p>Loading payment details...</p>
              ) : (
                <>
                  {paymentError && (
                    <div
                      className="purchase-alert purchase-error"
                      role="alert"
                    >
                      {paymentError}
                    </div>
                  )}

                  {paymentBalance && (
                    <div className="payment-balance-grid">
                      <div>
                        <span>Purchase total</span>
                        <strong>{money(paymentBalance.purchaseTotal)}</strong>
                      </div>
                      <div>
                        <span>Total paid</span>
                        <strong>{money(paymentBalance.totalPaid)}</strong>
                      </div>
                      <div>
                        <span>Outstanding</span>
                        <strong>
                          {money(paymentBalance.outstandingBalance)}
                        </strong>
                      </div>
                    </div>
                  )}

                  <form
                    className="payment-form"
                    onSubmit={handleRecordPayment}
                  >
                    <h4>Record Supplier Payment</h4>

                    <div className="purchase-form-grid">
                      <label>
                        Payment date *
                        <input
                          type="date"
                          value={paymentDate}
                          max={today()}
                          onChange={(event) =>
                            setPaymentDate(event.target.value)
                          }
                          required
                        />
                      </label>

                      <label>
                        Amount (₹) *
                        <input
                          type="number"
                          min="0.01"
                          max={paymentBalance?.outstandingBalance ?? undefined}
                          step="0.01"
                          value={paymentAmount}
                          onChange={(event) =>
                            setPaymentAmount(event.target.value)
                          }
                          required
                        />
                      </label>

                      <label>
                        Payment method *
                        <select
                          value={paymentMethod}
                          onChange={(event) =>
                            setPaymentMethod(event.target.value)
                          }
                          required
                        >
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="BANK_TRANSFER">Bank transfer</option>
                          <option value="CHEQUE">Cheque</option>
                          <option value="CARD">Card</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </label>

                      <label>
                        Reference number
                        <input
                          value={paymentReference}
                          onChange={(event) =>
                            setPaymentReference(event.target.value)
                          }
                          maxLength={100}
                          placeholder="Transaction or cheque number"
                        />
                      </label>

                      <label className="purchase-wide-field">
                        Notes
                        <textarea
                          rows={2}
                          value={paymentNotes}
                          onChange={(event) =>
                            setPaymentNotes(event.target.value)
                          }
                          placeholder="Optional payment notes"
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="purchase-primary-button"
                      disabled={
                        paymentSaving ||
                        !paymentBalance ||
                        Number(paymentBalance.outstandingBalance) <= 0
                      }
                    >
                      {paymentSaving ? "Recording payment..." : "Record Payment"}
                    </button>
                  </form>

                  <div className="payment-history">
                    <h4>Payment History</h4>

                    {paymentHistory.length === 0 ? (
                      <p>No payments recorded for this purchase yet.</p>
                    ) : (
                      <div className="purchase-table-scroll">
                        <table className="purchase-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Amount</th>
                              <th>Method</th>
                              <th>Reference</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentHistory.map((payment) => (
                              <tr key={payment.id}>
                                <td>{payment.paymentDate}</td>
                                <td>{money(payment.amount)}</td>
                                <td>{payment.paymentMethod}</td>
                                <td>{payment.referenceNumber || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {createProductForIndex !== null && (
        <CreateProductForm
          categories={categories}
          units={units}
          onClose={() => setCreateProductForIndex(null)}
          onCreated={handleProductCreated}
        />
      )}
    </section>
  );
}

export default PurchasesPage;
