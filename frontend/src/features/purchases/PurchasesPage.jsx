
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
  updatePurchase,
  receivePurchase,
} from "../../services/api/purchaseApi";
import {
  getPurchasePayments,
  recordPurchasePayment,
  getPurchaseBalance,
} from "../../services/api/paymentApi";
import CreateProductForm from "./CreateProductForm";
import { createExpenseCategory, getExpenseCategories } from "../../services/api/expenseApi";
import "./PurchasesPage.css";
import { usePermission } from "../../auth/PermissionsContext";

const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const emptyLine = {
  productId: "",
  quantity: "1",
  secondaryQuantity: "",
  pricingUnit: "PRIMARY",
  purchaseRate: "0",
  discountAmount: "0",
};

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });

const round2 = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

function PurchasesPage() {
  const canManagePurchases = usePermission("PURCHASE_MANAGE");
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);

  const [supplierId, setSupplierId] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [invoiceDiscount, setInvoiceDiscount] = useState("0");
  const [taxType, setTaxType] = useState("INTRA");
  const [gstRate, setGstRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ ...emptyLine }]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [showExpenseCategoryForm, setShowExpenseCategoryForm] = useState(false);
  const [productSearches, setProductSearches] = useState({});
  const [activeProductSearchIndex, setActiveProductSearchIndex] = useState(null);

  const [createProductForIndex, setCreateProductForIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receivingId, setReceivingId] = useState(null);
  const [purchaseToReceive, setPurchaseToReceive] = useState(null);
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
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [detailsPurchase, setDetailsPurchase] = useState(null);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseStatus, setPurchaseStatus] = useState("ALL");
  const [purchaseDateFilter, setPurchaseDateFilter] = useState("ALL");
  const [purchasePage, setPurchasePage] = useState(1);

  const PAGE_SIZE = 10;

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
        expenseCategoryData,
      ] = await Promise.all([
        getSuppliers(),
        getProducts(),
        getPurchases(),
        getCategories(),
        getMeasurementUnits(),
        getExpenseCategories(),
      ]);

      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setProducts(Array.isArray(productData) ? productData : []);
      setPurchases(Array.isArray(purchaseData) ? purchaseData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setUnits(Array.isArray(unitData) ? unitData : []);
      setExpenseCategories(Array.isArray(expenseCategoryData) ? expenseCategoryData : []);
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
    const invoiceGstRate = Number(gstRate);

    const lines = items.map((item) => {
      const quantity = Number(item.quantity);
      const secondaryQuantity = Number(item.secondaryQuantity);
      const rate = Number(item.purchaseRate);
      const discount = Number(item.discountAmount);

      const billableQuantity = item.pricingUnit === "SECONDARY"
        ? secondaryQuantity : quantity;
      const gross =
        billableQuantity > 0 && rate >= 0 ? round2(billableQuantity * rate) : 0;

      const safeDiscount =
        discount >= 0 && discount <= gross ? discount : 0;

      const taxable = round2(gross - safeDiscount);

      subtotal += gross;
      lineDiscounts += safeDiscount;

      return { item, gross, taxable };
    });

    const extraDiscount = round2(Math.max(0, Number(invoiceDiscount) || 0));

    // Match the backend: spread the invoice discount across lines by taxable
    // value (the largest line takes the rounding remainder), then charge GST
    // on the discounted value.
    const taxableTotal = lines.reduce((sum, line) => sum + line.taxable, 0);
    const lineInvoiceDiscounts = lines.map((line) =>
      taxableTotal > 0 ? round2((extraDiscount * line.taxable) / taxableTotal) : 0
    );
    if (lines.length > 0) {
      const largestLine = lines.reduce(
        (largest, line, index) =>
          line.taxable > lines[largest].taxable ? index : largest,
        0
      );
      const allocated = lineInvoiceDiscounts.reduce((sum, value) => sum + value, 0);
      lineInvoiceDiscounts[largestLine] = round2(
        lineInvoiceDiscounts[largestLine] + extraDiscount - allocated
      );
    }

    const calculatedItems = lines.map(({ item, gross, taxable }, index) => {
      const discountedTaxable = round2(taxable - lineInvoiceDiscounts[index]);
      const gst = round2((discountedTaxable * invoiceGstRate) / 100);
      const total = round2(discountedTaxable + gst);

      gstAmount += gst;

      return { ...item, gross, taxable, gst, total };
    });

    const expensesTotal = expenses.reduce(
      (sum, expense) => sum + (Number(expense.amount) || 0), 0
    );
    const expensesGst = round2(expensesTotal * Number(gstRate || 0) / 100);
    const totalGst = round2(gstAmount + expensesGst);

    return {
      items: calculatedItems,
      subtotal: round2(subtotal),
      lineDiscounts: round2(lineDiscounts),
      invoiceDiscount: round2(extraDiscount),
      totalDiscount: round2(lineDiscounts + extraDiscount),
      cgstAmount: taxType === "INTRA" ? round2(totalGst / 2) : 0,
      sgstAmount: taxType === "INTRA" ? round2(totalGst - round2(totalGst / 2)) : 0,
      igstAmount: taxType === "IGST" ? round2(totalGst) : 0,
      gstAmount: totalGst,
      expensesGst,
      expensesTotal: round2(expensesTotal),
      totalAmount: round2(
        subtotal - lineDiscounts - extraDiscount + totalGst + expensesTotal
      ),
    };
  }, [expenses, gstRate, invoiceDiscount, items, taxType]);

  const filteredPurchases = useMemo(() => {
    const term = purchaseSearch.trim().toLowerCase();
    const now = new Date();
    return purchases.filter((purchase) => {
      const matchesSearch = !term || [
        purchase.purchaseNumber,
        purchase.supplierName,
        purchase.supplierInvoiceNumber,
      ].some((value) => String(value || "").toLowerCase().includes(term));
      const matchesStatus = purchaseStatus === "ALL"
        || purchase.status === purchaseStatus;
      let matchesDate = true;
      if (purchaseDateFilter !== "ALL" && purchase.purchaseDate) {
        const purchaseDateValue = new Date(`${purchase.purchaseDate}T00:00:00`);
        const days = purchaseDateFilter === "TODAY"
          ? 1 : purchaseDateFilter === "WEEK" ? 7 : 30;
        matchesDate = (now - purchaseDateValue) / 86400000 < days;
      }
      return matchesSearch && matchesStatus && matchesDate;
    }).sort((first, second) =>
      String(second.purchaseDate || "").localeCompare(
        String(first.purchaseDate || "")
      )
    );
  }, [purchaseDateFilter, purchaseSearch, purchaseStatus, purchases]);

  const purchasePageCount = Math.max(
    1,
    Math.ceil(filteredPurchases.length / PAGE_SIZE)
  );
  const visiblePurchases = filteredPurchases.slice(
    (purchasePage - 1) * PAGE_SIZE,
    purchasePage * PAGE_SIZE
  );
  const receivedPurchases = purchases.filter(
    (purchase) => purchase.status === "RECEIVED"
  );
  const draftPurchases = purchases.filter(
    (purchase) => purchase.status === "DRAFT"
  );
  const purchaseValue = purchases.reduce(
    (total, purchase) => total + Number(purchase.totalAmount || 0),
    0
  );
  const purchaseTax = purchases.reduce(
    (total, purchase) => total + Number(purchase.gstAmount || 0),
    0
  );

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
            }
          : item
      )
    );
  }

  function productLabel(product) {
    return `${product.productCode ? `${product.productCode} — ` : ""}${product.name}`;
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
    setTaxType("INTRA");
    setGstRate("0");
    setNotes("");
    setItems([{ ...emptyLine }]);
    setExpenses([]);
    setProductSearches({});
    setActiveProductSearchIndex(null);
    setError("");
  }

  function openCreatePurchaseForm() {
    setEditingPurchaseId(null);
    resetForm();
    setShowPurchaseForm(true);
  }

  function openEditPurchaseForm(purchase) {
    if (purchase.status !== "DRAFT") return;

    setEditingPurchaseId(purchase.id);
    setSupplierId(String(purchase.supplierId));
    setSupplierInvoiceNumber(purchase.supplierInvoiceNumber || "");
    setPurchaseDate(purchase.purchaseDate || today());
    setInvoiceDiscount(
      String(
        Math.max(
          0,
          Number(purchase.discountAmount || 0) -
            (purchase.items || []).reduce(
              (total, item) => total + Number(item.discountAmount || 0),
              0
            )
        )
      )
    );
    setTaxType(purchase.taxType || "INTRA");
    setGstRate(String(purchase.gstRate ?? purchase.items?.[0]?.gstRate ?? 0));
    setExpenses((purchase.expenses || []).map((expense) => ({
      categoryId: String(expense.categoryId),
      description: expense.description || "",
      amount: String(expense.amount ?? ""),
    })));
    setNotes(purchase.notes || "");
    setItems(
      (purchase.items || []).map((item) => ({
        productId: String(item.productId),
        quantity: String(item.quantity ?? ""),
        secondaryQuantity: String(item.secondaryQuantity ?? ""),
        pricingUnit: item.pricingUnit || "PRIMARY",
        purchaseRate: String(item.purchaseRate ?? ""),
        discountAmount: String(item.discountAmount ?? "0"),
      }))
    );
    setDetailsPurchase(null);
    setError("");
    setSuccess("");
    setShowPurchaseForm(true);
  }

  function addPurchaseExpense() {
    setExpenses((current) => [
      ...current,
      { categoryId: "", description: "", amount: "" },
    ]);
  }

  function updatePurchaseExpense(index, field, value) {
    setExpenses((current) => current.map((expense, expenseIndex) =>
      expenseIndex === index ? { ...expense, [field]: value } : expense
    ));
  }

  function removePurchaseExpense(index) {
    setExpenses((current) => current.filter((_, expenseIndex) => expenseIndex !== index));
  }

  async function addPurchaseExpenseCategory() {
    const name = newExpenseCategory.trim();
    if (!name) {
      setError("Enter an expense category name first.");
      return;
    }
    try {
      const created = await createExpenseCategory({
        name,
        categoryType: "OPERATING",
      });
      setExpenseCategories((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setExpenses((current) => current.map((expense, index) =>
        index === current.length - 1
          ? { ...expense, categoryId: String(created.id), description: created.name }
          : expense
      ));
      setNewExpenseCategory("");
      setShowExpenseCategoryForm(false);
    } catch (err) {
      setError(err.message || "Unable to create expense category.");
    }
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
          !Number.isFinite(Number(gstRate)) ||
          Number(gstRate) < 0 ||
          Number(gstRate) > 100
      )
    ) {
      setError("Check quantity, purchase rate, discount, and GST values.");
      return;
    }

    if (
      items.some(
        (item) =>
          item.pricingUnit === "SECONDARY" &&
          (!Number.isFinite(Number(item.secondaryQuantity)) ||
            Number(item.secondaryQuantity) <= 0)
      )
    ) {
      setError("Enter the secondary quantity for lines priced per secondary unit.");
      return;
    }

    if (expenses.some(
      (expense) =>
        !expense.categoryId ||
        !Number.isFinite(Number(expense.amount)) ||
        Number(expense.amount) <= 0
    )) {
      setError("Select an expense category and enter a positive amount for every charge.");
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
      taxType,
      gstRate: Number(gstRate),
      expenses: expenses.map((expense) => ({
        categoryId: Number(expense.categoryId),
        description: expense.description.trim() || null,
        amount: Number(expense.amount),
      })),
      notes: notes.trim() || null,
      items: items.map((item) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        secondaryQuantity: item.secondaryQuantity === "" ? null : Number(item.secondaryQuantity),
        pricingUnit: item.pricingUnit || "PRIMARY",
        purchaseRate: Number(item.purchaseRate),
        discountAmount: Number(item.discountAmount),
      })),
    };

    setSaving(true);

    try {
      const saved = editingPurchaseId
        ? await updatePurchase(editingPurchaseId, payload)
        : await createPurchase(payload);

      setSuccess(
        `Purchase ${saved.purchaseNumber || `#${saved.id}`} ${
          editingPurchaseId ? "updated" : "saved"
        } as ${saved.status || "DRAFT"}. Stock has not been changed.`
      );

      resetForm();
      setEditingPurchaseId(null);
      await loadData();
      setShowPurchaseForm(false);
    } catch (err) {
      setError(err.message || "Unable to save purchase.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReceivePurchase(purchase) {
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

        {canManagePurchases && <button
          type="button"
          className="purchase-primary-button"
          onClick={openCreatePurchaseForm}
        >
          + Create Purchase
        </button>}
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

      <div className="purchase-kpi-grid">
        <div className="purchase-kpi-card is-blue"><span>Total purchase value</span><strong>{money(purchaseValue)}</strong><small>All saved purchase records</small></div>
        <div className="purchase-kpi-card is-amber"><span>Draft purchases</span><strong>{draftPurchases.length}</strong><small>Awaiting receipt</small></div>
        <div className="purchase-kpi-card is-green"><span>Received purchases</span><strong>{receivedPurchases.length}</strong><small>Stock added to inventory</small></div>
        <div className="purchase-kpi-card is-purple"><span>Total GST</span><strong>{money(purchaseTax)}</strong><small>Recorded input tax</small></div>
      </div>

      {loading ? (
        <div className="purchase-card">
          Loading suppliers, products, categories, units, and purchases...
        </div>
      ) : (
        <>
          {showPurchaseForm && <div className="purchase-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setShowPurchaseForm(false)}>
          <form className="purchase-card purchase-modal purchase-create-modal" onSubmit={handleSubmit}>
            <div className="purchase-section-heading">
              <div>
                <h3>{editingPurchaseId ? "Edit Draft Purchase" : "New Purchase"}</h3>
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

              <label>
                Tax type <b>*</b>
                <select
                  value={taxType}
                  onChange={(event) => setTaxType(event.target.value)}
                  required
                >
                  <option value="INTRA">CGST + SGST (Intra-state)</option>
                  <option value="IGST">IGST (Inter-state)</option>
                </select>
              </label>

              <label>
                GST rate (%) <b>*</b>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={gstRate}
                  onChange={(event) => setGstRate(event.target.value)}
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

              {canManagePurchases && <button
                type="button"
                className="purchase-secondary-button"
                onClick={addLine}
              >
                + Add item
              </button>}
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
                      {canManagePurchases && <button
                        type="button"
                        className="purchase-remove-button"
                        onClick={() => removeLine(index)}
                        disabled={items.length === 1}
                      >
                        Remove
                      </button>}
                    </div>

                    <label className="purchase-product-field">
                      <span>Product <b>*</b></span>
                      <input
                        type="text"
                        value={
                          productSearches[index] ??
                          (product ? productLabel(product) : "")
                        }
                        onFocus={() => setActiveProductSearchIndex(index)}
                        onChange={(event) =>
                          setProductSearches((current) => ({
                              ...current,
                              [index]: event.target.value,
                            }))
                        }
                        onBlur={() =>
                          window.setTimeout(() => {
                            setActiveProductSearchIndex((current) =>
                              current === index ? null : current
                            );
                          }, 120)
                        }
                        placeholder="Search product name or code..."
                        aria-label={`Search product for item ${index + 1}`}
                      />
                      {activeProductSearchIndex === index && <div
                        className="purchase-product-results"
                        role="listbox"
                        aria-label={`Matching products for item ${index + 1}`}
                      >
                        {products
                          .filter((entry) => {
                            const search = String(productSearches[index] || "")
                              .trim()
                              .toLowerCase();
                            return !search || [entry.name, entry.productCode]
                              .some((value) =>
                                String(value || "").toLowerCase().includes(search)
                              );
                          })
                          .slice(0, 30)
                          .map((entry) => {
                            const inactive =
                              entry.active === false ||
                              entry.isActive === false;

                            return (
                              <button
                                key={entry.id}
                                type="button"
                                className="purchase-product-option"
                                disabled={inactive}
                                role="option"
                                aria-selected={String(entry.id) === String(item.productId)}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  selectProduct(index, String(entry.id));
                                  setProductSearches((current) => ({
                                    ...current,
                                    [index]: productLabel(entry),
                                  }));
                                  setActiveProductSearchIndex(null);
                                }}
                              >
                                <strong>{productLabel(entry)}</strong>
                                <small>
                                  {inactive
                                    ? "Inactive"
                                    : `Purchase price: ${money(entry.purchasePrice)}`}
                                </small>
                              </button>
                            );
                          })}
                        {products.filter((entry) => {
                          const search = String(productSearches[index] || "")
                            .trim()
                            .toLowerCase();
                          return !search || [entry.name, entry.productCode]
                            .some((value) =>
                              String(value || "").toLowerCase().includes(search)
                            );
                        }).length === 0 && (
                          <p className="purchase-product-no-results">
                            No matching products found.
                          </p>
                        )}
                      </div>}

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
                      {product?.secondaryUnitId && <label>
                        {units.find((unit) => Number(unit.id) === Number(product.secondaryUnitId))?.code || "Secondary quantity"}
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={item.secondaryQuantity}
                          onChange={(event) => updateItem(index, "secondaryQuantity", event.target.value)}
                          required
                        />
                      </label>}
                      <label>
                        Price basis
                        <select value={item.pricingUnit} onChange={(event) => updateItem(index, "pricingUnit", event.target.value)}>
                          <option value="PRIMARY">Primary unit</option>
                          {product?.secondaryUnitId && <option value="SECONDARY">Secondary unit</option>}
                        </select>
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

                    </div>

                    <div className="purchase-line-total">
                      <span>Taxable: {money(calc.taxable)}</span>
                      <strong>Line total: {money(calc.total)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            {canManagePurchases && (
              <div className="purchase-add-item-footer">
                <button
                  type="button"
                  className="purchase-secondary-button"
                  onClick={addLine}
                >
                  + Add another item
                </button>
              </div>
            )}

            <div className="purchase-section-heading purchase-items-heading">
              <div>
                <h3>Additional purchase charges</h3>
                <p>Record labour, transport, loading, or other supplier-side costs.</p>
              </div>
              {canManagePurchases && <button type="button" className="purchase-secondary-button" onClick={addPurchaseExpense}>+ Add charge</button>}
            </div>
            {expenses.length > 0 && <div className="purchase-expenses-list">
              {expenses.map((expense, index) => (
                <div className="purchase-expense-row" key={`${index}-${expense.categoryId}`}>
                  <select value={expense.categoryId} onChange={(event) => {
                    const selected = expenseCategories.find((category) => String(category.id) === event.target.value);
                    updatePurchaseExpense(index, "categoryId", event.target.value);
                    if (selected && !expense.description) updatePurchaseExpense(index, "description", selected.name);
                  }} required>
                    <option value="">Select charge category</option>
                    {expenseCategories.filter((category) => category.active !== false && category.isActive !== false).map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                  <input value={expense.description} onChange={(event) => updatePurchaseExpense(index, "description", event.target.value)} placeholder="Description (optional)" maxLength={100} />
                  <input type="number" min="0.01" step="0.01" value={expense.amount} onChange={(event) => updatePurchaseExpense(index, "amount", event.target.value)} placeholder="Amount" required />
                  <button type="button" className="purchase-icon-button" onClick={() => removePurchaseExpense(index)} aria-label="Remove charge">×</button>
                </div>
              ))}
              <div className="purchase-inline-category">
                <button type="button" className="purchase-secondary-button" onClick={() => setShowExpenseCategoryForm((current) => !current)}>+ Add charge category</button>
                {showExpenseCategoryForm && <div className="purchase-reference-creator"><input value={newExpenseCategory} onChange={(event) => setNewExpenseCategory(event.target.value)} placeholder="New expense category" maxLength={100} /><button type="button" className="purchase-secondary-button" onClick={addPurchaseExpenseCategory}>Create</button></div>}
              </div>
            </div>}

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
                  <span>CGST</span>
                  <strong>{money(calculations.cgstAmount)}</strong>
                </div>
                <div>
                  <span>SGST</span>
                  <strong>{money(calculations.sgstAmount)}</strong>
                </div>
                <div>
                  <span>IGST</span>
                  <strong>{money(calculations.igstAmount)}</strong>
                </div>
                <div>
                  <span>Total GST</span>
                  <strong>{money(calculations.gstAmount)}</strong>
                </div>
                <div>
                  <span>Additional charges (including GST)</span>
                  <strong>{money(calculations.expensesTotal + calculations.expensesGst)}</strong>
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
          </div>}

          <div className="purchase-card">
            <div className="purchase-section-heading">
              <div>
                <h3>Purchase directory</h3>
                <p>Search, receive, and review supplier purchases.</p>
              </div>
            </div>

            <div className="purchase-filters">
              <input
                type="search"
                placeholder="Search purchase, supplier, invoice..."
                aria-label="Search purchases"
                value={purchaseSearch}
                onChange={(event) => {
                  setPurchaseSearch(event.target.value);
                  setPurchasePage(1);
                }}
              />
              <select value={purchaseStatus} aria-label="Filter purchase status" onChange={(event) => { setPurchaseStatus(event.target.value); setPurchasePage(1); }}>
                <option value="ALL">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="RECEIVED">Received</option>
              </select>
              <select value={purchaseDateFilter} aria-label="Filter purchase date" onChange={(event) => { setPurchaseDateFilter(event.target.value); setPurchasePage(1); }}>
                <option value="ALL">All dates</option>
                <option value="TODAY">Today</option>
                <option value="WEEK">Last 7 days</option>
                <option value="MONTH">Last 30 days</option>
              </select>
              <button type="button" className="purchase-secondary-button" onClick={() => { setPurchaseSearch(""); setPurchaseStatus("ALL"); setPurchaseDateFilter("ALL"); setPurchasePage(1); }}>Clear</button>
            </div>

            {visiblePurchases.length === 0 ? (
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
                    {visiblePurchases.map((purchase) => (
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
                          <div className="purchase-action-group">
                            <button type="button" className="purchase-secondary-button" onClick={() => setDetailsPurchase(purchase)}>View</button>
                            {canManagePurchases && purchase.status === "DRAFT" ? (
                              <>
                                <button type="button" className="purchase-secondary-button" onClick={() => openEditPurchaseForm(purchase)}>
                                  Edit
                                </button>
                                <button type="button" className="purchase-primary-button" disabled={receivingId !== null} onClick={() => setPurchaseToReceive(purchase)}>
                                  {receivingId === purchase.id ? "Receiving..." : "Receive"}
                                </button>
                              </>
                            ) : canManagePurchases ? (
                              <button type="button" className="purchase-secondary-button" onClick={() => openPaymentPanel(purchase)}>Payments</button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="purchase-pagination">
              <span>Showing {filteredPurchases.length ? (purchasePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(purchasePage * PAGE_SIZE, filteredPurchases.length)} of {filteredPurchases.length}</span>
              <div><button type="button" disabled={purchasePage <= 1} onClick={() => setPurchasePage((current) => current - 1)}>Previous</button><strong>Page {purchasePage} of {purchasePageCount}</strong><button type="button" disabled={purchasePage >= purchasePageCount} onClick={() => setPurchasePage((current) => current + 1)}>Next</button></div>
            </div>
          </div>

          {paymentPurchase && (
            <div className="purchase-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPaymentPurchase(null)}>
            <div className="purchase-card payment-panel purchase-modal">
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
            </div>
          )}
        </>
      )}

      {detailsPurchase && (
        <div className="purchase-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetailsPurchase(null)}>
          <section className="purchase-modal purchase-details-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-details-title">
            <div className="purchase-section-heading">
              <div><p className="purchases-eyebrow">PURCHASE DETAILS</p><h2 id="purchase-details-title">{detailsPurchase.purchaseNumber}</h2><p>{detailsPurchase.supplierName || `Supplier #${detailsPurchase.supplierId}`} · {detailsPurchase.purchaseDate}</p></div>
              <button type="button" className="purchase-secondary-button" onClick={() => setDetailsPurchase(null)}>Close</button>
            </div>
            <div className="purchase-detail-grid">
              <div><span>Status</span><strong>{detailsPurchase.status}</strong></div>
              <div><span>Supplier invoice</span><strong>{detailsPurchase.supplierInvoiceNumber || "—"}</strong></div>
              <div><span>Subtotal</span><strong>{money(detailsPurchase.subtotal)}</strong></div>
              <div><span>Discount</span><strong>{money(detailsPurchase.discountAmount)}</strong></div>
              <div><span>Tax type</span><strong>{detailsPurchase.taxType === "IGST" ? "IGST" : "CGST + SGST"}</strong></div>
              <div><span>CGST</span><strong>{money(detailsPurchase.cgstAmount)}</strong></div>
              <div><span>SGST</span><strong>{money(detailsPurchase.sgstAmount)}</strong></div>
              <div><span>IGST</span><strong>{money(detailsPurchase.igstAmount)}</strong></div>
               <div><span>Total GST</span><strong>{money(detailsPurchase.gstAmount)}</strong></div>
               <div><span>Additional charges (including GST)</span><strong>{money(
                 (detailsPurchase.expensesTotal
                   || detailsPurchase.expenses?.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
                   || 0) + Number(detailsPurchase.expenseGstAmount || 0)
               )}</strong></div>
              <div><span>Total</span><strong>{money(detailsPurchase.totalAmount)}</strong></div>
            </div>
            <div className="purchase-detail-items">
              <h3>Items</h3>
              {detailsPurchase.items?.map((item) => <div className="purchase-detail-item" key={item.id}><span>{item.productName}<small>{item.productCode}</small></span><span>{item.quantity} × {money(item.purchaseRate)}</span><strong>{money(item.lineTotal)}</strong></div>)}
              {detailsPurchase.expenses?.map((expense) => <div className="purchase-detail-item" key={`expense-${expense.id}`}><span>{expense.description}</span><strong>{money(expense.amount)}</strong></div>)}
            </div>
            <div className="purchase-form-actions">
              {canManagePurchases && detailsPurchase.status === "DRAFT" && <><button type="button" className="purchase-secondary-button" onClick={() => openEditPurchaseForm(detailsPurchase)}>Edit purchase</button><button type="button" className="purchase-primary-button" onClick={() => { setDetailsPurchase(null); setPurchaseToReceive(detailsPurchase); }}>Receive purchase</button></>}
              {canManagePurchases && detailsPurchase.status === "RECEIVED" && <button type="button" className="purchase-secondary-button" onClick={() => { setDetailsPurchase(null); openPaymentPanel(detailsPurchase); }}>Open payments</button>}
            </div>
          </section>
        </div>
      )}

      {createProductForIndex !== null && (
        <CreateProductForm
          categories={categories}
          units={units}
          onClose={() => setCreateProductForIndex(null)}
          onCreated={handleProductCreated}
        />
      )}

      {purchaseToReceive && (
        <div
          className="purchase-modal-backdrop purchase-confirm-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && receivingId === null) {
              setPurchaseToReceive(null);
            }
          }}
        >
          <section
            className="purchase-modal purchase-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receive-purchase-title"
          >
            <div className="purchase-confirm-icon" aria-hidden="true">!</div>
            <div>
              <p className="purchases-eyebrow">RECEIVE PURCHASE</p>
              <h2 id="receive-purchase-title">Add purchase to inventory?</h2>
              <p className="purchase-confirm-message">
                Receive <strong>{purchaseToReceive.purchaseNumber}</strong> and add
                its quantities to inventory?
              </p>
              <p className="purchase-confirm-note">
                This action updates stock and cannot be repeated for the same purchase.
              </p>
            </div>
            <div className="purchase-form-actions purchase-confirm-actions">
              <button
                type="button"
                className="purchase-secondary-button"
                disabled={receivingId !== null}
                onClick={() => setPurchaseToReceive(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="purchase-primary-button"
                disabled={receivingId !== null}
                onClick={() => {
                  const purchase = purchaseToReceive;
                  setPurchaseToReceive(null);
                  handleReceivePurchase(purchase);
                }}
              >
                {receivingId !== null ? "Receiving..." : "Receive purchase"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default PurchasesPage;
