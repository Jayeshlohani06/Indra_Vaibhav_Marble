import { useCallback, useEffect, useMemo, useState } from "react";

import LoginPage from "./features/auth/LoginPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import InventoryPage from "./features/inventory/InventoryPage";
import CustomersPage from "./features/customers/CustomersPage";
import SalesOrdersPage from "./features/sales-orders/SalesOrdersPage";
import StockMovementsPage from "./features/stock-movements/StockMovementsPage";
import SuppliersPage from "./features/suppliers/SuppliersPage";
import PurchasesPage from "./features/purchases/PurchasesPage";
import ExpensesPage from "./features/expenses/ExpensesPage";
import ReportsPage from "./features/reports/ReportsPage";
import UserManagementPage from "./features/users/UserManagementPage";
import { getCurrentUser, logout } from "./services/api/authApi";
import { PermissionsProvider } from "./auth/PermissionsContext";

import "./App.css";

const VALID_PAGES = [
  "dashboard",
  "inventory",
  "customers",
  "billing",
  "stock-movements",
  "suppliers",
  "purchases",
  "expenses",
  "reports",
  "users",
];

const PAGE_PERMISSIONS = {
  inventory: "PRODUCT_READ",
  "stock-movements": "INVENTORY_READ",
  customers: "CUSTOMER_READ",
  billing: "SALES_READ",
  purchases: "PURCHASE_READ",
  suppliers: "SUPPLIER_READ",
  expenses: "EXPENSE_READ",
  reports: "REPORT_READ",
  users: "USER_READ",
};

const PERMISSION_REFRESH_MS = 5 * 60 * 1000;

function getCurrentPage() {
  const page = window.location.hash.replace("#", "");

  return VALID_PAGES.includes(page) ? page : "dashboard";
}

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("indra-vaibhav-user") || "null");
    } catch {
      return null;
    }
  });
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

  useEffect(() => {
    function handleAuthExpired() {
      sessionStorage.removeItem("indra-vaibhav-user");
      setSession(null);
      window.location.hash = "#dashboard";
    }

    window.addEventListener("auth-expired", handleAuthExpired);
    return () => window.removeEventListener("auth-expired", handleAuthExpired);
  }, []);

  const isLoggedIn = Boolean(session);

  // Keep roles and permissions in sync with the server so an admin's changes
  // apply without the user logging in again.
  useEffect(() => {
    if (!isLoggedIn) return undefined;

    let cancelled = false;

    async function refreshCurrentUser() {
      try {
        const user = await getCurrentUser();
        if (cancelled || !user) return;
        setSession((current) => {
          if (JSON.stringify(current) === JSON.stringify(user)) return current;
          sessionStorage.setItem("indra-vaibhav-user", JSON.stringify(user));
          return user;
        });
      } catch {
        // Keep the current session; an expired token is handled by auth-expired.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") refreshCurrentUser();
    }

    refreshCurrentUser();
    const interval = window.setInterval(refreshCurrentUser, PERMISSION_REFRESH_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLoggedIn]);

  function handleLoginSuccess(response) {
    setSession(response.user);
    sessionStorage.setItem("indra-vaibhav-user", JSON.stringify(response.user));
  }

  function handleLogout() {
    logout();
    sessionStorage.removeItem("indra-vaibhav-user");
    setSession(null);
    window.location.hash = "#dashboard";
  }

  const permissions = useMemo(
    () => new Set(session?.permissions || []),
    [session]
  );
  const canAccessPage = useCallback(
    (page) => page === "dashboard" || permissions.has(PAGE_PERMISSIONS[page]),
    [permissions]
  );

  useEffect(() => {
    if (session && !canAccessPage(currentPage)) {
      window.location.hash = "#dashboard";
    }
  }, [session, currentPage, canAccessPage]);

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
    purchases: {
      breadcrumb: "Purchases",
      title: "Purchase Management",
    },
    expenses: {
      breadcrumb: "Expenses",
      title: "Expense Management",
    },
    reports: {
      breadcrumb: "Reports",
      title: "Financial Reports",
    },
    users: {
      breadcrumb: "User Management",
      title: "User Management",
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

          {canAccessPage("inventory") && <a
            className={`erp-nav-item ${
              currentPage === "inventory" ? "active" : ""
            }`}
            href="#inventory"
          >
            <span className="erp-nav-icon">▤</span>
            <span>Inventory</span>
          </a>}

          {canAccessPage("stock-movements") && <a
            className={`erp-nav-item ${
              currentPage === "stock-movements" ? "active" : ""
            }`}
            href="#stock-movements"
          >
            <span className="erp-nav-icon">↕</span>
            <span>Stock Movements</span>
          </a>}

          {canAccessPage("customers") && <a
            className={`erp-nav-item ${
              currentPage === "customers" ? "active" : ""
            }`}
            href="#customers"
          >
            <span className="erp-nav-icon">♙</span>
            <span>Customers</span>
          </a>}

          {canAccessPage("billing") && <a
            className={`erp-nav-item ${
              currentPage === "billing" ? "active" : ""
            }`}
            href="#billing"
          >
            <span className="erp-nav-icon">₹</span>
            <span>Sales &amp; Billing</span>
          </a>}

          {canAccessPage("purchases") && <a
            className={`erp-nav-item ${
              currentPage === "purchases" ? "active" : ""
            }`}
            href="#purchases"
          >
            <span className="erp-nav-icon">⇄</span>
            <span>Purchases</span>
          </a>}

          {canAccessPage("suppliers") && <a
            className={`erp-nav-item ${
              currentPage === "suppliers" ? "active" : ""
            }`}
            href="#suppliers"
          >
            <span className="erp-nav-icon">♧</span>
            <span>Suppliers</span>
          </a>}

          {canAccessPage("expenses") && <a
            className={`erp-nav-item ${
              currentPage === "expenses" ? "active" : ""
            }`}
            href="#expenses"
          >
            <span className="erp-nav-icon">₹</span>
            <span>Expenses</span>
          </a>}

          {canAccessPage("reports") && <a
            className={`erp-nav-item ${
              currentPage === "reports" ? "active" : ""
            }`}
            href="#reports"
          >
            <span className="erp-nav-icon">▥</span>
            <span>Reports</span>
          </a>}
          {canAccessPage("users") && <a className={`erp-nav-item ${currentPage === "users" ? "active" : ""}`} href="#users"><span className="erp-nav-icon">♙</span><span>User Management</span></a>}
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
              {(session.fullName || session.name || session.email || "A")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>{session.fullName || session.name || "User"}</strong>
              <span>{(session.roles || []).join(", ") || "USER"}</span>
            </div>
            <button type="button" className="erp-logout-button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="erp-content">
          <PermissionsProvider permissions={session.permissions}>
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
          ) : currentPage === "purchases" ? (
            <PurchasesPage />
          ) : currentPage === "expenses" ? (
            <ExpensesPage />
          ) : currentPage === "reports" ? (
            <ReportsPage />
          ) : currentPage === "users" ? (
            <UserManagementPage isAdmin={(session.roles || []).includes("ADMIN")} />
          ) : (
            <DashboardPage />
          )}
          </PermissionsProvider>
        </main>
      </div>
    </div>
  );
}

export default App;