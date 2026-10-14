import { useCallback, useEffect, useState } from "react";

import {

  getSalesOrders,

  createSalesOrder,

} from "../../services/api/salesOrderApi";

import {

  getCustomers,

  createCustomer,

} from "../../services/api/customerApi";

import {

  getProducts,

  getMeasurementUnits,

} from "../../services/api/inventoryApi";

import "./SalesOrdersPage.css";
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

function calculateTotals(items, taxType) {

  let subtotal = 0;

  let cgstAmount = 0;

  let sgstAmount = 0;

  let igstAmount = 0;

  for (const item of items) {

    const quantity = Number(item.quantity) || 0;

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

    grandTotal: roundMoney(subtotal + totalTax),

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

  unitPrice: "",

  gstRate: 0,

};

function SalesOrdersPage() {

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
  const [invoiceOrderId, setInvoiceOrderId] = useState(null);

  const [customerId, setCustomerId] = useState("");

  const [orderDate, setOrderDate] = useState(today());

  const [taxType, setTaxType] = useState("INTRA");

  const [notes, setNotes] = useState("");

  const [items, setItems] = useState([{ ...emptyOrderItem }]);

  const [customerForm, setCustomerForm] = useState({

    ...emptyCustomerForm,

  });

  const loadOrders = useCallback(async () => {

    const data = await getSalesOrders();

    setOrders(Array.isArray(data) ? data : []);

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

      setError(err.message || "Unable to load sales orders.");

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

    setItems([{ ...emptyOrderItem }]);

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

      // The current backend requires a unique customer code.

      const customerCode = `C-${Date.now()}`;

      const payload = {

        customerCode,

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

    }

    const order = {

      customerId: Number(customerId),

      orderDate,

      taxType,

      notes: notes.trim(),

      items: items.map((item) => ({

        productId: Number(item.productId),

        quantity: Number(item.quantity),

        unitPrice: Number(item.unitPrice),

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

  const totals = calculateTotals(items, taxType);

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

          <button

            type="button"

            className="sales-orders-primary"

            onClick={openCreateForm}

          >

            + Create Sales Order

          </button>

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

        <form className="sales-order-form" onSubmit={handleSubmit}>

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

                    <button

                      type="button"

                      className="sales-orders-add-customer"

                      onClick={() => {

                        setError("");

                        setShowCustomerForm(true);

                      }}

                    >

                      + Add New Customer

                    </button>

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

                            Available stock: {product.stockQuantity}{" "}

                            {unit}

                          </small>

                        )}

                      </label>

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

                <div className="sales-order-grand-total">

                  <span>Grand Total</span>

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

                  {saving ? "Saving..." : "Save Draft Order"}

                </button>

              </div>

            </>

          )}

        </form>

      )}

      {/* Sales Orders Summary */}

      <div className="sales-orders-summary">

        <div className="sales-orders-summary-card">

          <span>Total orders</span>

          <strong>{orders.length}</strong>

        </div>

        <div className="sales-orders-summary-card">

          <span>Draft orders</span>

          <strong>

            {orders.filter((order) => order.status === "DRAFT").length}

          </strong>

        </div>

        <div className="sales-orders-summary-card">

          <span>Total order value</span>

          <strong>

            {formatCurrency(

              orders.reduce(

                (total, order) =>

                  total + Number(order.grandTotal || 0),

                0

              )

            )}

          </strong>

        </div>

      </div>

      {loading && (

        <p className="sales-orders-message">

          Loading sales orders...

        </p>

      )}

      {!loading && (

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

              {orders.length === 0 ? (

                <tr>

                  <td colSpan="6" className="sales-orders-empty">

                    No sales orders found.

                  </td>

                </tr>

              ) : (

                orders.map((order) => (

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
                        onClick={() => setInvoiceOrderId(order.id)}
                      >
                        View / Print
                      </button>
                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

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
