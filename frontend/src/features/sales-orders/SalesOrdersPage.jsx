import { useCallback, useEffect, useMemo, useState } from "react";

import {

  getSalesOrders,

  createSalesOrder,
  getSalesOrderBalance,
  getSalesOrderPayments,
  changeSalesPaymentMethod,
  recordSalesOrderPayment,
  createSalesReturn,
  cancelSalesOrder,

} from "../../services/api/salesOrderApi";

import {

  getCustomers,

  createCustomer,

} from "../../services/api/customerApi";

import {
  getProducts,
  getMeasurementUnits,
} from "../../services/api/inventoryApi";
import {
  createExpenseCategory,
  getExpenseCategories,
} from "../../services/api/expenseApi";

import "./SalesOrdersPage.css";
import { usePermission } from "../../auth/PermissionsContext";
import SalesOrderInvoice from "./SalesOrderInvoice";
import SearchSelect from "../../components/SearchSelect";
import { taxTypeForGstin } from "../../utils/business";
import { formatDate, label, paymentBadgeClass } from "../../utils/format";
import { newRequestId } from "../../utils/requestId";
import { backdateWarning } from "../../utils/backdate";
import { whatsappLink } from "../../utils/whatsapp";
import { t } from "../../i18n";
import ChangeMethodDialog from "../../components/ChangeMethodDialog";
import Skeleton from "../../components/Skeleton";

import FitText from "../../components/FitText";
function formatCurrency(value) {

  return new Intl.NumberFormat("en-IN", {

    style: "currency",

    currency: "INR",

    minimumFractionDigits: 2,

  }).format(Number(value || 0));

}

function today() {

  const date = new Date();

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;

}

function roundMoney(value) {

  return Math.round((value + Number.EPSILON) * 100) / 100;

}

// What is still on a bill line after earlier returns.
function quantityLeft(item) {
  return roundQuantity(Number(item.quantity || 0) - Number(item.returnedQuantity || 0));
}

function roundQuantity(value) {
  return Math.round(value * 1000) / 1000;
}

// Rough value of a return, for the refund hint; the server works out the exact figure.
function estimateReturnValue(order, lines) {
  return roundMoney((order.items || []).reduce((total, item) => {
    const quantity = Number(lines[item.id]?.quantity) || 0;
    const sold = Number(item.quantity) || 0;
    return sold > 0 ? total + (Number(item.lineTotal) || 0) * (quantity / sold) : total;
  }, 0));
}

function calculateTotals(items, taxType, charges = []) {

  let subtotal = 0;

  let cgstAmount = 0;

  let sgstAmount = 0;

  let igstAmount = 0;

  for (const item of items) {

    // The backend bills the secondary quantity when pricing by secondary unit.
    const quantity = item.pricingUnit === "SECONDARY"
      ? Number(item.secondaryQuantity) || 0
      : Number(item.quantity) || 0;

    const unitPrice = Number(item.unitPrice) || 0;

    // Bills without GST ("NONE") carry no tax at all.
    const gstRate = taxType === "NONE" ? 0 : Number(item.gstRate) || 0;

    const taxableAmount = roundMoney(quantity * unitPrice);

    const tax = roundMoney((taxableAmount * gstRate) / 100);

    subtotal += taxableAmount;

    if (taxType === "INTRA") {

      const cgst = roundMoney(tax / 2);

      const sgst = roundMoney(tax - cgst);

      cgstAmount += cgst;

      sgstAmount += sgst;

    } else if (taxType === "INTER") {

      igstAmount += tax;

    }

  }

  subtotal = roundMoney(subtotal);

  cgstAmount = roundMoney(cgstAmount);

  sgstAmount = roundMoney(sgstAmount);

  igstAmount = roundMoney(igstAmount);

  const totalTax = roundMoney(

    cgstAmount + sgstAmount + igstAmount

  );

  return {

    subtotal,

    cgstAmount,

    sgstAmount,

    igstAmount,

    totalTax,

    chargesTotal: roundMoney(charges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0)),
    grandTotal: roundMoney(subtotal + totalTax + charges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0)),

  };

}

const emptyCustomerForm = {

  name: "",

  phone: "",

  email: "",

  gstin: "",

  billingAddress: "",

  shippingAddress: "",

  creditLimit: "0",

};

const emptyOrderItem = {

  productId: "",

  quantity: "1",
  secondaryQuantity: "",
  pricingUnit: "PRIMARY",

  unitPrice: "",

  gstRate: 0,

};

