
import "./DashboardPage.css";

const summaryCards = [
  {
    title: "Total Sales",
    value: "₹0.00",
    note: "Sales summary",
    icon: "₹",
  },
  {
    title: "Outstanding",
    value: "₹0.00",
    note: "Customer dues",
    icon: "↗",
  },
  {
    title: "Inventory Items",
    value: "0",
    note: "Products tracked",
    icon: "▦",
  },
  {
    title: "Supplier Dues",
    value: "₹0.00",
    note: "Pending payments",
    icon: "◷",
  },
];

const modules = [
  {
    icon: "▦",
    title: "Inventory",
    description: "Manage marble, granite, tiles and sanitaryware",
    href: "#inventory",
  },
  {
    icon: "♙",
    title: "Customers",
    description: "Customer details and outstanding balances",
    href: "#customers",
  },
  {
    icon: "▤",
    title: "Sales & Billing",
    description: "Create invoices and record payments",
    href: "#billing",
  },
  {
    icon: "⇄",
    title: "Purchases",
    description: "Supplier purchases and purchase history",
    href: "#purchases",
  },
  {
    icon: "₹",
    title: "Expenses",
    description: "Track business expenses and payments",
    href: "#expenses",
  },
  {
    icon: "▧",
    title: "Reports",
    description: "Review sales, purchases and business activity",
    href: "#reports",
  },
];

function DashboardPage() {
  return (
    <div className="dashboard-content">
      <section className="erp-welcome">
        <div>
          <p className="erp-eyebrow">INDRA VAIBHAV MARBLE</p>
          <h2>Your business, at a glance.</h2>
          <p>
            Manage your products, customers, billing and purchases from one
            place.
          </p>
        </div>

        <div className="erp-welcome-mark">IV</div>
      </section>

      <section className="erp-summary-grid" aria-label="Business summaries">
        {summaryCards.map((card) => (
          <article className="erp-summary-card" key={card.title}>
            <div className="erp-summary-top">
              <span>{card.title}</span>
              <span className="erp-summary-icon">{card.icon}</span>
            </div>

            <h3>{card.value}</h3>
            <p>{card.note}</p>
          </article>
        ))}
      </section>

      <section className="erp-section">
        <div className="erp-section-heading">
          <div>
            <h2>Business Modules</h2>
            <p>Choose a module to manage your business.</p>
          </div>
        </div>

        <div className="erp-module-grid">
          {modules.map((module) => (
            <a
              className="erp-module-card"
              key={module.title}
              href={module.href}
            >
              <div className="erp-module-icon">{module.icon}</div>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              <span className="erp-module-arrow">Explore module →</span>
            </a>
          ))}
        </div>
      </section>

      <footer className="erp-footer">
        Indra Vaibhav Marble ERP <span>•</span> Dashboard
      </footer>
    </div>
  );
}

export default DashboardPage;
