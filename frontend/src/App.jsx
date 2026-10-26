import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import LoginPage from "./features/auth/LoginPage";
import DashboardPage from "./features/dashboard/DashboardPage";

// Pages load on first visit, so opening the app downloads only what it shows.
const InventoryPage = lazy(() => import("./features/inventory/InventoryPage"));
const CustomersPage = lazy(() => import("./features/customers/CustomersPage"));
const SalesOrdersPage = lazy(() => import("./features/sales-orders/SalesOrdersPage"));
const StockMovementsPage = lazy(() => import("./features/stock-movements/StockMovementsPage"));
const SuppliersPage = lazy(() => import("./features/suppliers/SuppliersPage"));
const PurchasesPage = lazy(() => import("./features/purchases/PurchasesPage"));
const ExpensesPage = lazy(() => import("./features/expenses/ExpensesPage"));
const ReportsPage = lazy(() => import("./features/reports/ReportsPage"));
const UserManagementPage = lazy(() => import("./features/users/UserManagementPage"));
import { getCurrentUser, logout } from "./services/api/authApi";
import { PermissionsProvider } from "./auth/PermissionsContext";
import { label } from "./utils/format";

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

const PAGE_TITLES = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  customers: "Customers",
  billing: "Sales & Billing",
  "stock-movements": "Stock History",
  suppliers: "Suppliers",
  purchases: "Purchases",
  expenses: "Expenses",
  reports: "Reports",
  users: "Users",
};

// Line icons, drawn on a 24px grid.
const ICON_PATHS = {
  dashboard: "M4 4h6.5v8H4zM13.5 4H20v4.5h-6.5zM13.5 11.5H20V20h-6.5zM4 15h6.5v5H4z",
  billing: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  inventory: "M12 3 3 7.5l9 4.5 9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5",
  customers: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.8.7 3 2.4 3.5 5.2",
  purchases: "M2.5 6h11v10h-11zM13.5 9.5h4l3 3.5v3h-7M7 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  suppliers: "M3 20.5V10l5.5 3.5V10l5.5 3.5V4h7v16.5zM17 8h1M17 12h1M17 16h1",
  expenses: "M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5zM3 10.5h18M16 15h2",
  "stock-movements": "M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4",
  reports: "M4 20V11M10 20V5M16 20v-6M21.5 20h-19",
  users: "M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6zM9 12l2.2 2.2L15.5 10",
  more: "M4 7h16M4 12h16M4 17h16",
};

function NavIcon({ name }) {
  return (
    <svg className="erp-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

const NAV_ITEMS = [
  { page: "dashboard", label: "Dashboard", shortLabel: "Home" },
  { page: "billing", label: "Sales & Billing", shortLabel: "Sell" },
  { page: "inventory", label: "Inventory", shortLabel: "Stock" },
  { page: "customers", label: "Customers" },
  { page: "purchases", label: "Purchases" },
  { page: "suppliers", label: "Suppliers" },
  { page: "expenses", label: "Expenses" },
  { page: "stock-movements", label: "Stock History" },
  { page: "reports", label: "Reports" },
  { page: "users", label: "Users" },
];

// Phones show these as bottom tabs; the rest sit under "More".
const MOBILE_TABS = ["dashboard", "billing", "inventory"];

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
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    function handleHashChange() {
      setCurrentPage(getCurrentPage());
      setMoreOpen(false);
    }

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (!moreOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moreOpen]);

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

  const currentTitle = PAGE_TITLES[currentPage] || PAGE_TITLES.dashboard;
  const navItems = NAV_ITEMS.filter((item) => canAccessPage(item.page));
  const mobileTabs = navItems.filter((item) => MOBILE_TABS.includes(item.page));
  const moreItems = navItems.filter((item) => !MOBILE_TABS.includes(item.page));
  const moreIsActive = moreItems.some((item) => item.page === currentPage);

  return (
    <div className="erp-layout">
      {/* Sidebar (desktop and tablet) */}
      <aside className="erp-sidebar">
        <a className="erp-brand" href="#dashboard">
          <div className="erp-brand-icon">IV</div>

          <div>
            <h2>Indra Vaibhav</h2>
            <p>Marble</p>
          </div>
        </a>

        <nav className="erp-nav" aria-label="Main menu">
          {navItems.map((item) => (
            <a
              key={item.page}
              className={`erp-nav-item ${currentPage === item.page ? "active" : ""}`}
              href={`#${item.page}`}
              aria-current={currentPage === item.page ? "page" : undefined}
            >
              <NavIcon name={item.page} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* Bottom tabs (phones) */}
      <nav className="erp-bottom-nav" aria-label="Main menu">
        {mobileTabs.map((item) => (
          <a
            key={item.page}
            className={`erp-bottom-tab ${currentPage === item.page ? "active" : ""}`}
            href={`#${item.page}`}
            aria-current={currentPage === item.page ? "page" : undefined}
            onClick={() => setMoreOpen(false)}
          >
            <NavIcon name={item.page} />
            <span>{item.shortLabel || item.label}</span>
          </a>
        ))}
        {moreItems.length > 0 && (
          <button
            type="button"
            className={`erp-bottom-tab ${moreOpen || moreIsActive ? "active" : ""}`}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <NavIcon name="more" />
            <span>More</span>
          </button>
        )}
      </nav>

      {moreOpen && (
        <div className="erp-more-backdrop" onClick={() => setMoreOpen(false)}>
          <div
            className="erp-more-sheet"
            role="dialog"
            aria-label="More pages"
            onClick={(event) => event.stopPropagation()}
          >
            {moreItems.map((item) => (
              <a
                key={item.page}
                className={`erp-more-item ${currentPage === item.page ? "active" : ""}`}
                href={`#${item.page}`}
                onClick={() => setMoreOpen(false)}
              >
                <NavIcon name={item.page} />
                <span>{item.label}</span>
              </a>
            ))}
            <button type="button" className="erp-more-logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="erp-workspace">
        {/* Topbar */}
        <header className="erp-topbar">
          <h1>{currentTitle}</h1>

          {/* Logged-in user */}
          <div className="erp-admin">
            <div className="erp-avatar" aria-hidden="true">
              {(session.fullName || session.name || session.email || "A")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>{session.fullName || session.name || "User"}</strong>
              <span>{(session.roles || []).map(label).join(", ") || "User"}</span>
            </div>
            <button type="button" className="erp-logout-button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="erp-content">
          <PermissionsProvider permissions={session.permissions}>
          <Suspense fallback={<p className="erp-page-loading">Loading…</p>}>
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
          </Suspense>
          </PermissionsProvider>
        </main>
      </div>
    </div>
  );
}

export default App;