function SalesOrdersPage() {
  const canManageSales = usePermission("SALES_MANAGE");
  const canManagePayments = usePermission("PAYMENT_MANAGE");
  const canViewPayments = usePermission("PAYMENT_READ");
  const canFixPayments = usePermission("CASH_APPROVE");
  const [orderPayments, setOrderPayments] = useState([]);
  const [fixingPayment, setFixingPayment] = useState(null);

  const [orders, setOrders] = useState([]);

  const [customers, setCustomers] = useState([]);

  const [products, setProducts] = useState([]);

  const [measurementUnits, setMeasurementUnits] = useState([]);

  const [loading, setLoading] = useState(true);

  const [formLoading, setFormLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [customerSaving, setCustomerSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showChargeCategoryForm, setShowChargeCategoryForm] = useState(false);
  const [chargeCategories, setChargeCategories] = useState([]);
  const [newChargeCategory, setNewChargeCategory] = useState("");
  const [invoiceOrderId, setInvoiceOrderId] = useState(null);
  const [detailsOrder, setDetailsOrder] = useState(null);
  const [paymentBalance, setPaymentBalance] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: today(),
    amount: "",
    paymentMethod: "CASH",
    referenceNumber: "",
    notes: "",
  });
  // Returning goods or cancelling the bill open from the bill details.
  const [returnMode, setReturnMode] = useState(null);
  const [returnLines, setReturnLines] = useState({});
  const [returnForm, setReturnForm] = useState({ date: today(), reason: "", refundMethod: "CASH" });
  const [savingReturn, setSavingReturn] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [orderPage, setOrderPage] = useState(1);

  const [customerId, setCustomerId] = useState("");

  const [orderDate, setOrderDate] = useState(today());

  const [taxType, setTaxType] = useState("INTRA");
  // false makes a bill without GST (an estimate, numbered EST-0001).
  const [withGst, setWithGst] = useState(true);
  const billTaxType = withGst ? taxType : "NONE";

  const [notes, setNotes] = useState("");
  const [charges, setCharges] = useState([]);

  const [items, setItems] = useState([{ ...emptyOrderItem }]);

  const [customerForm, setCustomerForm] = useState({

    ...emptyCustomerForm,

  });

  const PAGE_SIZE = 10;

  const loadOrders = useCallback(async () => {

    const data = await getSalesOrders();

    setOrders(Array.isArray(data) ? data : []);
    setError("");

  }, []);

  const loadFormData = useCallback(async () => {

    setFormLoading(true);

    setError("");

    try {

      const [customerData, productData, unitData] =
        await Promise.all([
          getCustomers(),
          getProducts(),
          getMeasurementUnits(),
        ]);
      let categoryData = [];
      try {
        categoryData = await getExpenseCategories();
      } catch {
        categoryData = [];
      }

      setCustomers(

        (Array.isArray(customerData) ? customerData : []).filter(

          (customer) => customer.active === true

        )

      );

      setProducts(

        (Array.isArray(productData) ? productData : []).filter(

          (product) => product.active === true

        )

      );

      setMeasurementUnits(

        (Array.isArray(unitData) ? unitData : []).filter(

          (unit) => unit.active !== false

        )

      );
      setChargeCategories(
        (Array.isArray(categoryData) ? categoryData : categoryData?.data || [])
          .filter((category) => category?.name)
          .sort((a, b) => a.name.localeCompare(b.name))
      );

    } catch (err) {

      setError(

        err.message ||

          t("Unable to load customers, products, and units.")

      );

    } finally {

      setFormLoading(false);

    }

  }, []);

  const refreshOrders = useCallback(async () => {

    setError("");

    try {

      setLoading(true);

      await loadOrders();

    } catch (err) {

      setError(
        err.message === "An unexpected error occurred"
          ? t("Bills could not be loaded. Check your internet connection and press Refresh.")
          : err.message || t("Unable to load sales orders.")
      );

    } finally {

      setLoading(false);

    }

  }, [loadOrders]);

  useEffect(() => {

    refreshOrders();

  }, [refreshOrders]);

  function getProductUnit(product) {

    if (!product) return t("Unit");

    // Prefer the unit code returned directly with the product.

    if (product.unitCode) return product.unitCode;

    // Otherwise match the product's unitId with the units API.

    const unit = measurementUnits.find(

      (entry) => Number(entry.id) === Number(product.unitId)

    );

    return unit?.code || unit?.name || t("Unit");

  }

  async function openCreateForm() {

    setSuccess("");

    setError("");

    setShowForm(true);

    await loadFormData();

  }

  function updateItem(index, field, value) {

    setItems((currentItems) =>

      currentItems.map((item, itemIndex) => {

        if (itemIndex !== index) return item;

        if (field === "productId") {

          const product = products.find(

            (entry) => String(entry.id) === String(value)

          );

          return {

            ...item,

            productId: value,

            unitPrice: product

              ? String(product.sellingPrice)

              : "",

            gstRate: product

              ? Number(product.gstRate) || 0

              : 0,

          };

        }

        return { ...item, [field]: value };

      })

    );

  }

  // Picking a customer also sets the tax type from their GSTIN state code.
  function handleCustomerChange(value) {
    setCustomerId(value);
    const customer = customers.find((entry) => String(entry.id) === String(value));
    const autoTaxType = taxTypeForGstin(customer?.gstin);
    setTaxType(autoTaxType || "INTRA");
  }

  function addItem() {

    setItems((currentItems) => [

      ...currentItems,

      { ...emptyOrderItem },

    ]);

  }

  function removeItem(index) {

    setItems((currentItems) =>

      currentItems.filter((_, itemIndex) => itemIndex !== index)

    );

  }

  function resetForm() {

    setCustomerId("");

    setOrderDate(today());

    setTaxType("INTRA");
    setWithGst(true);

    setNotes("");
    setCharges([]);

    setItems([{ ...emptyOrderItem }]);

  }

  function addCharge() {
    setCharges((current) => [...current, { description: "", amount: "" }]);
  }

  function updateCharge(index, field, value) {
    setCharges((current) => current.map((charge, chargeIndex) =>
      chargeIndex === index ? { ...charge, [field]: value } : charge
    ));
  }

  function removeCharge(index) {
    setCharges((current) => current.filter((_, chargeIndex) => chargeIndex !== index));
  }

  async function addChargeCategory(event) {
    event.preventDefault();
    const name = newChargeCategory.trim();
    if (!name) return;
    try {
      const created = await createExpenseCategory({ name, categoryType: "OPERATING" });
      setChargeCategories((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCharges((current) => [...current, { description: created.name, amount: "" }]);
      setNewChargeCategory("");
      setShowChargeCategoryForm(false);
    } catch (err) {
      setError(err.message || t("Unable to add charge category."));
    }
  }

  async function handleCreateCustomer(event) {

    event.preventDefault();

    setError("");

    setSuccess("");

    const name = customerForm.name.trim();

    const phone = customerForm.phone.trim();

    const email = customerForm.email.trim();

    const gstin = customerForm.gstin.trim().toUpperCase();

    const creditLimit = Number(customerForm.creditLimit || 0);

    if (!name || !phone) {

      setError(t("Customer name and phone number are required."));

      return;

    }

    if (!Number.isFinite(creditLimit) || creditLimit < 0) {

      setError(t("Credit limit must be zero or greater."));

      return;

    }

    if (gstin && gstin.length !== 15) {

      setError(t("GSTIN must contain exactly 15 characters."));

      return;

    }

    try {

      setCustomerSaving(true);

      const payload = {
        name,

        phone,

        email: email || null,

        gstin: gstin || null,

        billingAddress:

          customerForm.billingAddress.trim() || null,

        shippingAddress:

          customerForm.shippingAddress.trim() || null,

        creditLimit,

      };

      const createdCustomer = await createCustomer(payload);

      setCustomers((currentCustomers) =>

        [

          ...currentCustomers.filter(

            (customer) =>

              customer.id !== createdCustomer.id

          ),

          createdCustomer,

        ].sort((a, b) => a.name.localeCompare(b.name))

      );

      setCustomerId(String(createdCustomer.id));

      setCustomerForm({ ...emptyCustomerForm });

      setShowCustomerForm(false);

      setSuccess(

        t("Customer \"{name}\" created and selected successfully.", { name: createdCustomer.name })

      );

    } catch (err) {

      setError(err.message || t("Unable to create customer."));

    } finally {

      setCustomerSaving(false);

    }

  }

  async function handleSubmit(event) {

    event.preventDefault();

    setError("");

    setSuccess("");

    if (!customerId) {

      setError(t("Please select a customer."));

      return;

    }

    if (!orderDate) {

      setError(t("Please select an order date."));

      return;

    }

    if (items.length === 0) {

      setError(t("Add at least one product."));

      return;

    }

    for (const [index, item] of items.entries()) {

      const product = products.find(

        (entry) => String(entry.id) === String(item.productId)

      );

      if (!product) {

        setError(

          t("Please select a valid product for item {number}.", { number: index + 1 })

        );

        return;

      }

      const quantity = Number(item.quantity);
      const secondaryQuantity = Number(item.secondaryQuantity);

      const unitPrice = Number(item.unitPrice);

      const stock = Number(product.stockQuantity || 0);

      if (!Number.isFinite(quantity) || quantity <= 0) {

        setError(

          t("Enter a quantity greater than zero for item {number}.", { number: index + 1 })

        );

        return;

      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {

        setError(

          t("Enter a valid price for item {number}.", { number: index + 1 })

        );

        return;

      }

      if (quantity > stock) {

        setError(

          t("{product} has only {stock} {unit} available.", { product: product.name, stock, unit: getProductUnit(product) })

        );

        return;

      }
      if (product.secondaryUnitId != null
        && (!Number.isFinite(secondaryQuantity) || secondaryQuantity <= 0
          || secondaryQuantity > Number(product.secondaryStockQuantity || 0))) {
        setError(t("{product} needs a valid secondary quantity within available stock.", { product: product.name }));
        return;
      }

    }

    const order = {

      customerId: Number(customerId),

      orderDate,

      taxType: billTaxType,

      notes: notes.trim(),

      items: items.map((item) => ({

        productId: Number(item.productId),

        quantity: Number(item.quantity),
        secondaryQuantity: item.secondaryQuantity === "" ? null : Number(item.secondaryQuantity),
        pricingUnit: item.pricingUnit || "PRIMARY",

        unitPrice: Number(item.unitPrice),
        gstRate: Number(item.gstRate) || 0,
      })),
      charges: charges
        .filter((charge) => charge.description.trim() && Number(charge.amount) > 0)
        .map((charge) => ({
          description: charge.description.trim(),
          amount: Number(charge.amount),
        })),

    };

    try {

      setSaving(true);

      const createdOrder = await createSalesOrder(order);

      await loadOrders();

      resetForm();

      setShowForm(false);

      setSuccess(

        t("Sales order {number} was saved successfully.", { number: createdOrder.orderNumber })

      );

    } catch (err) {

      setError(

        err.message || t("Unable to save the sales order.")

      );

    } finally {

      setSaving(false);

    }

  }

  const totals = calculateTotals(items, billTaxType, charges);
  const filteredOrders = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    const now = new Date();
    return orders.filter((order) => {
      const matchesSearch = !term || [
        order.orderNumber,
        order.customerName,
        label(order.paymentStatus),
      ].some((value) => String(value || "").toLowerCase().includes(term));
      const matchesStatus = statusFilter === "ALL"
        || order.paymentStatus === statusFilter;
      let matchesDate = true;
      if (dateFilter !== "ALL" && order.orderDate) {
        const orderDate = new Date(`${order.orderDate}T00:00:00`);
        const days = dateFilter === "TODAY" ? 1 : dateFilter === "WEEK" ? 7 : 30;
        matchesDate = (now - orderDate) / 86400000 < days;
      }
      return matchesSearch && matchesStatus && matchesDate;
    }).sort((first, second) =>
      String(second.orderDate || "").localeCompare(String(first.orderDate || ""))
    );
  }, [dateFilter, orderSearch, orders, statusFilter]);
  const orderPageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const visibleOrders = filteredOrders.slice(
    (orderPage - 1) * PAGE_SIZE,
    orderPage * PAGE_SIZE
  );
  // Revenue figures exclude draft and cancelled orders, matching the reports.
  const billedOrders = orders.filter(
    (order) => order.status !== "CANCELLED" && order.status !== "DRAFT"
  );
  // Returned goods no longer count as sold.
  const sumTotals = (list) => list.reduce(
    (total, order) => total + Number(order.netTotal ?? order.grandTotal ?? 0), 0
  );
  const monthKey = today().slice(0, 7);
  const monthOrders = billedOrders.filter((order) =>
    String(order.orderDate || "").startsWith(monthKey)
  );
  const todayOrders = billedOrders.filter((order) => order.orderDate === today());
  const monthSales = sumTotals(monthOrders);
  const todaySales = sumTotals(todayOrders);
  const unpaidOrders = billedOrders.filter((order) => Number(order.balanceDue || 0) > 0);
  const toCollect = unpaidOrders.reduce(
    (total, order) => total + Number(order.balanceDue || 0), 0
  );

  async function openOrderDetails(order) {
    setDetailsOrder(order);
    setPaymentBalance(null);
    setOrderPayments([]);
    if (!canViewPayments) return;
    try {
      const [balance, payments] = await Promise.all([
        getSalesOrderBalance(order.id),
        getSalesOrderPayments(order.id),
      ]);
      setPaymentBalance(balance);
      setOrderPayments(Array.isArray(payments) ? payments : []);
    } catch (err) {
      setError(err.message || t("Unable to load payment balance."));
    }
  }

  async function fixPaymentMethod(method, reason) {
    await changeSalesPaymentMethod(detailsOrder.id, fixingPayment.id, method, reason);
    setFixingPayment(null);
    setOrderPayments(await getSalesOrderPayments(detailsOrder.id));
    setSuccess(t("Payment method changed."));
  }

  // Bill summary for the customer, sent from the shop's own WhatsApp.
  function billWhatsappLink(order) {
    const phone = customers.find((customer) => customer.id === order.customerId)?.phone;
    const lines = [
      `Indra Vaibhav Marble`,
      `Bill ${order.orderNumber} · ${formatDate(order.orderDate)}`,
      `Customer: ${order.customerName}`,
      "",
      ...(order.items || []).map((item) => `${item.productName}: ${item.quantity} ${item.unitCode} × ${formatCurrency(item.unitPrice)}`),
      ...(order.charges || []).map((charge) => `${charge.description}: ${formatCurrency(charge.amount)}`),
      "",
      `Bill total: ${formatCurrency(order.netTotal ?? order.grandTotal)}`,
    ];
    if (paymentBalance) {
      lines.push(`Paid: ${formatCurrency(paymentBalance.totalPaid)}`, `Still to pay: ${formatCurrency(paymentBalance.outstandingBalance)}`);
    }
    lines.push("", "Thank you!");
    return whatsappLink(phone, lines.join("\n"));
  }

  function openReturnForm(mode) {
    setReturnMode(mode);
    setReturnLines({});
    setReturnForm({ date: today(), reason: "", refundMethod: "CASH" });
    setReturnError("");
  }

  function updateReturnLine(itemId, field, value) {
    setReturnLines((current) => ({
      ...current,
      [itemId]: { ...current[itemId], [field]: value },
    }));
  }

  async function handleReturnSubmit(event) {
    event.preventDefault();
    if (!detailsOrder || savingReturn) return;
    const cancelling = returnMode === "cancel";
    const items = Object.entries(returnLines)
      .map(([itemId, line]) => ({
        salesOrderItemId: Number(itemId),
        quantity: line.quantity === "" || line.quantity == null ? null : Number(line.quantity),
        secondaryQuantity: line.secondaryQuantity === "" || line.secondaryQuantity == null
          ? null : Number(line.secondaryQuantity),
      }))
      .filter((line) => line.quantity > 0 || line.secondaryQuantity > 0);
    if (!cancelling && items.length === 0) {
      setReturnError(t("Enter how much of at least one item is coming back."));
      return;
    }
    setSavingReturn(true);
    setReturnError("");
    try {
      const result = cancelling
        ? await cancelSalesOrder(detailsOrder.id, {
          cancelDate: returnForm.date,
          reason: returnForm.reason.trim(),
          refundMethod: returnForm.refundMethod,
        })
        : await createSalesReturn(detailsOrder.id, {
          returnDate: returnForm.date,
          reason: returnForm.reason.trim(),
          refundMethod: returnForm.refundMethod,
          items,
        });
      setReturnMode(null);
      setDetailsOrder(null);
      await refreshOrders();
      const refund = Number(result.refundAmount) > 0
        ? ` ${t("{amount} refund recorded.", { amount: formatCurrency(result.refundAmount) })}`
        : "";
      setSuccess(cancelling
        ? t("Bill {number} cancelled. Stock has been added back.", { number: detailsOrder.orderNumber }) + refund
        : t("Return {number} saved. Stock has been added back.", { number: result.returnNumber }) + refund);
    } catch (err) {
      setReturnError(err.message || t("Unable to save the return."));
    } finally {
      setSavingReturn(false);
    }
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    if (!detailsOrder || savingPayment) return;
    setSavingPayment(true);
    setPaymentError("");
    try {
      await recordSalesOrderPayment(detailsOrder.id, {
        ...paymentForm,
        amount: Number(paymentForm.amount),
      });
      setPaymentForm({ paymentDate: today(), amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
      setShowPaymentForm(false);
      setPaymentBalance(await getSalesOrderBalance(detailsOrder.id));
      setOrderPayments(await getSalesOrderPayments(detailsOrder.id));
      // Refresh the list so the bill's Paid / Part-paid badge updates.
      await refreshOrders();
      setSuccess(t("Payment recorded successfully."));
    } catch (err) {
      setPaymentError(err.message || t("Unable to record payment."));
    } finally {
      setSavingPayment(false);
    }
  }

  return (

    <section className="sales-orders-page">

      <div className="sales-orders-heading">

        <p className="sales-orders-intro">
          {t("Create bills, collect payments and print invoices.")}
        </p>

        <div className="sales-orders-actions">

          <button

            type="button"

            className="sales-orders-refresh"

            onClick={refreshOrders}

            disabled={loading}

          >

            {t("Refresh")}

          </button>

          {canManageSales && <button

            type="button"

            className="sales-orders-primary"

            onClick={openCreateForm}

          >

            {t("+ New sale")}
          </button>}

        </div>

      </div>

      {error && (

        <div className="sales-orders-error" role="alert">

          {error}

        </div>

      )}

      {success && (

        <div className="sales-orders-success" role="status">

          {success}

        </div>

      )}

      {/* Add Customer Popup */}

      {showCustomerForm && (

        <div

          className="sales-customer-modal-backdrop"

          onMouseDown={(event) => {

            if (

              event.target === event.currentTarget &&

              !customerSaving

            ) {

              setShowCustomerForm(false);

            }

          }}

        >

          <form

            className="sales-customer-modal"

            onSubmit={handleCreateCustomer}

          >

            <div className="sales-customer-modal-heading">

              <div>

                <h2>{t("Add New Customer")}</h2>

                <p>

                  {t("Create a customer without leaving Sales & Billing.")}

                </p>

              </div>

              <button

                type="button"

                className="sales-customer-modal-close"

                onClick={() => setShowCustomerForm(false)}

                disabled={customerSaving}

                aria-label={t("Close customer form")}

              >

                ×

              </button>

            </div>

            <div className="sales-customer-modal-grid">

              <label>

                {t("Customer Name")} <span className="required">*</span>

                <input

                  value={customerForm.name}

                  maxLength={150}

                  onChange={(event) =>

                    setCustomerForm({

                      ...customerForm,

                      name: event.target.value,

                    })

                  }

                  placeholder={t("Enter customer name")}

                  required

                />

              </label>

              <label>

                {t("Phone Number")} <span className="required">*</span>

                <input

                  value={customerForm.phone}

                  maxLength={20}

                  onChange={(event) =>

                    setCustomerForm({

                      ...customerForm,

                      phone: event.target.value,

                    })

                  }

                  placeholder={t("Enter phone number")}

                  required

                />

              </label>

              <label>

                {t("Email")}

                <input

                  type="email"

                  value={customerForm.email}

                  maxLength={150}

                  onChange={(event) =>

                    setCustomerForm({

                      ...customerForm,

                      email: event.target.value,

                    })

                  }

                  placeholder="customer@example.com"

                />

              </label>

              <label>

                GSTIN

                <input

                  value={customerForm.gstin}

                  maxLength={15}

                  onChange={(event) =>

                    setCustomerForm({

                      ...customerForm,

                      gstin: event.target.value.toUpperCase(),

                    })

                  }

                  placeholder={t("15-character GSTIN")}

                />

              </label>

              <label>

                {t("Credit Limit (₹)")}

                <input

                  type="number"

                  min="0"

                  step="0.01"

                  value={customerForm.creditLimit}

                  onChange={(event) =>

                    setCustomerForm({

                      ...customerForm,

                      creditLimit: event.target.value,

                    })

                  }

                />

              </label>

              <label>

                {t("Billing Address")}

                <textarea

                  rows="2"

                  value={customerForm.billingAddress}

                  onChange={(event) =>

                    setCustomerForm({

                      ...customerForm,

                      billingAddress: event.target.value,

                    })

                  }

                  placeholder={t("Enter billing address")}

                />

              </label>

              <label>

                {t("Shipping Address")}

                <textarea

                  rows="2"

                  value={customerForm.shippingAddress}

                  onChange={(event) =>

                    setCustomerForm({

                      ...customerForm,

                      shippingAddress: event.target.value,

                    })

                  }

                  placeholder={t("Enter shipping address")}

                />

              </label>

            </div>

            <div className="sales-customer-modal-actions">

              <button

                type="button"

                className="sales-orders-secondary"

                onClick={() => setShowCustomerForm(false)}

                disabled={customerSaving}

              >

                {t("Cancel")}

              </button>

              <button

                type="submit"

                className="sales-orders-primary"

                disabled={customerSaving}

              >

                {customerSaving

                  ? t("Saving Customer...")

                  : t("Save & Select Customer")}

              </button>

            </div>

          </form>

        </div>

      )}

      {/* Create Sales Order Form */}

      {showForm && (
        <div
          className="sales-order-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setShowForm(false);
              setError("");
            }
          }}
        >
        <form className="sales-order-form sales-order-modal" onSubmit={handleSubmit}>

          <div className="sales-order-form-heading">

            <div>

              <h2>{t("New sale")}</h2>

              <p>{t("Choose the customer, add what they are buying, then save.")}</p>

            </div>

            <button

              type="button"

              className="sales-orders-refresh"

              onClick={() => {

                setShowForm(false);

                setError("");

              }}

              disabled={saving}

            >

              {t("Close")}

            </button>

          </div>

          {formLoading ? (

            <Skeleton label={t("Loading customers, products, and units...")} rows={4} columns={2} />

          ) : (

            <>

              <div className="sales-order-form-grid">

                <div className="sales-order-customer-field">

                  <div className="sales-order-customer-label">

                    <label htmlFor="sales-order-customer">

                      {t("Customer")} <span className="required">*</span>

                    </label>

                    {canManageSales && <button

                      type="button"

                      className="sales-orders-add-customer"

                      onClick={() => {

                        setError("");

                        setShowCustomerForm(true);

                      }}

                    >

                      {t("+ Add New Customer")}

                    </button>}

                  </div>

                  <SearchSelect
                    id="sales-order-customer"
                    options={customers.map((customer) => ({
                      value: customer.id,
                      label: customer.name,
                      hint: [customer.phone, customer.gstin && `GSTIN ${customer.gstin}`]
                        .filter(Boolean).join(" · "),
                    }))}
                    value={customerId}
                    onChange={handleCustomerChange}
                    placeholder={t("Search customer by name or phone")}
                    emptyText={t("No customer found. Use “+ Add New Customer”.")}
                    required
                  />

                  {customers.length === 0 && (

                    <small>

                      {t("No active customers found. Add a new customer to continue.")}

                    </small>

                  )}

                </div>

                <label>

                  {t("Order date")} <span className="required">*</span>

                  <input

                    type="date"

                    value={orderDate}

                    onChange={(event) =>

                      setOrderDate(event.target.value)

                    }

                    required

                  />

                </label>

                <label>
                  {t("Bill type")} <span className="required">*</span>
                  <select
                    value={withGst ? "GST" : "NONE"}
                    onChange={(event) => setWithGst(event.target.value === "GST")}
                    required
                  >
                    <option value="GST">{t("GST bill (tax invoice)")}</option>
                    <option value="NONE">{t("Without GST (estimate)")}</option>
                  </select>
                  <small className="sales-order-field-hint">
                    {withGst
                      ? t("GST added on top. Numbered INV-0001…")
                      : t("No GST on the bill. Numbered EST-0001…")}
                  </small>
                </label>

                {withGst && (
                  <label>

                    {t("Customer location")} <span className="required">*</span>

                    <select
                      value={taxType}
                      onChange={(event) => setTaxType(event.target.value)}
                      required
                    >
                      <option value="INTRA">{t("Same state as us (CGST + SGST)")}</option>
                      <option value="INTER">{t("Other state (IGST)")}</option>
                    </select>
                    <small className="sales-order-field-hint">
                      {t("Filled in from the customer's GSTIN. Change it only if needed.")}
                    </small>

                  </label>
                )}

              </div>

              <div className="sales-order-items-heading">

                <h3>{t("Products")}</h3>

                <button

                  type="button"

                  className="sales-orders-secondary"

                  onClick={addItem}

                >

                  {t("+ Add product")}

                </button>

              </div>

              <div className="sales-order-items-list">

                {items.map((item, index) => {

                  const product = products.find(

                    (entry) =>

                      String(entry.id) === String(item.productId)

                  );

                  const unit = getProductUnit(product);
                  const secondaryUnit = product && measurementUnits.find(
                    (entry) => Number(entry.id) === Number(product.secondaryUnitId)
                  );

                  const quantity = Number(item.quantity) || 0;

                  const unitPrice = Number(item.unitPrice) || 0;

                  // Billed on the second unit when pricing by it (e.g. per sq.ft).
                  const billableQuantity = item.pricingUnit === "SECONDARY"
                    ? Number(item.secondaryQuantity) || 0
                    : quantity;
                  const lineTotal = billableQuantity * unitPrice;

                  return (

                    <div className="sales-order-item" key={index}>

                      <label className="sales-order-product-field">

                        {t("Product")} <span className="required">*</span>

                        <SearchSelect
                          options={products.map((entry) => {
                            const entrySecondary = measurementUnits.find(
                              (unitEntry) => Number(unitEntry.id) === Number(entry.secondaryUnitId)
                            );
                            return {
                              value: entry.id,
                              label: entry.name,
                              hint: t("In stock: {quantity} {unit}", { quantity: Number(entry.stockQuantity || 0), unit: getProductUnit(entry) })
                                + (entrySecondary ? ` + ${Number(entry.secondaryStockQuantity || 0)} ${entrySecondary.code}` : ""),
                            };
                          })}
                          value={item.productId}
                          onChange={(value) => updateItem(index, "productId", value)}
                          placeholder={t("Search product by name")}
                          required
                        />

                      </label>
                      {secondaryUnit && <label>
                        {t("Quantity ({unit})", { unit: secondaryUnit.code })} <span className="required">*</span>
                        <input type="number" min="0.001" step="0.001" value={item.secondaryQuantity} onChange={(event) => updateItem(index, "secondaryQuantity", event.target.value)} required />
                      </label>}
                      {product && <label>
                        {t("Price basis")}
                        <select value={item.pricingUnit} onChange={(event) => updateItem(index, "pricingUnit", event.target.value)}>
                          <option value="PRIMARY">{t("Per {unit}", { unit })}</option>
                          {secondaryUnit && <option value="SECONDARY">{t("Per {unit}", { unit: secondaryUnit.code })}</option>}
                        </select>
                      </label>}

                      <label>

                        {t("Quantity ({unit})", { unit: product ? unit : t("unit") })}

                        <span className="required"> *</span>

                        <input

                          type="number"

                          min="0.001"

                          step="0.001"

                          max={

                            product

                              ? product.stockQuantity

                              : undefined

                          }

                          value={item.quantity}

                          onChange={(event) =>

                            updateItem(

                              index,

                              "quantity",

                              event.target.value

                            )

                          }

                          required

                        />

                      </label>

                      <label>
                        {t("Price per {unit} (₹)", { unit: product ? unit : t("unit") })}

                        <input

                          type="number"

                          min="0"

                          step="0.01"

                          value={item.unitPrice}

                          onChange={(event) =>

                            updateItem(

                              index,

                              "unitPrice",

                              event.target.value

                            )

                          }

                          required

                        />

                      </label>

                      {withGst && (
                        <label>
                          {t("GST (%)")}
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.gstRate}
                            onChange={(event) =>
                              updateItem(index, "gstRate", event.target.value)
                            }
                          />
                        </label>
                      )}

                      <div className="sales-order-line-total">

                        <span>{t("Line subtotal")}</span>

                        <strong>

                          {formatCurrency(lineTotal)}

                        </strong>

                        {withGst && (
                          <small>

                            {t("GST: {rate}%", { rate: Number(item.gstRate || 0) })}

                          </small>
                        )}

                      </div>

                      <button

                        type="button"

                        className="sales-order-remove"

                        onClick={() => removeItem(index)}

                        disabled={items.length === 1}

                        aria-label={t("Remove product {number}", { number: index + 1 })}

                        title={t("Remove product")}

                      >

                        {t("Remove")}

                      </button>

                    </div>

                  );

                })}

              </div>

              {products.length === 0 && (

                <p className="sales-orders-message">

                  {t("No active products found. Add or activate products in Inventory before creating an order.")}

                </p>

              )}

              <label className="sales-order-notes">

                {t("Notes")}

                <textarea

                  value={notes}

                  onChange={(event) => setNotes(event.target.value)}

                  rows="3"

                  placeholder={t("Optional notes for this order")}

                />

              </label>

              <section className="sales-order-charges">
                <div className="sales-order-items-heading">
                  <div>
                    <h3>{t("Additional bill charges")}</h3>
                    <p>{t("Optional charges such as labour, transport, loading, or delivery.")}</p>
                  </div>
                  <button type="button" className="sales-orders-secondary" onClick={addCharge}>
                    {t("+ Add charge")}
                  </button>
                </div>
                {charges.length > 0 && (
                  <div className="sales-order-charges-list">
                    {charges.map((charge, index) => (
                      <div className="sales-order-charge-row" key={index}>
                        <select
                          value={charge.description}
                          onChange={(event) => updateCharge(index, "description", event.target.value)}
                        >
                          <option value="">{t("Select charge category")}</option>
                          {chargeCategories.map((category) => (
                            <option key={category.id || category.name} value={category.name}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={charge.amount}
                          onChange={(event) => updateCharge(index, "amount", event.target.value)}
                          placeholder={t("Amount (₹)")}
                        />
                        <button type="button" className="sales-order-remove" onClick={() => removeCharge(index)}>
                          {t("Remove")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="sales-orders-text-button"
                  onClick={() => {
                    setNewChargeCategory("");
                    setShowChargeCategoryForm(true);
                  }}
                >
                  {t("+ Add new charge category")}
                </button>
              </section>

              <div className="sales-order-totals">

                <h3>{t("Order Summary")}</h3>

                <div>

                  <span>{t("Subtotal")}</span>

                  <strong>{formatCurrency(totals.subtotal)}</strong>

                </div>

                {!withGst ? null : taxType === "INTRA" ? (

                  <>

                    <div>

                      <span>CGST</span>

                      <strong>

                        {formatCurrency(totals.cgstAmount)}

                      </strong>

                    </div>

                    <div>

                      <span>SGST</span>

                      <strong>

                        {formatCurrency(totals.sgstAmount)}

                      </strong>

                    </div>

                  </>

                ) : (

                  <div>

                    <span>IGST</span>

                    <strong>

                      {formatCurrency(totals.igstAmount)}

                    </strong>

                  </div>

                )}

                {withGst && (
                  <div>
                    <span>{t("Total GST")}</span>

                    <strong>{formatCurrency(totals.totalTax)}</strong>

                  </div>
                )}
                {totals.chargesTotal > 0 && (
                  <div>
                    <span>{t("Additional charges")}</span>
                    <strong>{formatCurrency(totals.chargesTotal)}</strong>
                  </div>
                )}

                <div className="sales-order-grand-total">

                  <span>{t("Total after tax")}</span>

                  <strong>

                    {formatCurrency(totals.grandTotal)}

                  </strong>

                </div>

              </div>

              <div className="sales-order-form-actions sales-order-sticky-actions">

                <div className="sales-order-sticky-total">
                  <span>{t("Total")}</span>
                  <strong>{formatCurrency(totals.grandTotal)}</strong>
                </div>

                <button

                  type="button"

                  className="sales-orders-secondary"

                  onClick={resetForm}

                  disabled={saving}

                >

                  {t("Clear")}

                </button>

                <button

                  type="submit"

                  className="sales-orders-primary"

                  disabled={

                    saving ||

                    formLoading ||

                    customers.length === 0 ||

                    products.length === 0

                  }

                >

                  {saving ? t("Saving...") : t("Save order")}

                </button>

              </div>

            </>

          )}

        </form>
        </div>
      )}

      <div className="sales-orders-summary">
        <div className="sales-orders-summary-card is-green"><span>{t("Sales today")}</span><FitText>{formatCurrency(todaySales)}</FitText><small>{todayOrders.length === 1 ? t("{count} bill", { count: todayOrders.length }) : t("{count} bills", { count: todayOrders.length })}</small></div>
        <div className="sales-orders-summary-card is-blue"><span>{t("Sales this month")}</span><FitText>{formatCurrency(monthSales)}</FitText><small>{monthOrders.length === 1 ? t("{count} bill", { count: monthOrders.length }) : t("{count} bills", { count: monthOrders.length })}</small></div>
        <div className="sales-orders-summary-card is-amber"><span>{t("To collect from customers")}</span><FitText>{formatCurrency(toCollect)}</FitText><small>{unpaidOrders.length === 1 ? t("{count} bill not fully paid", { count: unpaidOrders.length }) : t("{count} bills not fully paid", { count: unpaidOrders.length })}</small></div>
      </div>

      {loading && (

        <Skeleton label={t("Loading sales orders...")} rows={6} />

      )}

      {!loading && (
        <div className="sales-orders-directory">
          <div className="sales-orders-filters">
            <div>
              <h2>{t("Bills")}</h2>
              <p>{t("Tap a bill to see details, take a payment or print it.")}</p>
            </div>
            <div className="sales-orders-filter-controls">
              <input
                type="search"
                value={orderSearch}
                placeholder={t("Search bill number or customer")}
                aria-label={t("Search sales orders")}
                onChange={(event) => {
                  setOrderSearch(event.target.value);
                  setOrderPage(1);
                }}
              />
              <select value={statusFilter} aria-label={t("Filter by payment")} onChange={(event) => { setStatusFilter(event.target.value); setOrderPage(1); }}>
                <option value="ALL">{t("All payments")}</option>
                <option value="UNPAID">{t("Unpaid")}</option>
                <option value="PARTIALLY_PAID">{t("Part-paid")}</option>
                <option value="PAID">{t("Paid")}</option>
              </select>
              <select value={dateFilter} aria-label={t("Filter order date")} onChange={(event) => { setDateFilter(event.target.value); setOrderPage(1); }}>
                <option value="ALL">{t("All dates")}</option>
                <option value="TODAY">{t("Today")}</option>
                <option value="WEEK">{t("Last 7 days")}</option>
                <option value="MONTH">{t("Last 30 days")}</option>
              </select>
              <button type="button" className="sales-orders-secondary" onClick={() => { setOrderSearch(""); setStatusFilter("ALL"); setDateFilter("ALL"); setOrderPage(1); }}>{t("Clear")}</button>
            </div>
          </div>
        <div className="sales-orders-table-wrapper has-mobile-cards">

          <table className="sales-orders-table desktop-table">

            <thead>

              <tr>

                <th>{t("Bill no.")}</th>

                <th>{t("Date")}</th>

                <th>{t("Customer")}</th>

                <th>{t("Payment")}</th>

                <th className="sales-orders-amount">{t("Total")}</th>
                <th><span className="visually-hidden">{t("Actions")}</span></th>

              </tr>

            </thead>

            <tbody>

              {visibleOrders.length === 0 ? (

                <tr>

                  <td colSpan="6" className="sales-orders-empty">

                    {t("No bills found. Use “+ New sale” to create one.")}

                  </td>

                </tr>

              ) : (

                visibleOrders.map((order) => (

                  <tr key={order.id}>

                    <td>
                      <strong>{order.orderNumber}</strong>
                      {order.taxType === "NONE" && (
                        <span className="sales-orders-status">{t("No GST")}</span>
                      )}
                      {order.status !== "CONFIRMED" && (
                        <span className={`sales-orders-status sales-orders-status-${String(order.status).toLowerCase()}`}>
                          {label(order.status)}
                        </span>
                      )}
                    </td>

                    <td>{formatDate(order.orderDate)}</td>

                    <td>{order.customerName}</td>

                    <td>
                      <span className={paymentBadgeClass(order.paymentStatus)}>
                        {label(order.paymentStatus)}
                      </span>
                    </td>

                    <td className="sales-orders-amount">
                      {order.status === "CANCELLED"
                        ? <s>{formatCurrency(order.grandTotal)}</s>
                        : formatCurrency(order.netTotal ?? order.grandTotal)}
                      {order.status !== "CANCELLED" && Number(order.returnedTotal) > 0 && (
                        <span className="amount-due">{t("{amount} returned", { amount: formatCurrency(order.returnedTotal) })}</span>
                      )}
                      {order.status !== "CANCELLED" && Number(order.balanceDue) > 0 && Number(order.balanceDue) < Number(order.netTotal ?? order.grandTotal) && (
                        <span className="amount-due">{t("{amount} due", { amount: formatCurrency(order.balanceDue) })}</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="sales-orders-secondary"
                        onClick={() => openOrderDetails(order)}
                      >
                        {t("View")}
                      </button>
                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

          <div className="mobile-cards">
            {visibleOrders.length === 0 ? (
              <p className="sales-orders-empty">{t("No bills found.")}</p>
            ) : visibleOrders.map((order) => (
              <button
                type="button"
                key={order.id}
                className="mobile-card"
                onClick={() => openOrderDetails(order)}
              >
                <span className="mobile-card__row">
                  <span className="mobile-card__title">{order.customerName}</span>
                  <span className="mobile-card__amount">
                    {order.status === "CANCELLED"
                      ? <s>{formatCurrency(order.grandTotal)}</s>
                      : formatCurrency(order.netTotal ?? order.grandTotal)}
                  </span>
                </span>
                <span className="mobile-card__row">
                  <span className="mobile-card__meta">{order.orderNumber} · {formatDate(order.orderDate)}</span>
                  {order.status === "CANCELLED"
                    ? <span className="sales-orders-status sales-orders-status-cancelled">{t("Cancelled")}</span>
                    : <span className={paymentBadgeClass(order.paymentStatus)}>{label(order.paymentStatus)}</span>}
                </span>
              </button>
            ))}
          </div>

        </div>
        <div className="sales-orders-pagination">
          <span>{t("Showing {from}–{to} of {total}", { from: filteredOrders.length ? (orderPage - 1) * PAGE_SIZE + 1 : 0, to: Math.min(orderPage * PAGE_SIZE, filteredOrders.length), total: filteredOrders.length })}</span>
          <div>
            <button type="button" disabled={orderPage <= 1} onClick={() => setOrderPage((current) => current - 1)}>{t("Previous")}</button>
            <strong>{t("Page {page} of {count}", { page: orderPage, count: orderPageCount })}</strong>
            <button type="button" disabled={orderPage >= orderPageCount} onClick={() => setOrderPage((current) => current + 1)}>{t("Next")}</button>
          </div>
        </div>
        </div>
      )}

      {detailsOrder && (
        <div className="sales-order-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetailsOrder(null)}>
          <section className="sales-order-details-modal" role="dialog" aria-modal="true" aria-labelledby="sales-order-details-title">
            <div className="sales-order-form-heading">
              <div><h2 id="sales-order-details-title">{t("Bill {number}", { number: detailsOrder.orderNumber })}</h2><p>{detailsOrder.customerName} · {formatDate(detailsOrder.orderDate)}</p></div>
              <button type="button" className="sales-orders-refresh" onClick={() => setDetailsOrder(null)} aria-label={t("Close order details")}>{t("Close")}</button>
            </div>
            <div className="sales-order-detail-summary">
              <div><span>{t("Status")}</span><strong>{label(detailsOrder.status)}</strong></div>
              {detailsOrder.taxType === "NONE"
                ? <div><span>{t("Bill type")}</span><strong>{t("Without GST")}</strong></div>
                : <div><span>{t("Customer location")}</span><strong>{label(detailsOrder.taxType)}</strong></div>}
              <div><span>{t("Subtotal")}</span><strong>{formatCurrency(detailsOrder.subtotal)}</strong></div>
              <div><span>{t("Total tax")}</span><strong>{formatCurrency(detailsOrder.totalTax)}</strong></div>
              {detailsOrder.charges?.length > 0 && <div><span>{t("Additional charges")}</span><strong>{formatCurrency(detailsOrder.charges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0))}</strong></div>}
              <div><span>{t("Grand total")}</span><strong>{formatCurrency(detailsOrder.grandTotal)}</strong></div>
              {Number(detailsOrder.returnedTotal) > 0 && <div><span>{t("Returned")}</span><strong>− {formatCurrency(detailsOrder.returnedTotal)}</strong></div>}
              {Number(detailsOrder.returnedTotal) > 0 && <div><span>{t("Bill now worth")}</span><strong>{formatCurrency(detailsOrder.netTotal)}</strong></div>}
              {detailsOrder.status === "CANCELLED" && <div><span>{t("Reason for cancelling")}</span><strong>{detailsOrder.cancelReason || "—"}</strong></div>}
              {paymentBalance && detailsOrder.status !== "CANCELLED" && <div><span>{t("Payment")}</span><strong><span className={paymentBadgeClass(paymentBalance.paymentStatus)}>{label(paymentBalance.paymentStatus)}</span></strong></div>}
              {paymentBalance && detailsOrder.status !== "CANCELLED" && <div><span>{t("Still to collect")}</span><strong>{formatCurrency(paymentBalance.outstandingBalance)}</strong></div>}
            </div>
            <div className="sales-order-detail-items">
              <h3>{t("Products")}</h3>
              {detailsOrder.items?.map((item) => <div className="sales-order-detail-item" key={item.id}><span>{item.productName} <small>{item.productCode}</small></span><span>{item.quantity} {item.unitCode} × {formatCurrency(item.unitPrice)}{detailsOrder.taxType !== "NONE" && ` · GST ${item.gstRate}%`}</span><strong>{formatCurrency(item.lineTotal)}{Number(item.returnedQuantity) > 0 && <small>{t("{quantity} {unit} returned", { quantity: roundQuantity(Number(item.returnedQuantity)), unit: item.unitCode })}</small>}</strong></div>)}
              {detailsOrder.charges?.map((charge) => <div className="sales-order-detail-item" key={`charge-${charge.id}`}><span>{charge.description}</span><strong>{formatCurrency(charge.amount)}</strong></div>)}
            </div>
            {orderPayments.length > 0 && (
              <div className="sales-order-detail-items">
                <h3>{t("Payments")}</h3>
                {orderPayments.map((payment) => (
                  <div className="sales-order-detail-item" key={payment.id}>
                    <span>{formatDate(payment.paymentDate)} · {label(payment.paymentMethod)}{payment.referenceNumber ? <small>{t("Ref: {reference}", { reference: payment.referenceNumber })}</small> : null}</span>
                    <span>{canFixPayments && detailsOrder.status !== "CANCELLED" && <button type="button" className="sales-orders-secondary sales-payment-fix" onClick={() => setFixingPayment(payment)}>{t("Change method")}</button>}</span>
                    <strong>{Number(payment.amount) < 0 ? t("− {amount} refund", { amount: formatCurrency(-payment.amount) }) : formatCurrency(payment.amount)}</strong>
                  </div>
                ))}
              </div>
            )}
            {detailsOrder.returns?.length > 0 && (
              <div className="sales-order-detail-items">
                <h3>{t("Returns")}</h3>
                {detailsOrder.returns.map((salesReturn) => (
                  <div className="sales-order-detail-item" key={salesReturn.id}>
                    <span>
                      {salesReturn.cancelsOrder ? t("Bill cancelled") : salesReturn.returnNumber} · {formatDate(salesReturn.returnDate)}
                      <small>{salesReturn.reason}{salesReturn.createdBy ? ` · ${t("by {name}", { name: salesReturn.createdBy })}` : ""}</small>
                    </span>
                    <span>
                      {salesReturn.items.map((line) => `${roundQuantity(Number(line.quantity))} ${line.unitCode} ${line.productName}`).join(", ") || t("Extra charges only")}
                      {Number(salesReturn.refundAmount) > 0 && <small>{t("Refunded {amount}", { amount: formatCurrency(salesReturn.refundAmount) })}</small>}
                    </span>
                    <strong>− {formatCurrency(salesReturn.totalAmount)}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="sales-order-form-actions">
              <button type="button" className="sales-orders-secondary sales-details-footer-close" onClick={() => setDetailsOrder(null)}>{t("Close")}</button>
              <button type="button" className="sales-orders-secondary" onClick={() => { setInvoiceOrderId(detailsOrder.id); setDetailsOrder(null); }}>{t("Print invoice")}</button>
              <a className="sales-orders-secondary sales-whatsapp" href={billWhatsappLink(detailsOrder)} target="_blank" rel="noopener noreferrer">{t("Send on WhatsApp")}</a>
              {canManageSales && detailsOrder.status === "CONFIRMED" && <button type="button" className="sales-orders-danger" onClick={() => openReturnForm("cancel")}>{t("Cancel bill")}</button>}
              {canManageSales && detailsOrder.status === "CONFIRMED" && detailsOrder.items?.some((item) => quantityLeft(item) > 0) && <button type="button" className="sales-orders-secondary" onClick={() => openReturnForm("return")}>{t("Return items")}</button>}
              {canManagePayments && detailsOrder.status !== "CANCELLED" && paymentBalance?.outstandingBalance > 0 && <button type="button" className="sales-orders-primary" onClick={() => { setPaymentError(""); setPaymentForm((current) => ({ ...current, requestId: newRequestId() })); setShowPaymentForm(true); }}>{t("Take payment")}</button>}
            </div>
          </section>
        </div>
      )}

      {returnMode && detailsOrder && (() => {
        const cancelling = returnMode === "cancel";
        const paid = Number(detailsOrder.amountPaid || 0);
        const worthNow = Number(detailsOrder.netTotal ?? detailsOrder.grandTotal);
        const refund = cancelling
          ? paid
          : Math.max(0, roundMoney(paid - (worthNow - estimateReturnValue(detailsOrder, returnLines))));
        const close = () => !savingReturn && setReturnMode(null);
        return (
          <div className="sales-order-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
            <form className="sales-order-details-modal sales-payment-modal sales-return-modal" onSubmit={handleReturnSubmit} aria-labelledby="sales-return-title">
              <div className="sales-order-form-heading">
                <div>
                  <h2 id="sales-return-title">{cancelling ? t("Cancel bill {number}?", { number: detailsOrder.orderNumber }) : t("Return items")}</h2>
                  <p>{cancelling
                    ? t("Everything still on the bill goes back into stock and the bill stops counting as a sale. The bill is kept, marked Cancelled.")
                    : t("Bill {number} · enter how much of each item is coming back.", { number: detailsOrder.orderNumber })}</p>
                </div>
                <button type="button" className="sales-orders-refresh" onClick={close}>{t("Close")}</button>
              </div>

              {!cancelling && (
                <div className="sales-return-lines">
                  {detailsOrder.items.filter((item) => quantityLeft(item) > 0).map((item) => {
                    const left = quantityLeft(item);
                    const dualUnit = Number(item.secondaryQuantity) > 0;
                    return (
                      <div className="sales-return-line" key={item.id}>
                        <div>
                          <strong>{item.productName}</strong>
                          <small>
                            {t("Sold {quantity} {unit}", { quantity: roundQuantity(Number(item.quantity)), unit: item.unitCode })}
                            {Number(item.returnedQuantity) > 0 && ` · ${t("{quantity} already returned", { quantity: roundQuantity(Number(item.returnedQuantity)) })}`}
                            {` · ${t("{quantity} left", { quantity: left })}`}
                          </small>
                        </div>
                        <label>
                          {t("Returning ({unit})", { unit: item.unitCode })}
                          <input
                            type="number" min="0" max={left} step="0.001" inputMode="decimal"
                            value={returnLines[item.id]?.quantity ?? ""}
                            onChange={(event) => updateReturnLine(item.id, "quantity", event.target.value)}
                            placeholder="0"
                          />
                        </label>
                        {dualUnit && (
                          <label>
                            {t("Second quantity")}
                            <input
                              type="number" min="0" step="0.001" inputMode="decimal"
                              value={returnLines[item.id]?.secondaryQuantity ?? ""}
                              onChange={(event) => updateReturnLine(item.id, "secondaryQuantity", event.target.value)}
                              placeholder={t("Auto")}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="sales-payment-grid">
                <label>{cancelling ? t("Cancel date") : t("Return date")}<input type="date" min={detailsOrder.orderDate} max={today()} value={returnForm.date} onChange={(event) => setReturnForm({ ...returnForm, date: event.target.value })} required /></label>
                {refund > 0 && (
                  <label>
                    {t("Refund given by")}
                    <select value={returnForm.refundMethod} onChange={(event) => setReturnForm({ ...returnForm, refundMethod: event.target.value })}><option value="CASH">{t("Cash")}</option><option value="UPI">{t("UPI")}</option><option value="BANK_TRANSFER">{t("Bank transfer")}</option><option value="CHEQUE">{t("Cheque")}</option><option value="CARD">{t("Card")}</option><option value="OTHER">{t("Other")}</option></select>
                  </label>
                )}
                <label className="sales-payment-full-width">
                  <span>{t("Reason")} <span className="required">*</span></span>
                  <textarea rows="2" value={returnForm.reason} onChange={(event) => setReturnForm({ ...returnForm, reason: event.target.value })} maxLength={1000} required placeholder={cancelling ? t("e.g. Customer cancelled the order") : t("e.g. Wrong shade, broken in transport")} />
                </label>
              </div>

              {refund > 0 && (
                <p className="sales-return-refund">
                  {cancelling
                    ? t("{amount} will be recorded as a refund to the customer.", { amount: formatCurrency(refund) })
                    : t("About {amount} will be recorded as a refund to the customer.", { amount: formatCurrency(refund) })}
                  {!canManagePayments && ` ${t("You can't record refunds, so ask someone who can take payments to do this.")}`}
                </p>
              )}
              {returnError && <div className="sales-orders-error" role="alert">{returnError}</div>}
              <div className="sales-order-form-actions">
                <button type="button" className="sales-orders-secondary" onClick={close}>{cancelling ? t("Keep bill") : t("Back")}</button>
                <button type="submit" className={cancelling ? "sales-orders-danger" : "sales-orders-primary"} disabled={savingReturn}>
                  {savingReturn ? t("Saving...") : cancelling ? t("Cancel bill") : t("Save return")}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {fixingPayment && <ChangeMethodDialog payment={fixingPayment} onSave={fixPaymentMethod} onClose={() => setFixingPayment(null)} />}
      {showPaymentForm && detailsOrder && (
        <div className="sales-order-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowPaymentForm(false)}>
          <form className="sales-order-details-modal sales-payment-modal" onSubmit={handlePaymentSubmit}>
            <div className="sales-order-form-heading"><div><h2>{t("Take payment")}</h2><p>{t("Bill {number} · {amount} still to collect", { number: detailsOrder.orderNumber, amount: formatCurrency(paymentBalance?.outstandingBalance) })}</p></div><button type="button" className="sales-orders-refresh" onClick={() => setShowPaymentForm(false)}>{t("Close")}</button></div>
            <div className="sales-payment-grid">
              <label>{t("Payment date")}<input type="date" max={today()} value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} required />{backdateWarning(paymentForm.paymentDate) && <small className="sales-backdate-warning">{backdateWarning(paymentForm.paymentDate)}</small>}</label>
              <label>{t("Amount (₹)")}<input type="number" min="0.01" step="0.01" max={paymentBalance?.outstandingBalance} value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} required /></label>
              <label>{t("Payment method")}<select value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethod: event.target.value })}><option value="CASH">{t("Cash")}</option><option value="UPI">{t("UPI")}</option><option value="BANK_TRANSFER">{t("Bank transfer")}</option><option value="CHEQUE">{t("Cheque")}</option><option value="CARD">{t("Card")}</option><option value="OTHER">{t("Other")}</option></select></label>
              <label>{t("Reference number")}<input value={paymentForm.referenceNumber} onChange={(event) => setPaymentForm({ ...paymentForm, referenceNumber: event.target.value })} maxLength={100} /></label>
              <label className="sales-payment-full-width">{t("Notes")}<textarea rows="3" value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} maxLength={1000} /></label>
            </div>
            {paymentError && <div className="sales-orders-error" role="alert">{paymentError}</div>}
            <div className="sales-order-form-actions"><button type="button" className="sales-orders-secondary" onClick={() => setShowPaymentForm(false)}>{t("Cancel")}</button><button type="submit" className="sales-orders-primary" disabled={savingPayment}>{savingPayment ? t("Saving...") : t("Save payment")}</button></div>
          </form>
        </div>
      )}

      {showChargeCategoryForm && (
        <div
          className="sales-customer-modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && setShowChargeCategoryForm(false)}
        >
          <form className="sales-customer-modal sales-charge-category-modal" onSubmit={addChargeCategory}>
            <div className="sales-customer-modal-heading">
              <div>
                <h2>{t("Add charge category")}</h2>
                <p>{t("Use this category in future bills and expense records.")}</p>
              </div>
              <button type="button" className="sales-customer-modal-close" onClick={() => setShowChargeCategoryForm(false)} aria-label={t("Close")}>
                ×
              </button>
            </div>
            <label className="sales-charge-category-input">
              {t("Category name")}
              <input
                autoFocus
                value={newChargeCategory}
                onChange={(event) => setNewChargeCategory(event.target.value)}
                placeholder={t("e.g. Cutting charges")}
                maxLength={100}
                required
              />
            </label>
            <div className="sales-order-form-actions">
              <button type="button" className="sales-orders-secondary" onClick={() => setShowChargeCategoryForm(false)}>{t("Cancel")}</button>
              <button type="submit" className="sales-orders-primary">{t("Add category")}</button>
            </div>
          </form>
        </div>
      )}

      {invoiceOrderId !== null && (
        <SalesOrderInvoice
          orderId={invoiceOrderId}
          onClose={() => setInvoiceOrderId(null)}
        />
      )}

    </section>

  );

}

export default SalesOrdersPage;
