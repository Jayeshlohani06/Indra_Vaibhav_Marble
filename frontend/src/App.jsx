
import { useEffect, useState } from "react";

import LoginPage from "./features/auth/LoginPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import InventoryPage from "./features/inventory/InventoryPage";
import CustomersPage from "./features/customers/CustomersPage";
import SalesOrdersPage from "./features/sales-orders/SalesOrdersPage";
import StockMovementsPage from "./features/stock-movements/StockMovementsPage";
import SuppliersPage from "./features/suppliers/SuppliersPage";

import "./App.css";

const VALID_PAGES = [
  "dashboard",
  "inventory",
  "customers",
  "billing",
  "stock-movements",
  "suppliers",
];

function getCurrentPage() {
  const page = window.location.hash.replace("#", "");

  return VALID_PAGES.includes(page) ? page : "dashboard";
}

function App() {
  const [session, setSession] = useState(null);
  const [currentPage, setCurrentPage] = useState(getCurrentPage);

  useEffect(() => {
    function handleHashChange() {
      setCurrentPage(getCurrentPage());
    }

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  function handleLoginSuccess(response) {
    setSession(response.user);
  }

  if (!session) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const pageTitles = {
    dashboard: {
      breadcrumb: "Dashboard",
      title: "Business Overview",
    },
    inventory: {
      breadcrumb: "Inventory",
      title: "Inventory Management",
    },
    customers: {
      breadcrumb: "Customers",
      title: "Customer Management",
    },
    billing: {
      breadcrumb: "Sales & Billing",
      title: "Sales & Billing",
    },
    "stock-movements": {
      breadcrumb: "Stock Movement History",
      title: "Stock Movement History",
    },
    suppliers: {
      breadcrumb: "Suppliers",
      title: "Supplier Management",
    },
  };

  const currentTitle = pageTitles[currentPage] || pageTitles.dashboard;

  return (
    <div className="erp-layout">
      {/* Sidebar */}
      <aside className="erp-sidebar">
        <a className="erp-brand" href="#dashboard">
          <div className="erp-brand-icon">IV</div>

          <div>
            <h2>Indra Vaibhav</h2>
            <p>MARBLE ERP</p>
          </div>
        </a>

        <p className="erp-nav-label">WORKSPACE</p>

        <nav className="erp-nav">
          {/* Dashboard */}
          <a
            className={`erp-nav-item ${
              currentPage === "dashboard" ? "active" : ""
            }`}
            href="#dashboard"
          >
            <span className="erp-nav-icon">▦</span>
            <span>Dashboard</span>
          </a>

          {/* Inventory */}
          <a
            className={`erp-nav-item ${
              currentPage === "inventory" ? "active" : ""
            }`}
            href="#inventory"
          >
            <span className="erp-nav-icon">▤</span>
            <span>Inventory</span>
          </a>

          {/* Stock Movement History */}
          <a
            className={`erp-nav-item ${
              currentPage === "stock-movements" ? "active" : ""
            }`}
            href="#stock-movements"
          >
            <span className="erp-nav-icon">↕</span>
            <span>Stock Movements</span>
          </a>

          {/* Customers */}
          <a
            className={`erp-nav-item ${
              currentPage === "customers" ? "active" : ""
            }`}
            href="#customers"
          >
            <span className="erp-nav-icon">♙</span>
            <span>Customers</span>
          </a>

          {/* Sales & Billing */}
          <a
            className={`erp-nav-item ${
              currentPage === "billing" ? "active" : ""
            }`}
            href="#billing"
          >
            <span className="erp-nav-icon">₹</span>
            <span>Sales &amp; Billing</span>
          </a>

          {/* Purchases — coming later */}
          <a className="erp-nav-item" href="#purchases">
            <span className="erp-nav-icon">⇄</span>
            <span>Purchases</span>
          </a>

          {/* Suppliers */}
          <a
            className={`erp-nav-item ${
              currentPage === "suppliers" ? "active" : ""
            }`}
            href="#suppliers"
          >
            <span className="erp-nav-icon">♧</span>
            <span>Suppliers</span>
          </a>

          {/* Expenses — coming later */}
          <a className="erp-nav-item" href="#expenses">
            <span className="erp-nav-icon">₹</span>
            <span>Expenses</span>
          </a>

          {/* Reports — coming later */}
          <a className="erp-nav-item" href="#reports">
            <span className="erp-nav-icon">▥</span>
            <span>Reports</span>
          </a>
        </nav>

        {/* Sidebar Footer */}
        <div className="erp-sidebar-footer">
          <span className="erp-status-dot" />
          <span>Backend connected</span>
          <small>Indra Vaibhav Marble</small>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="erp-workspace">
        {/* Topbar */}
        <header className="erp-topbar">
          <div>
            <p className="erp-breadcrumb">
              Workspace / {currentTitle.breadcrumb}
            </p>

            <h1>{currentTitle.title}</h1>
          </div>

          {/* Logged-in Administrator */}
          <div className="erp-admin">
            <div className="erp-avatar">
              {(session.name || session.email || "A")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>{session.name || "Administrator"}</strong>
              <span>{session.role || "ADMIN"}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="erp-content">
          {currentPage === "inventory" ? (
            <InventoryPage />
          ) : currentPage === "customers" ? (
            <CustomersPage />
          ) : currentPage === "billing" ? (
            <SalesOrdersPage />
          ) : currentPage === "stock-movements" ? (
            <StockMovementsPage />
          ) : currentPage === "suppliers" ? (
            <SuppliersPage />
          ) : (
            <DashboardPage />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
