import { useCallback, useEffect, useMemo, useState } from "react";

import {

  getSalesOrders,

  createSalesOrder,
  getSalesOrderBalance,
  recordSalesOrderPayment,

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

    const gstRate = Number(item.gstRate) || 0;

    const taxableAmount = roundMoney(quantity * unitPrice);

    const tax = roundMoney((taxableAmount * gstRate) / 100);

    subtotal += taxableAmount;

    if (taxType === "INTRA") {

      const cgst = roundMoney(tax / 2);

      const sgst = roundMoney(tax - cgst);

      cgstAmount += cgst;

      sgstAmount += sgst;

    } else {

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
  const [orderSearch, setOrderSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [orderPage, setOrderPage] = useState(1);

  const [customerId, setCustomerId] = useState("");

  const [orderDate, setOrderDate] = useState(today());

  const [taxType, setTaxType] = useState("INTRA");

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

          "Unable to load customers, products, and units."

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
          ? "Sales orders could not be loaded. Restart the backend so the latest database migrations can run, then refresh."
          : err.message || "Unable to load sales orders."
      );

    } finally {

      setLoading(false);

    }

  }, [loadOrders]);

  useEffect(() => {

    refreshOrders();

  }, [refreshOrders]);

  function getProductUnit(product) {

    if (!product) return "Unit";

    // Prefer the unit code returned directly with the product.

    if (product.unitCode) return product.unitCode;

    // Otherwise match the product's unitId with the units API.

    const unit = measurementUnits.find(

      (entry) => Number(entry.id) === Number(product.unitId)

    );

    return unit?.code || unit?.name || "Unit";

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
      setError(err.message || "Unable to add charge category.");
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

      setError("Customer name and phone number are required.");

      return;

    }

    if (!Number.isFinite(creditLimit) || creditLimit < 0) {

      setError("Credit limit must be zero or greater.");

      return;

    }

    if (gstin && gstin.length !== 15) {

      setError("GSTIN must contain exactly 15 characters.");

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

        `Customer "${createdCustomer.name}" created and selected successfully.`

      );

    } catch (err) {

      setError(err.message || "Unable to create customer.");

    } finally {

      setCustomerSaving(false);

    }

  }

  async function handleSubmit(event) {

    event.preventDefault();

    setError("");

    setSuccess("");

    if (!customerId) {

      setError("Please select a customer.");

      return;

    }

    if (!orderDate) {

      setError("Please select an order date.");

      return;

    }

    if (items.length === 0) {

      setError("Add at least one product.");

      return;

    }

    for (const [index, item] of items.entries()) {

      const product = products.find(

        (entry) => String(entry.id) === String(item.productId)

      );

      if (!product) {

        setError(

          `Please select a valid product for item ${index + 1}.`

        );

        return;

      }

      const quantity = Number(item.quantity);
      const secondaryQuantity = Number(item.secondaryQuantity);

      const unitPrice = Number(item.unitPrice);

      const stock = Number(product.stockQuantity || 0);

      if (!Number.isFinite(quantity) || quantity <= 0) {

        setError(

          `Enter a quantity greater than zero for item ${index + 1}.`

        );

        return;

      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {

        setError(

          `Enter a valid price for item ${index + 1}.`

        );

        return;

      }

      if (quantity > stock) {

        setError(

          `${product.name} has only ${stock} ${getProductUnit(product)} available.`

        );

        return;

      }
      if (product.secondaryUnitId != null
        && (!Number.isFinite(secondaryQuantity) || secondaryQuantity <= 0
          || secondaryQuantity > Number(product.secondaryStockQuantity || 0))) {
        setError(`${product.name} needs a valid secondary quantity within available stock.`);
        return;
      }

    }

    const order = {

      customerId: Number(customerId),

      orderDate,

      taxType,

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

        `Sales order ${createdOrder.orderNumber} was saved successfully.`

      );

    } catch (err) {

      setError(

        err.message || "Unable to save the sales order."

      );

    } finally {

      setSaving(false);

    }

  }

  const totals = calculateTotals(items, taxType, charges);
  const filteredOrders = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    const now = new Date();
    return orders.filter((order) => {
      const matchesSearch = !term || [
        order.orderNumber,
        order.customerName,
        order.status,
      ].some((value) => String(value || "").toLowerCase().includes(term));
      const matchesStatus = statusFilter === "ALL"
        || order.status === statusFilter;
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
  const confirmedOrders = orders.filter((order) => order.status === "CONFIRMED");
  const cancelledOrders = orders.filter((order) => order.status === "CANCELLED");
  const monthKey = today().slice(0, 7);
  const monthOrders = orders.filter((order) =>
    String(order.orderDate || "").startsWith(monthKey)
  );
  // Revenue figures exclude draft and cancelled orders, matching the reports.
  const billedOrders = orders.filter(
    (order) => order.status !== "CANCELLED" && order.status !== "DRAFT"
  );
  const totalSales = billedOrders.reduce(
    (total, order) => total + Number(order.grandTotal || 0), 0
  );
  const totalTax = billedOrders.reduce(
    (total, order) => total + Number(order.totalTax || 0), 0
  );
  const averageOrder = billedOrders.length ? totalSales / billedOrders.length : 0;

  async function openOrderDetails(order) {
    setDetailsOrder(order);
    setPaymentBalance(null);
    if (!canViewPayments) return;
    try {
      setPaymentBalance(await getSalesOrderBalance(order.id));
    } catch (err) {
      setError(err.message || "Unable to load payment balance.");
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
      setSuccess("Payment recorded successfully.");
    } catch (err) {
      setPaymentError(err.message || "Unable to record payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  return (

    <section className="sales-orders-page">

      <div className="sales-orders-heading">

        <div>

          <h1>Sales &amp; Billing</h1>

          <p>Manage sales orders and track their status.</p>

        </div>

        <div className="sales-orders-actions">

          <button

            type="button"

            className="sales-orders-refresh"

            onClick={refreshOrders}

            disabled={loading}

          >

            Refresh

          </button>

          {canManageSales && <button

            type="button"

            className="sales-orders-primary"

            onClick={openCreateForm}

          >

            + Create Sales Order
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

                <h2>Add New Customer</h2>

                <p>

                  Create a customer without leaving Sales &amp; Billing.

                </p>

              </div>

              <button

                type="button"

                className="sales-customer-modal-close"

                onClick={() => setShowCustomerForm(false)}

                disabled={customerSaving}

                aria-label="Close customer form"

              >

                ×

              </button>

            </div>

            <div className="sales-customer-modal-grid">

              <label>

                Customer Name <span className="required">*</span>

                <input

                  value={customerForm.name}

                  maxLength={150}

                  onChange={(event) =>

                    setCustomerForm({

                      ...customerForm,

                      name: event.target.value,

                    })

                  }

                  placeholder="Enter customer name"

                  required

                />

              </label>

              <label>

                Phone Number <span className="required">*</span>

                <input

                  value={customerForm.phone}

                  maxLength={20}

                  onChange={(event) =>

                    setCustomerForm({

                      ...customerForm,

                      phone: event.target.value,

                    })

                  }

                  placeholder="Enter phone number"

                  required

                />

              </label>

              <label>

                Email

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

                  placeholder="15-character GSTIN"

                />

              </label>

              <label>

                Credit Limit (₹)

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

                Billing Address

                <textarea

                  rows="2"

                  value={customerForm.billingAddress}

                  onChange={(event) =>

                    setCustomerForm({

                      ...customerForm,

                      billingAddress: event.target.value,

                    })

                  }

                  placeholder="Enter billing address"

                />

              </label>

              <label>

                Shipping Address

                <textarea

                  rows="2"

                  value={customerForm.shippingAddress}

                  onChange={(event) =>

                    setCustomerForm({

                      ...customerForm,

                      shippingAddress: event.target.value,

                    })

                  }

                  placeholder="Enter shipping address"

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

                Cancel

              </button>

              <button

                type="submit"

                className="sales-orders-primary"

                disabled={customerSaving}

              >

                {customerSaving

                  ? "Saving Customer..."

                  : "Save & Select Customer"}

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

              <h2>Create Sales Order</h2>

              <p>Select a customer and add the products being sold.</p>

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

              Close

            </button>

          </div>

          {formLoading ? (

            <p className="sales-orders-message">

              Loading customers, products, and units...

            </p>

          ) : (

            <>

              <div className="sales-order-form-grid">

                <div className="sales-order-customer-field">

                  <div className="sales-order-customer-label">

                    <label htmlFor="sales-order-customer">

                      Customer <span className="required">*</span>

                    </label>

                    {canManageSales && <button

                      type="button"

                      className="sales-orders-add-customer"

                      onClick={() => {

                        setError("");

                        setShowCustomerForm(true);

                      }}

                    >

                      + Add New Customer

                    </button>}

                  </div>

                  <select

                    id="sales-order-customer"

                    value={customerId}

                    onChange={(event) =>

                      setCustomerId(event.target.value)

                    }

                    required

                  >

                    <option value="">Select customer</option>

                    {customers.map((customer) => (

                      <option

                        key={customer.id}

                        value={customer.id}

                      >

                        {customer.name} ({customer.customerCode})

                      </option>

                    ))}

                  </select>

                  {customers.length === 0 && (

                    <small>

                      No active customers found. Add a new customer

                      to continue.

                    </small>

                  )}

                </div>

                <label>

                  Order date <span className="required">*</span>

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

                  Tax type <span className="required">*</span>

                  <select

                    value={taxType}

                    onChange={(event) =>

                      setTaxType(event.target.value)

                    }

                    required

                  >

                    <option value="INTRA">

                      Intra-state (CGST + SGST)

                    </option>

                    <option value="INTER">

                      Inter-state (IGST)

                    </option>

                  </select>

                </label>

              </div>

              <div className="sales-order-items-heading">

                <h3>Products</h3>

                <button

                  type="button"

                  className="sales-orders-secondary"

                  onClick={addItem}

                >

                  + Add product

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

                  const lineTotal = quantity * unitPrice;

                  return (

                    <div className="sales-order-item" key={index}>

                      <label className="sales-order-product-field">

                        Product <span className="required">*</span>

                        <select

                          value={item.productId}

                          onChange={(event) =>

                            updateItem(

                              index,

                              "productId",

                              event.target.value

                            )

                          }

                          required

                        >

                          <option value="">Select product</option>

                          {products.map((entry) => (

                            <option

                              key={entry.id}

                              value={entry.id}

                            >

                              {entry.name} — {entry.productCode} (

                              {getProductUnit(entry)})

                            </option>

                          ))}

                        </select>

                        {product && (

                          <small>
                              Available stock: {product.stockQuantity} {unit}
                              {secondaryUnit && ` + ${product.secondaryStockQuantity || 0} ${secondaryUnit.code}`}

                          </small>

                        )}

                      </label>
                      {secondaryUnit && <label>
                        Quantity ({secondaryUnit.code}) <span className="required">*</span>
                        <input type="number" min="0.001" step="0.001" value={item.secondaryQuantity} onChange={(event) => updateItem(index, "secondaryQuantity", event.target.value)} required />
                      </label>}
                      {product && <label>
                        Price basis
                        <select value={item.pricingUnit} onChange={(event) => updateItem(index, "pricingUnit", event.target.value)}>
                          <option value="PRIMARY">Per {unit}</option>
                          {secondaryUnit && <option value="SECONDARY">Per {secondaryUnit.code}</option>}
                        </select>
                      </label>}

                      <label>

                        Quantity ({product ? unit : "unit"})

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
                        Price per {product ? unit : "unit"} (₹)

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
                        />
                      </label>

                      <div className="sales-order-line-total">

                        <span>Line subtotal</span>

                        <strong>

                          {formatCurrency(lineTotal)}

                        </strong>

                        <small>

                          GST: {Number(item.gstRate || 0)}%

                        </small>

                      </div>

                      <button

                        type="button"

                        className="sales-order-remove"

                        onClick={() => removeItem(index)}

                        disabled={items.length === 1}

                        aria-label={`Remove product ${index + 1}`}

                        title="Remove product"

                      >

                        Remove

                      </button>

                    </div>

                  );

                })}

              </div>

              {products.length === 0 && (

                <p className="sales-orders-message">

                  No active products found. Add or activate products

                  in Inventory before creating an order.

                </p>

              )}

              <label className="sales-order-notes">

                Notes

                <textarea

                  value={notes}

                  onChange={(event) => setNotes(event.target.value)}

                  rows="3"

                  placeholder="Optional notes for this order"

                />

              </label>

              <section className="sales-order-charges">
                <div className="sales-order-items-heading">
                  <div>
                    <h3>Additional bill charges</h3>
                    <p>Optional charges such as labour, transport, loading, or delivery.</p>
                  </div>
                  <button type="button" className="sales-orders-secondary" onClick={addCharge}>
                    + Add charge
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
                          <option value="">Select charge category</option>
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
                          placeholder="Amount (₹)"
                        />
                        <button type="button" className="sales-order-remove" onClick={() => removeCharge(index)}>
                          Remove
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
                  + Add new charge category
                </button>
              </section>

              <div className="sales-order-totals">

                <h3>Order Summary</h3>

                <div>

                  <span>Subtotal</span>

                  <strong>{formatCurrency(totals.subtotal)}</strong>

                </div>

                {taxType === "INTRA" ? (

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

                <div>
                  <span>Total GST</span>

                  <strong>{formatCurrency(totals.totalTax)}</strong>

                </div>
                {totals.chargesTotal > 0 && (
                  <div>
                    <span>Additional charges</span>
                    <strong>{formatCurrency(totals.chargesTotal)}</strong>
                  </div>
                )}

                <div className="sales-order-grand-total">

                  <span>Total after tax</span>

                  <strong>

                    {formatCurrency(totals.grandTotal)}

                  </strong>

                </div>

              </div>

              <div className="sales-order-form-actions">

                <button

                  type="button"

                  className="sales-orders-secondary"

                  onClick={resetForm}

                  disabled={saving}

                >

                  Clear form

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

                  {saving ? "Saving..." : "Confirm & Create Order"}

                </button>

              </div>

            </>

          )}

        </form>
        </div>
      )}

      <div className="sales-orders-summary">
        <div className="sales-orders-summary-card is-blue"><span>Total sales value</span><strong>{formatCurrency(totalSales)}</strong><small>All recorded orders</small></div>
        <div className="sales-orders-summary-card is-green"><span>Orders this month</span><strong>{monthOrders.length}</strong><small>Based on order date</small></div>
        <div className="sales-orders-summary-card is-purple"><span>Confirmed orders</span><strong>{confirmedOrders.length}</strong><small>Stock has been deducted</small></div>
        <div className="sales-orders-summary-card is-amber"><span>Average order value</span><strong>{formatCurrency(averageOrder)}</strong><small>{orders.length} total orders</small></div>
        <div className="sales-orders-summary-card is-red"><span>Cancelled orders</span><strong>{cancelledOrders.length}</strong><small>Requires review</small></div>
        <div className="sales-orders-summary-card is-slate"><span>Total tax collected</span><strong>{formatCurrency(totalTax)}</strong><small>CGST, SGST and IGST</small></div>
      </div>

      {loading && (

        <p className="sales-orders-message">

          Loading sales orders...

        </p>

      )}

      {!loading && (
        <div className="sales-orders-directory">
          <div className="sales-orders-filters">
            <div>
              <h2>Sales order directory</h2>
              <p>Search orders and review their invoice details.</p>
            </div>
            <div className="sales-orders-filter-controls">
              <input
                type="search"
                value={orderSearch}
                placeholder="Search order, customer..."
                aria-label="Search sales orders"
                onChange={(event) => {
                  setOrderSearch(event.target.value);
                  setOrderPage(1);
                }}
              />
              <select value={statusFilter} aria-label="Filter order status" onChange={(event) => { setStatusFilter(event.target.value); setOrderPage(1); }}>
                <option value="ALL">All statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="DRAFT">Draft</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select value={dateFilter} aria-label="Filter order date" onChange={(event) => { setDateFilter(event.target.value); setOrderPage(1); }}>
                <option value="ALL">All dates</option>
                <option value="TODAY">Today</option>
                <option value="WEEK">Last 7 days</option>
                <option value="MONTH">Last 30 days</option>
              </select>
              <button type="button" className="sales-orders-secondary" onClick={() => { setOrderSearch(""); setStatusFilter("ALL"); setDateFilter("ALL"); setOrderPage(1); }}>Clear</button>
            </div>
          </div>
        <div className="sales-orders-table-wrapper">

          <table className="sales-orders-table">

            <thead>

              <tr>

                <th>Order Number</th>

                <th>Date</th>

                <th>Customer</th>

                <th>Status</th>

                <th className="sales-orders-amount">Total</th>
                <th>Actions</th>

              </tr>

            </thead>

            <tbody>

              {visibleOrders.length === 0 ? (

                <tr>

                  <td colSpan="6" className="sales-orders-empty">

                    No sales orders found.

                  </td>

                </tr>

              ) : (

                visibleOrders.map((order) => (

                  <tr key={order.id}>

                    <td>{order.orderNumber}</td>

                    <td>{order.orderDate}</td>

                    <td>{order.customerName}</td>

                    <td>

                      <span

                        className={`sales-orders-status sales-orders-status-${String(

                          order.status

                        ).toLowerCase()}`}

                      >

                        {order.status}

                      </span>

                    </td>

                    <td className="sales-orders-amount">

                      {formatCurrency(order.grandTotal)}

                    </td>
                    <td>
                      <button
                        type="button"
                        className="sales-orders-secondary"
                        onClick={() => openOrderDetails(order)}
                      >
                        View
                      </button>
                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>
        <div className="sales-orders-pagination">
          <span>Showing {filteredOrders.length ? (orderPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(orderPage * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length}</span>
          <div>
            <button type="button" disabled={orderPage <= 1} onClick={() => setOrderPage((current) => current - 1)}>Previous</button>
            <strong>Page {orderPage} of {orderPageCount}</strong>
            <button type="button" disabled={orderPage >= orderPageCount} onClick={() => setOrderPage((current) => current + 1)}>Next</button>
          </div>
        </div>
        </div>
      )}

      {detailsOrder && (
        <div className="sales-order-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetailsOrder(null)}>
          <section className="sales-order-details-modal" role="dialog" aria-modal="true" aria-labelledby="sales-order-details-title">
            <div className="sales-order-form-heading">
              <div><p className="sales-orders-overline">ORDER DETAILS</p><h2 id="sales-order-details-title">{detailsOrder.orderNumber}</h2><p>{detailsOrder.customerName} · {detailsOrder.orderDate}</p></div>
              <button type="button" className="sales-orders-refresh" onClick={() => setDetailsOrder(null)} aria-label="Close order details">Close</button>
            </div>
            <div className="sales-order-detail-summary">
              <div><span>Status</span><strong>{detailsOrder.status}</strong></div>
              <div><span>Tax type</span><strong>{detailsOrder.taxType}</strong></div>
              <div><span>Subtotal</span><strong>{formatCurrency(detailsOrder.subtotal)}</strong></div>
              <div><span>Total tax</span><strong>{formatCurrency(detailsOrder.totalTax)}</strong></div>
              {detailsOrder.charges?.length > 0 && <div><span>Additional charges</span><strong>{formatCurrency(detailsOrder.charges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0))}</strong></div>}
              <div><span>Grand total</span><strong>{formatCurrency(detailsOrder.grandTotal)}</strong></div>
              {paymentBalance && <div><span>Payment status</span><strong>{paymentBalance.paymentStatus}</strong></div>}
              {paymentBalance && <div><span>Outstanding</span><strong>{formatCurrency(paymentBalance.outstandingBalance)}</strong></div>}
            </div>
            <div className="sales-order-detail-items">
              <h3>Products</h3>
              {detailsOrder.items?.map((item) => <div className="sales-order-detail-item" key={item.id}><span>{item.productName} <small>{item.productCode}</small></span><span>{item.quantity} {item.unitCode} × {formatCurrency(item.unitPrice)} · GST {item.gstRate}%</span><strong>{formatCurrency(item.lineTotal)}</strong></div>)}
              {detailsOrder.charges?.map((charge) => <div className="sales-order-detail-item" key={`charge-${charge.id}`}><span>{charge.description}</span><strong>{formatCurrency(charge.amount)}</strong></div>)}
            </div>
            <div className="sales-order-form-actions">
              {canManagePayments && paymentBalance?.outstandingBalance > 0 && <button type="button" className="sales-orders-secondary" onClick={() => { setPaymentError(""); setShowPaymentForm(true); }}>Record payment</button>}
              <button type="button" className="sales-orders-secondary" onClick={() => { setInvoiceOrderId(detailsOrder.id); setDetailsOrder(null); }}>View / Print Invoice</button>
              <button type="button" className="sales-orders-primary" onClick={() => setDetailsOrder(null)}>Done</button>
            </div>
          </section>
        </div>
      )}

      {showPaymentForm && detailsOrder && (
        <div className="sales-order-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowPaymentForm(false)}>
          <form className="sales-order-details-modal sales-payment-modal" onSubmit={handlePaymentSubmit}>
            <div className="sales-order-form-heading"><div><p className="sales-orders-overline">PAYMENT COLLECTION</p><h2>Record payment</h2><p>{detailsOrder.orderNumber} · Balance {formatCurrency(paymentBalance?.outstandingBalance)}</p></div><button type="button" className="sales-orders-refresh" onClick={() => setShowPaymentForm(false)}>Close</button></div>
            <div className="sales-payment-grid">
              <label>Payment date<input type="date" max={today()} value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} required /></label>
              <label>Amount (₹)<input type="number" min="0.01" step="0.01" max={paymentBalance?.outstandingBalance} value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} required /></label>
              <label>Payment method<select value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethod: event.target.value })}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CHEQUE">Cheque</option><option value="CARD">Card</option><option value="OTHER">Other</option></select></label>
              <label>Reference number<input value={paymentForm.referenceNumber} onChange={(event) => setPaymentForm({ ...paymentForm, referenceNumber: event.target.value })} maxLength={100} /></label>
              <label className="sales-payment-full-width">Notes<textarea rows="3" value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} maxLength={1000} /></label>
            </div>
            {paymentError && <div className="sales-orders-error" role="alert">{paymentError}</div>}
            <div className="sales-order-form-actions"><button type="button" className="sales-orders-secondary" onClick={() => setShowPaymentForm(false)}>Cancel</button><button type="submit" className="sales-orders-primary" disabled={savingPayment}>{savingPayment ? "Saving..." : "Save payment"}</button></div>
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
                <p className="sales-orders-overline">BILLING SETUP</p>
                <h2>Add charge category</h2>
                <p>Use this category in future bills and expense records.</p>
              </div>
              <button type="button" className="sales-customer-modal-close" onClick={() => setShowChargeCategoryForm(false)} aria-label="Close">
                ×
              </button>
            </div>
            <label className="sales-charge-category-input">
              Category name
              <input
                autoFocus
                value={newChargeCategory}
                onChange={(event) => setNewChargeCategory(event.target.value)}
                placeholder="e.g. Cutting charges"
                maxLength={100}
                required
              />
            </label>
            <div className="sales-order-form-actions">
              <button type="button" className="sales-orders-secondary" onClick={() => setShowChargeCategoryForm(false)}>Cancel</button>
              <button type="submit" className="sales-orders-primary">Add category</button>
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
