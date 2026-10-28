
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
  changePurchasePaymentMethod,
  recordPurchasePayment,
  getPurchaseBalance,
} from "../../services/api/paymentApi";
import CreateProductForm from "./CreateProductForm";
import { createExpenseCategory, getExpenseCategories } from "../../services/api/expenseApi";
import "./PurchasesPage.css";
import { usePermission } from "../../auth/PermissionsContext";
import SearchSelect from "../../components/SearchSelect";
import { formatDate, label, paymentBadgeClass } from "../../utils/format";
import { newRequestId } from "../../utils/requestId";
import { backdateWarning } from "../../utils/backdate";
import ChangeMethodDialog from "../../components/ChangeMethodDialog";
import { t } from "../../i18n";
import Skeleton from "../../components/Skeleton";

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
  const canFixPayments = usePermission("CASH_APPROVE");
  const [paymentRequestId, setPaymentRequestId] = useState(null);
  const [fixingPayment, setFixingPayment] = useState(null);
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
      setError(err.message || t("Unable to load purchase data."));
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
  const monthKey = today().slice(0, 7);
  const monthPurchases = receivedPurchases.filter((purchase) =>
    String(purchase.purchaseDate || "").startsWith(monthKey)
  );
  const monthPurchaseValue = monthPurchases.reduce(
    (total, purchase) => total + Number(purchase.totalAmount || 0),
    0
  );
  const unpaidPurchases = receivedPurchases.filter(
    (purchase) => Number(purchase.balanceDue || 0) > 0
  );
  const toPaySuppliers = unpaidPurchases.reduce(
    (total, purchase) => total + Number(purchase.balanceDue || 0),
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
      setError(t("Product not found. Refresh the page and try again."));
      return;
    }

    if (product.active === false || product.isActive === false) {
      setError(t("This product is inactive and cannot be added to a purchase."));
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
      setError(t("Enter an expense category name first."));
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
      setError(err.message || t("Unable to create expense category."));
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
          ? t("\"{name}\" was created with zero stock and selected for this purchase.", { name: createdProduct.name })
          : t("\"{name}\" was created and selected with zero stock. Inventory tracking settings need attention. Do not create the product again.", { name: createdProduct.name })
      );
    } catch (err) {
      // The creation request may already have succeeded. Avoid creating it twice.
      setError(
        t("The product may already have been created. Refresh the page before retrying. {error}", { error: err.message || "" })
      );
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!supplierId) {
      setError(t("Please select a supplier."));
      return;
    }

    if (!purchaseDate || purchaseDate > today()) {
      setError(t("Select a valid purchase date that is not in the future."));
      return;
    }

    if (items.some((item) => !item.productId)) {
      setError(t("Please select a product for every purchase line."));
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
      setError(t("Check quantity, purchase rate, discount, and GST values."));
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
      setError(t("Enter the secondary quantity for lines priced per secondary unit."));
      return;
    }

    if (expenses.some(
      (expense) =>
        !expense.categoryId ||
        !Number.isFinite(Number(expense.amount)) ||
        Number(expense.amount) <= 0
    )) {
      setError(t("Select an expense category and enter a positive amount for every charge."));
      return;
    }

    if (
      calculations.items.some(
        (item) => Number(item.discountAmount) > item.gross
      )
    ) {
      setError(t("A line discount cannot exceed that line's gross amount."));
      return;
    }

    if (
      !Number.isFinite(Number(invoiceDiscount)) ||
      Number(invoiceDiscount) < 0 ||
      Number(invoiceDiscount) >
        calculations.subtotal - calculations.lineDiscounts
    ) {
      setError(
        t("Invoice discount is invalid or exceeds the remaining subtotal.")
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
        editingPurchaseId
          ? t("Purchase {number} updated as {status}. Stock has not been changed.", { number: saved.purchaseNumber || `#${saved.id}`, status: saved.status || "DRAFT" })
          : t("Purchase {number} saved as {status}. Stock has not been changed.", { number: saved.purchaseNumber || `#${saved.id}`, status: saved.status || "DRAFT" })
      );

      resetForm();
      setEditingPurchaseId(null);
      await loadData();
      setShowPurchaseForm(false);
    } catch (err) {
      setError(err.message || t("Unable to save purchase."));
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
        t("Purchase {number} received successfully. Inventory stock has been updated.", { number: received.purchaseNumber })
      );

      await loadData();
    } catch (err) {
      setError(err.message || t("Unable to receive purchase."));
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
    setPaymentRequestId(newRequestId());
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
      setPaymentError(err.message || t("Unable to load payment details."));
    } finally {
      setPaymentLoading(false);
    }
  }

  async function fixPaymentMethod(method, reason) {
    await changePurchasePaymentMethod(paymentPurchase.id, fixingPayment.id, method, reason);
    setFixingPayment(null);
    const history = await getPurchasePayments(paymentPurchase.id);
    setPaymentHistory(Array.isArray(history) ? history : []);
    setSuccess(t("Payment method changed."));
  }

  async function handleRecordPayment(event) {
    event.preventDefault();
    if (!paymentPurchase) return;

    setPaymentError("");

    const amount = Number(paymentAmount);

    if (!paymentDate || paymentDate > today()) {
      setPaymentError(t("Select a valid payment date."));
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError(t("Enter a payment amount greater than zero."));
      return;
    }

    if (!paymentMethod) {
      setPaymentError(t("Select a payment method."));
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
        requestId: paymentRequestId,
      });
      setPaymentRequestId(newRequestId());

      const [balance, history] = await Promise.all([
        getPurchaseBalance(paymentPurchase.id),
        getPurchasePayments(paymentPurchase.id),
      ]);

      setPaymentBalance(balance);
      setPaymentHistory(Array.isArray(history) ? history : []);
      // Update this bill's row so its Paid / Part-paid badge is current.
      const paid = Number(balance?.totalPaid || 0);
      const due = Number(balance?.outstandingBalance || 0);
      setPurchases((current) => current.map((purchase) =>
        purchase.id === paymentPurchase.id
          ? {
            ...purchase,
            amountPaid: paid,
            balanceDue: due,
            paymentStatus: due <= 0 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "UNPAID",
          }
          : purchase
      ));
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
      setSuccess(t("Supplier payment recorded successfully."));
    } catch (err) {
      setPaymentError(err.message || t("Unable to record supplier payment."));
    } finally {
      setPaymentSaving(false);
    }
  }

  return (
    <section className="purchases-page">
      {fixingPayment && <ChangeMethodDialog payment={fixingPayment} onSave={fixPaymentMethod} onClose={() => setFixingPayment(null)} />}
      <div className="purchases-heading">
        <p className="purchases-subtitle">
          {t("Enter supplier bills, add the stock when it arrives, and pay suppliers.")}
        </p>

        {canManagePurchases && <button
          type="button"
          className="purchase-primary-button"
          onClick={openCreatePurchaseForm}
        >
          {t("+ New purchase")}
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
        <div className="purchase-kpi-card is-blue"><span>{t("Bought this month")}</span><strong>{money(monthPurchaseValue)}</strong><small>{monthPurchases.length === 1 ? t("{count} received bill", { count: monthPurchases.length }) : t("{count} received bills", { count: monthPurchases.length })}</small></div>
        <div className="purchase-kpi-card is-amber"><span>{t("You owe suppliers")}</span><strong>{money(toPaySuppliers)}</strong><small>{unpaidPurchases.length === 1 ? t("{count} bill not fully paid", { count: unpaidPurchases.length }) : t("{count} bills not fully paid", { count: unpaidPurchases.length })}</small></div>
        <div className="purchase-kpi-card is-green"><span>{t("Waiting to arrive")}</span><strong>{draftPurchases.length}</strong><small>{t("Drafts not yet added to stock")}</small></div>
      </div>

      {loading ? (
        <div className="purchase-card">
          <Skeleton label={t("Loading suppliers, products, categories, units, and purchases...")} rows={6} />
        </div>
      ) : (
        <>
          {showPurchaseForm && <div className="purchase-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setShowPurchaseForm(false)}>
          <form className="purchase-card purchase-modal purchase-create-modal" onSubmit={handleSubmit}>
            <div className="purchase-section-heading">
              <div>
                <h3>{editingPurchaseId ? t("Edit purchase") : t("New purchase")}</h3>
                <p>
                  {t("Copy the details from the supplier's bill.")}
                </p>
              </div>
              <button type="button" className="purchase-secondary-button" disabled={saving} onClick={() => setShowPurchaseForm(false)}>{t("Close")}</button>
            </div>

            <div className="purchase-form-grid">
              <label>
                {t("Supplier")} <b>*</b>
                <SearchSelect
                  options={suppliers.map((supplier) => ({
                    value: supplier.id,
                    label: supplier.name,
                    hint: supplier.phone || "",
                  }))}
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder={t("Search supplier by name")}
                  required
                />
              </label>

              <label className="field-half">
                {t("Supplier invoice number")}
                <input
                  value={supplierInvoiceNumber}
                  onChange={(event) =>
                    setSupplierInvoiceNumber(event.target.value)
                  }
                  maxLength={100}
                  placeholder={t("Number from supplier bill")}
                />
              </label>

              <label className="field-half">
                {t("Purchase date")} <b>*</b>
                <input
                  type="date"
                  value={purchaseDate}
                  max={today()}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  required
                />
              </label>

              <label>
                {t("Supplier location")} <b>*</b>
                <select
                  value={taxType}
                  onChange={(event) => setTaxType(event.target.value)}
                  required
                >
                  <option value="INTRA">{t("Same state as us (CGST + SGST)")}</option>
                  <option value="IGST">{t("Other state (IGST)")}</option>
                </select>
              </label>

              <label className="purchase-wide-field">
                {t("Notes")}
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t("Optional purchase notes")}
                />
              </label>
            </div>

            <div className="purchase-section-heading purchase-items-heading">
              <div>
                <h3>{t("Items on the bill")}</h3>
                <p>
                  {t("Select a product or create a new one without leaving this page.")}
                </p>
              </div>

              {canManagePurchases && <button
                type="button"
                className="purchase-secondary-button"
                onClick={addLine}
              >
                {t("+ Add item")}
              </button>}
            </div>

            {products.length === 0 && (
              <div className="purchase-alert purchase-error">
                {t("No products are available yet. Use “Create New Product” below to add one to your catalogue.")}
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
                      <strong>{t("Item {number}", { number: index + 1 })}</strong>
                      {canManagePurchases && <button
                        type="button"
                        className="purchase-remove-button"
                        onClick={() => removeLine(index)}
                        disabled={items.length === 1}
                      >
                        {t("Remove")}
                      </button>}
                    </div>

                    <label className="purchase-product-field">
                      <span>{t("Product")} <b>*</b></span>
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
                        placeholder={t("Search product name or code...")}
                        aria-label={t("Search product for item {number}", { number: index + 1 })}
                      />
                      {activeProductSearchIndex === index && <div
                        className="purchase-product-results"
                        role="listbox"
                        aria-label={t("Matching products for item {number}", { number: index + 1 })}
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
                                    ? t("Inactive")
                                    : t("Purchase price: {amount}", { amount: money(entry.purchasePrice) })}
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
                            {t("No matching products found.")}
                          </p>
                        )}
                      </div>}

                      {product && (
                        <small>
                          {t("Current purchase price:")}{" "}
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
                        {t("+ Create New Product")}
                      </button>
                    </label>

                    <div className="purchase-line-fields">
                      <label>
                        {t("Quantity")}
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
                        {units.find((unit) => Number(unit.id) === Number(product.secondaryUnitId))?.code || t("Secondary quantity")}
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
                        {t("Price basis")}
                        <select value={item.pricingUnit} onChange={(event) => updateItem(index, "pricingUnit", event.target.value)}>
                          <option value="PRIMARY">{t("Per main unit")}</option>
                          {product?.secondaryUnitId && <option value="SECONDARY">{t("Per second unit")}</option>}
                        </select>
                      </label>

                      <label>
                        {t("Rate (₹)")}
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
                        {t("Line discount (₹)")}
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
                      <span>{t("Taxable: {amount}", { amount: money(calc.taxable) })}</span>
                      <strong>{t("Line total: {amount}", { amount: money(calc.total) })}</strong>
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
                  {t("+ Add another item")}
                </button>
              </div>
            )}

            <div className="purchase-section-heading purchase-items-heading">
              <div>
                <h3>{t("Additional purchase charges")}</h3>
                <p>{t("Record labour, transport, loading, or other supplier-side costs.")}</p>
              </div>
              {canManagePurchases && <button type="button" className="purchase-secondary-button" onClick={addPurchaseExpense}>{t("+ Add charge")}</button>}
            </div>
            {expenses.length > 0 && <div className="purchase-expenses-list">
              {expenses.map((expense, index) => (
                <div className="purchase-expense-row" key={`${index}-${expense.categoryId}`}>
                  <select value={expense.categoryId} onChange={(event) => {
                    const selected = expenseCategories.find((category) => String(category.id) === event.target.value);
                    updatePurchaseExpense(index, "categoryId", event.target.value);
                    if (selected && !expense.description) updatePurchaseExpense(index, "description", selected.name);
                  }} required>
                    <option value="">{t("Select charge category")}</option>
                    {expenseCategories.filter((category) => category.active !== false && category.isActive !== false).map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                  <input value={expense.description} onChange={(event) => updatePurchaseExpense(index, "description", event.target.value)} placeholder={t("Description (optional)")} maxLength={100} />
                  <input type="number" min="0.01" step="0.01" value={expense.amount} onChange={(event) => updatePurchaseExpense(index, "amount", event.target.value)} placeholder={t("Amount")} required />
                  <button type="button" className="purchase-icon-button" onClick={() => removePurchaseExpense(index)} aria-label={t("Remove charge")}>×</button>
                </div>
              ))}
              <div className="purchase-inline-category">
                <button type="button" className="purchase-secondary-button" onClick={() => setShowExpenseCategoryForm((current) => !current)}>{t("+ Add charge category")}</button>
                {showExpenseCategoryForm && <div className="purchase-reference-creator"><input value={newExpenseCategory} onChange={(event) => setNewExpenseCategory(event.target.value)} placeholder={t("New expense category")} maxLength={100} /><button type="button" className="purchase-secondary-button" onClick={addPurchaseExpenseCategory}>{t("Create")}</button></div>}
              </div>
            </div>}

            <div className="purchase-form-grid purchase-tax-grid">
              <label className="field-half">
                {t("Discount on whole bill (₹)")}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceDiscount}
                  onChange={(event) => setInvoiceDiscount(event.target.value)}
                  placeholder="0"
                />
              </label>

              <label className="field-half">
                {t("GST rate on this bill (%)")} <b>*</b>
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
            </div>

            <div className="purchase-bottom-grid">
              <div className="purchase-note">
                <strong>{t("Saved as a draft")}</strong>
                <p>
                  {t("Stock is added only when you press “Add to stock” after the goods arrive. Payments are recorded separately.")}
                </p>
              </div>

              <div className="purchase-totals">
                <div>
                  <span>{t("Subtotal")}</span>
                  <strong>{money(calculations.subtotal)}</strong>
                </div>
                <div>
                  <span>{t("Line discounts")}</span>
                  <strong>- {money(calculations.lineDiscounts)}</strong>
                </div>
                <div>
                  <span>{t("Invoice discount")}</span>
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
                  <span>{t("Total GST")}</span>
                  <strong>{money(calculations.gstAmount)}</strong>
                </div>
                <div>
                  <span>{t("Additional charges (including GST)")}</span>
                  <strong>{money(calculations.expensesTotal + calculations.expensesGst)}</strong>
                </div>
                <div className="purchase-grand-total">
                  <span>{t("Invoice total")}</span>
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
                {t("Clear")}
              </button>

              <button
                type="submit"
                className="purchase-primary-button"
                disabled={
                  saving || products.length === 0 || suppliers.length === 0
                }
              >
                {saving ? t("Saving...") : t("Save purchase")}
              </button>
            </div>
          </form>
          </div>}

          <div className="purchase-card">
            <div className="purchase-section-heading">
              <div>
                <h3>{t("Supplier bills")}</h3>
                <p>{t("Open a bill to add its stock, pay the supplier or see the items.")}</p>
              </div>
            </div>

            <div className="purchase-filters">
              <input
                type="search"
                placeholder={t("Search supplier or bill number")}
                aria-label={t("Search purchases")}
                value={purchaseSearch}
                onChange={(event) => {
                  setPurchaseSearch(event.target.value);
                  setPurchasePage(1);
                }}
              />
              <select value={purchaseStatus} aria-label={t("Filter purchase status")} onChange={(event) => { setPurchaseStatus(event.target.value); setPurchasePage(1); }}>
                <option value="ALL">{t("All bills")}</option>
                <option value="DRAFT">{t("Waiting to arrive")}</option>
                <option value="RECEIVED">{t("Added to stock")}</option>
              </select>
              <select value={purchaseDateFilter} aria-label={t("Filter purchase date")} onChange={(event) => { setPurchaseDateFilter(event.target.value); setPurchasePage(1); }}>
                <option value="ALL">{t("All dates")}</option>
                <option value="TODAY">{t("Today")}</option>
                <option value="WEEK">{t("Last 7 days")}</option>
                <option value="MONTH">{t("Last 30 days")}</option>
              </select>
              <button type="button" className="purchase-secondary-button" onClick={() => { setPurchaseSearch(""); setPurchaseStatus("ALL"); setPurchaseDateFilter("ALL"); setPurchasePage(1); }}>{t("Clear")}</button>
            </div>

            {visiblePurchases.length === 0 ? (
              <div className="purchase-empty-state">
                {t("No supplier bills found. Use “+ New purchase” to add one.")}
              </div>
            ) : (
              <div className="purchase-table-scroll has-mobile-cards">
                <table className="purchase-table desktop-table">
                  <thead>
                    <tr>
                      <th>{t("Our no.")}</th>
                      <th>{t("Bill date")}</th>
                      <th>{t("Supplier")}</th>
                      <th>{t("Supplier bill no.")}</th>
                      <th>{t("Status")}</th>
                      <th className="num">{t("Total")}</th>
                      <th><span className="visually-hidden">{t("Actions")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePurchases.map((purchase) => (
                      <tr key={purchase.id}>
                        <td>
                          <strong>{purchase.purchaseNumber}</strong>
                        </td>
                        <td>{formatDate(purchase.purchaseDate)}</td>
                        <td>
                          {purchase.supplierName ||
                            t("Supplier #{id}", { id: purchase.supplierId })}
                        </td>
                        <td>{purchase.supplierInvoiceNumber || "—"}</td>
                        <td>
                          {purchase.status === "RECEIVED" ? (
                            <span className={paymentBadgeClass(purchase.paymentStatus)}>
                              {label(purchase.paymentStatus)}
                            </span>
                          ) : (
                            <span className="purchase-status">{t("Waiting to arrive")}</span>
                          )}
                        </td>
                        <td className="num">
                          {money(purchase.totalAmount)}
                          {purchase.status === "RECEIVED"
                            && Number(purchase.balanceDue) > 0
                            && Number(purchase.balanceDue) < Number(purchase.totalAmount) && (
                            <span className="amount-due">{t("{amount} to pay", { amount: money(purchase.balanceDue) })}</span>
                          )}
                        </td>
                        <td>
                          <div className="purchase-action-group">
                            <button type="button" className="purchase-secondary-button" onClick={() => setDetailsPurchase(purchase)}>{t("View")}</button>
                            {canManagePurchases && purchase.status === "DRAFT" ? (
                              <>
                                <button type="button" className="purchase-secondary-button" onClick={() => openEditPurchaseForm(purchase)}>
                                  {t("Edit")}
                                </button>
                                <button type="button" className="purchase-primary-button" disabled={receivingId !== null} onClick={() => setPurchaseToReceive(purchase)}>
                                  {receivingId === purchase.id ? t("Adding...") : t("Add to stock")}
                                </button>
                              </>
                            ) : canManagePurchases ? (
                              <button type="button" className="purchase-secondary-button" onClick={() => openPaymentPanel(purchase)}>{t("Pay")}</button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mobile-cards">
                  {visiblePurchases.map((purchase) => (
                    <button
                      type="button"
                      key={purchase.id}
                      className="mobile-card"
                      onClick={() => setDetailsPurchase(purchase)}
                    >
                      <span className="mobile-card__row">
                        <span className="mobile-card__title">
                          {purchase.supplierName || t("Supplier #{id}", { id: purchase.supplierId })}
                        </span>
                        <span className="mobile-card__amount">{money(purchase.totalAmount)}</span>
                      </span>
                      <span className="mobile-card__row">
                        <span className="mobile-card__meta">
                          {purchase.purchaseNumber} · {formatDate(purchase.purchaseDate)}
                        </span>
                        {purchase.status === "RECEIVED" ? (
                          <span className={paymentBadgeClass(purchase.paymentStatus)}>
                            {label(purchase.paymentStatus)}
                          </span>
                        ) : (
                          <span className="purchase-status">{t("Waiting to arrive")}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="purchase-pagination">
              <span>{t("Showing {from}–{to} of {total}", { from: filteredPurchases.length ? (purchasePage - 1) * PAGE_SIZE + 1 : 0, to: Math.min(purchasePage * PAGE_SIZE, filteredPurchases.length), total: filteredPurchases.length })}</span>
              <div><button type="button" disabled={purchasePage <= 1} onClick={() => setPurchasePage((current) => current - 1)}>{t("Previous")}</button><strong>{t("Page {page} of {count}", { page: purchasePage, count: purchasePageCount })}</strong><button type="button" disabled={purchasePage >= purchasePageCount} onClick={() => setPurchasePage((current) => current + 1)}>{t("Next")}</button></div>
            </div>
          </div>

          {paymentPurchase && (
            <div className="purchase-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPaymentPurchase(null)}>
            <div className="purchase-card payment-panel purchase-modal">
              <div className="purchase-section-heading">
                <div>
                  <h3>{t("Supplier Payments")}</h3>
                  <p>
                    {paymentPurchase.purchaseNumber} ·{" "}
                    {paymentPurchase.supplierName ||
                      t("Supplier #{id}", { id: paymentPurchase.supplierId })}
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
                  {t("Close")}
                </button>
              </div>

              {paymentLoading ? (
                <Skeleton label={t("Loading payment details...")} rows={3} />
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
                        <span>{t("Purchase total")}</span>
                        <strong>{money(paymentBalance.purchaseTotal)}</strong>
                      </div>
                      <div>
                        <span>{t("Total paid")}</span>
                        <strong>{money(paymentBalance.totalPaid)}</strong>
                      </div>
                      <div>
                        <span>{t("Still to pay")}</span>
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
                    <h4>{t("Record Supplier Payment")}</h4>

                    <div className="purchase-form-grid">
                      <label>
                        {t("Payment date")} *
                        <input
                          type="date"
                          value={paymentDate}
                          max={today()}
                          onChange={(event) =>
                            setPaymentDate(event.target.value)
                          }
                          required
                        />
                        {backdateWarning(paymentDate) && (
                          <small className="purchase-backdate-warning">{backdateWarning(paymentDate)}</small>
                        )}
                      </label>

                      <label>
                        {t("Amount (₹)")} *
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
                        {t("Payment method")} *
                        <select
                          value={paymentMethod}
                          onChange={(event) =>
                            setPaymentMethod(event.target.value)
                          }
                          required
                        >
                          <option value="CASH">{t("Cash")}</option>
                          <option value="UPI">UPI</option>
                          <option value="BANK_TRANSFER">{t("Bank transfer")}</option>
                          <option value="CHEQUE">{t("Cheque")}</option>
                          <option value="CARD">{t("Card")}</option>
                          <option value="OTHER">{t("Other")}</option>
                        </select>
                      </label>

                      <label>
                        {t("Reference number")}
                        <input
                          value={paymentReference}
                          onChange={(event) =>
                            setPaymentReference(event.target.value)
                          }
                          maxLength={100}
                          placeholder={t("Transaction or cheque number")}
                        />
                      </label>

                      <label className="purchase-wide-field">
                        {t("Notes")}
                        <textarea
                          rows={2}
                          value={paymentNotes}
                          onChange={(event) =>
                            setPaymentNotes(event.target.value)
                          }
                          placeholder={t("Optional payment notes")}
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
                      {paymentSaving ? t("Saving...") : t("Save payment")}
                    </button>
                  </form>

                  <div className="payment-history">
                    <h4>{t("Payment History")}</h4>

                    {paymentHistory.length === 0 ? (
                      <p>{t("No payments recorded for this purchase yet.")}</p>
                    ) : (
                      <div className="purchase-table-scroll">
                        <table className="purchase-table">
                          <thead>
                            <tr>
                              <th>{t("Date")}</th>
                              <th className="num">{t("Amount")}</th>
                              <th>{t("Method")}</th>
                              <th>{t("Reference")}</th>
                              {canFixPayments && <th><span className="visually-hidden">{t("Actions")}</span></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {paymentHistory.map((payment) => (
                              <tr key={payment.id}>
                                <td>{formatDate(payment.paymentDate)}</td>
                                <td className="num">{money(payment.amount)}</td>
                                <td>{label(payment.paymentMethod)}</td>
                                <td>{payment.referenceNumber || "—"}</td>
                                {canFixPayments && (
                                  <td>
                                    <button type="button" className="purchase-payment-fix" onClick={() => setFixingPayment(payment)}>
                                      {t("Change method")}
                                    </button>
                                  </td>
                                )}
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
              <div><h2 id="purchase-details-title">{t("Purchase {number}", { number: detailsPurchase.purchaseNumber })}</h2><p>{detailsPurchase.supplierName || t("Supplier #{id}", { id: detailsPurchase.supplierId })} · {formatDate(detailsPurchase.purchaseDate)}</p></div>
              <button type="button" className="purchase-secondary-button" onClick={() => setDetailsPurchase(null)}>{t("Close")}</button>
            </div>
            <div className="purchase-detail-grid">
              <div><span>{t("Status")}</span><strong>{detailsPurchase.status === "RECEIVED" ? t("Added to stock") : t("Waiting to arrive")}</strong></div>
              <div><span>{t("Supplier invoice")}</span><strong>{detailsPurchase.supplierInvoiceNumber || "—"}</strong></div>
              <div><span>{t("Subtotal")}</span><strong>{money(detailsPurchase.subtotal)}</strong></div>
              <div><span>{t("Discount")}</span><strong>{money(detailsPurchase.discountAmount)}</strong></div>
              <div><span>{t("Supplier location")}</span><strong>{detailsPurchase.taxType === "IGST" ? t("Other state (IGST)") : t("Same state (CGST + SGST)")}</strong></div>
              <div><span>CGST</span><strong>{money(detailsPurchase.cgstAmount)}</strong></div>
              <div><span>SGST</span><strong>{money(detailsPurchase.sgstAmount)}</strong></div>
              <div><span>IGST</span><strong>{money(detailsPurchase.igstAmount)}</strong></div>
               <div><span>{t("Total GST")}</span><strong>{money(detailsPurchase.gstAmount)}</strong></div>
               <div><span>{t("Additional charges (including GST)")}</span><strong>{money(
                 (detailsPurchase.expensesTotal
                   || detailsPurchase.expenses?.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
                   || 0) + Number(detailsPurchase.expenseGstAmount || 0)
               )}</strong></div>
              <div><span>{t("Total")}</span><strong>{money(detailsPurchase.totalAmount)}</strong></div>
            </div>
            <div className="purchase-detail-items">
              <h3>{t("Items")}</h3>
              {detailsPurchase.items?.map((item) => <div className="purchase-detail-item" key={item.id}><span>{item.productName}<small>{item.productCode}</small></span><span>{item.quantity} × {money(item.purchaseRate)}</span><strong>{money(item.lineTotal)}</strong></div>)}
              {detailsPurchase.expenses?.map((expense) => <div className="purchase-detail-item" key={`expense-${expense.id}`}><span>{expense.description}</span><strong>{money(expense.amount)}</strong></div>)}
            </div>
            <div className="purchase-form-actions">
              {canManagePurchases && detailsPurchase.status === "DRAFT" && <><button type="button" className="purchase-secondary-button" onClick={() => openEditPurchaseForm(detailsPurchase)}>{t("Edit purchase")}</button><button type="button" className="purchase-primary-button" onClick={() => { setDetailsPurchase(null); setPurchaseToReceive(detailsPurchase); }}>{t("Add to stock")}</button></>}
              {canManagePurchases && detailsPurchase.status === "RECEIVED" && <button type="button" className="purchase-secondary-button" onClick={() => { setDetailsPurchase(null); openPaymentPanel(detailsPurchase); }}>{t("Open payments")}</button>}
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
              <h2 id="receive-purchase-title">{t("Add these goods to stock?")}</h2>
              <p className="purchase-confirm-message">
                {t("The items on purchase")} <strong>{purchaseToReceive.purchaseNumber}</strong>{" "}
                {t("will be added to your stock.")}
              </p>
              <p className="purchase-confirm-note">
                {t("Do this once the goods have arrived. It can't be undone.")}
              </p>
            </div>
            <div className="purchase-form-actions purchase-confirm-actions">
              <button
                type="button"
                className="purchase-secondary-button"
                disabled={receivingId !== null}
                onClick={() => setPurchaseToReceive(null)}
              >
                {t("Cancel")}
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
                {receivingId !== null ? t("Adding...") : t("Add to stock")}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default PurchasesPage;
