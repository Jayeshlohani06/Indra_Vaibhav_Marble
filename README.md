# Indra Vaibhav Marble — Shop Management System

A web app for running a marble and granite shop: billing, stock, purchases,
customers, suppliers, expenses, payments and reports, with staff logins and
role-based access.

- **Backend:** Java 17, Spring Boot 4, Spring Security (JWT), JPA/Hibernate, Flyway, PostgreSQL
- **Frontend:** React 19 with Vite, plain CSS
- **Deployment:** backend as a Docker container, frontend as a static site (both on Render)

---

## What the app does

| Area | What staff can do |
| --- | --- |
| **Sales & Billing** | Make GST bills (`INV-0001`) or bills without GST, called estimates (`EST-0001`). Search customers and products, add extra charges (loading, transport), and print or save the bill as a PDF. |
| **Payments** | Record part or full payments on a bill. See Paid / Part-paid / Unpaid and the amount still due. |
| **Returns & cancelling** | Take back part of a bill or cancel the whole bill. Stock goes back automatically and any overpayment is recorded as a refund (`RET-0001`). The original bill is never edited. |
| **Inventory** | Products with category, unit (plus an optional second unit, e.g. boxes and square feet), prices, GST rate and HSN code. Low-stock alerts and manual stock corrections. |
| **Stock history** | Every stock change (sale, purchase, return or correction) with stock before and after, and the reason. |
| **Purchases** | Supplier invoices with GST, discounts and extra costs. Stock is added when a purchase is received. Payments to suppliers. |
| **Customers / Suppliers** | Contact and GST details, plus what each one owes or is owed. |
| **Expenses** | Shop expenses by category. |
| **Reports & Dashboard** | Sales, purchases and expenses for a period, money owed both ways, and today's figures. |
| **Users** | Staff accounts with roles. Deactivating a user blocks them on their next request. |

**Roles:** `ADMIN`, `OWNER`, `ACCOUNTANT`, `SALESPERSON`, `INVENTORY_MANAGER`
and `VIEWER`. Each role is a set of permissions (`SALES_READ`, `SALES_MANAGE`,
`PAYMENT_MANAGE`, …). The app shows only the pages a user's permissions allow,
and the server checks the same permissions on every request.

---

## Folder structure

```
indra-vaibhav-marble/
├── .github/workflows/
│   ├── ci.yml                 Backend tests, frontend lint/tests/build on every push and PR
│   └── backup.yml             Nightly encrypted database backup to Cloudflare R2
├── .env.example               Environment variables for the deployed backend
├── DEPLOYMENT.md              Step-by-step Render setup, backups and going live
├── backend/                   Spring Boot API
│   ├── Dockerfile             Production image (build context = repository root)
│   ├── pom.xml, mvnw          Maven build (use ./mvnw, no Maven install needed)
│   └── src/
│       ├── main/java/com/indravaibhavmarble/
│       │   ├── auth/            Login, JWT filter, logged-in user cache, first-admin setup
│       │   ├── user/ role/ permission/   Staff accounts, roles and permissions
│       │   ├── customer/  supplier/      Customer and supplier records
│       │   ├── product/  category/  unit/   Product catalogue
│       │   ├── inventory/       Stock settings and marble slabs
│       │   ├── stockmovement/   Stock history (every in/out)
│       │   ├── salesorder/      Bills, estimates, payments, returns and cancellations
│       │   ├── purchase/        Purchases and supplier payments
│       │   ├── expense/         Expenses and expense categories
│       │   ├── report/          Reports and dues
│       │   ├── health/          /api/health check used by the host
│       │   └── common/          Security config, error handling, shared helpers
│       ├── main/resources/
│       │   ├── application.properties          Shared settings
│       │   ├── application-dev.properties      Local development
│       │   ├── application-render.properties   Production (Render)
│       │   └── db/migration/                   Database schema (Flyway V1…V28)
│       └── test/java/…          Unit and integration tests
└── frontend/                  React app
    ├── index.html, vite.config.js, eslint.config.js, package.json
    ├── vitest.config.js, playwright.config.js   Test setup (see "Tests and checks")
    ├── .env.example           VITE_API_BASE_URL (backend address)
    ├── public/                Favicon and installable-app icons
    ├── e2e/                   Browser tests: phone layout, installable app, desktop
    │   └── fixtures/api.json  Recorded API answers the browser tests use
    └── src/
        ├── main.jsx, App.jsx  Entry point, layout, navigation and page routing
        ├── features/          One folder per page (auth, dashboard, sales-orders,
        │                      inventory, purchases, customers, suppliers, expenses,
        │                      stock-movements, reports, users). Each holds the page
        │                      and its CSS; sales-orders also holds the printable bill.
        ├── components/        Shared pieces (searchable dropdown, row menu)
        ├── services/          API calls (api/*.js) and the HTTP client (http/)
        ├── auth/              Permission context used to show/hide actions
        ├── styles/            Design tokens, theme, global CSS and the phone
        │                      layout (mobile.css)
        ├── utils/             Formatting (dates, money, labels) and GST helpers
        └── assets/            Background image
```

Each backend module follows the same layout: `controller/` (REST endpoints),
`service/` (business rules), `repository/` (database access), `entity/`
(tables) and `dto/` (request and response shapes).

---

## Running it locally

### Requirements

- Java 17
- Node.js 22
- PostgreSQL 16 (any recent version works)

### 1. Database

Create an empty database. Flyway creates all the tables on first start.

```sql
CREATE DATABASE indra_vaibhav_marble;
```

### 2. Backend (port 8081)

Create `backend/src/main/resources/application-local-secrets.properties`.
Git ignores this file, so it never gets committed.

```properties
DB_PASSWORD=your-postgres-password
JWT_SECRET=a-long-random-base64-string
```

Generate a JWT secret with `openssl rand -base64 32`. Then start the backend:

```bash
cd backend
./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run
```

It connects to `localhost:5432` as `postgres` and listens on
`http://localhost:8081`.

**First login:** the first time, create an admin by starting once with
`BOOTSTRAP_ADMIN_ENABLED=true`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`
and `BOOTSTRAP_ADMIN_PASSWORD` set. Then turn it off again.

### 3. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. In development the app calls
`http://localhost:8081` unless `VITE_API_BASE_URL` is set.

### Tests and checks

```bash
cd backend && ./mvnw test        # needs the local database; tests roll back their data
cd frontend && npm run lint
cd frontend && npm test          # unit tests (login storage, install banner, cash book)
cd frontend && npm run test:e2e  # browser tests on phone sizes and desktop
```

The first `npm run test:e2e` needs the browser once:
`npx playwright install chromium`. The browser tests build the app and answer
its API calls from `frontend/e2e/fixtures/api.json`, so no backend or
database is needed. If a page starts calling a new endpoint, the test fails
with "No recorded API answer for …". To refresh the recordings, run a
backend with **sample data only** (the file is committed) and a
`admin@test.local` / `MobileTest#2026` admin, then run
`RECORD_API=http://localhost:8081 npm run test:e2e`.

---

## Configuration

The backend uses the `dev` profile by default. Production sets
`SPRING_PROFILES_ACTIVE=render`.

| Variable | Where | Purpose |
| --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | backend | `dev` (default) or `render` |
| `SPRING_DATASOURCE_URL`, `_USERNAME`, `_PASSWORD` | backend (render) | PostgreSQL connection |
| `DB_PASSWORD` | backend (dev) | Local PostgreSQL password |
| `JWT_SECRET` | backend | Signs login tokens. Required. Keep it secret. |
| `JWT_EXPIRATION_MS` | backend (render) | Login length (default 8 hours) |
| `FRONTEND_URL` | backend | Frontend address allowed by CORS |
| `BOOTSTRAP_ADMIN_ENABLED` + `BOOTSTRAP_ADMIN_NAME/EMAIL/PASSWORD` | backend | Creates the first admin; switch off afterwards |
| `DATA_RESET_ENABLED` | backend | Allows "Remove business data" on the Users page. **On in dev, off in production.** |
| `DB_POOL_MAX_SIZE` | backend (render) | Database connection pool size (default 5, so two versions fit during a deploy) |
| `VITE_API_BASE_URL` | frontend build | Backend address. The production build fails without it. |

See [.env.example](.env.example) and [frontend/.env.example](frontend/.env.example).

---

## Deployment

**Step-by-step setup (free plans for testing, then production): see
[DEPLOYMENT.md](DEPLOYMENT.md).**

Everything runs on Render on fixed-price plans, so the bill doesn't grow on
its own:

| Part | Render plan | About |
| --- | --- | --- |
| Backend | Web Service **Starter**, 1 instance, autoscaling off | $7 / month |
| Database | Postgres **Basic-256mb**, fixed 5 GB storage | $7.50 / month |
| Frontend | Static Site | free |
| Off-site backups | GitHub Actions + Cloudflare R2 | free |

Don't use the Free plans in production. The free backend sleeps, and the free
database is deleted after 30 days with no backups.

**Backend (Docker web service).** Build with `backend/Dockerfile`, using the
repository root as the build context. Set the variables above with
`SPRING_PROFILES_ACTIVE=render`, and check that `DATA_RESET_ENABLED` is not set.
The container listens on `$PORT` (default 8080). Database migrations run
automatically on start-up.

- **Health Check Path:** `/api/health`. It returns 503 when the database can't
  be reached, so Render never switches traffic to a broken deploy.
- **Auto-Deploy:** from `main`, set to "After CI checks pass".
- **No persistent disk.** Attaching one turns off zero-downtime deploys.

Each deploy starts the new version next to the old one and switches traffic
only once the new one is healthy. If the new version fails, the old one keeps
running. The server also finishes requests already in progress before it
stops (`server.shutdown=graceful`).

**Frontend (static site).** Use build command
`cd frontend && npm ci && npm run build`, with `VITE_API_BASE_URL` set to the
backend URL, and publish directory `frontend/dist`. The app uses hash URLs
(`/#billing`), so no rewrite rules are needed.

**CI.** [.github/workflows/ci.yml](.github/workflows/ci.yml) runs the backend
tests against a PostgreSQL service, plus the frontend lint, unit tests, build
and browser tests (failed runs keep a `playwright-report` download), on every
push to `main`/`develop` and on every pull request.

---

## Backups and restore

There are three separate layers, so one failure never means lost data:

| Layer | What it gives you | Kept for |
| --- | --- | --- |
| Render point-in-time recovery | The database as it was at **any minute** in the window | 3 days |
| Render backups | A full copy, downloadable from the database's **Recovery** page | a few days |
| Nightly off-site backup ([backup.yml](.github/workflows/backup.yml)) | An encrypted copy in Cloudflare R2, outside Render | 30 daily + 12 monthly |

### Setting up the nightly backup (once)

1. In Cloudflare, create an R2 bucket. Add two lifecycle rules: delete objects
   under `daily/` after 30 days, and under `monthly/` after 365 days.
2. Create an R2 API token with **Object Read & Write** on that bucket.
3. In GitHub → Settings → Secrets and variables → Actions, add the secrets
   `DATABASE_URL` (Render's *External Database URL*), `BACKUP_PASSPHRASE`,
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`.
4. Keep `BACKUP_PASSPHRASE` somewhere safe outside GitHub, such as a password
   manager. **Without it no backup can be opened.**
5. Open Actions → **Database backup** → **Run workflow** to take the first
   backup, and check a file appears in the bucket.

The job runs every night at 02:00 IST. It checks each backup is complete
before uploading it. GitHub emails you if a run fails, so leave Actions
failure notifications on.

### Restoring

**A mistake in the last 3 days** (wrong delete, bad edit): on Render, open the
database → **Recovery** → restore to a time just before the mistake. Render
creates a new database. Check it, then point the backend's
`SPRING_DATASOURCE_*` variables at it.

**Anything older, or if Render is unavailable:** use an off-site backup.

```bash
# 1. Download a file from the R2 bucket (daily/ or monthly/), then decrypt it
gpg --decrypt --output backup.dump indra-vaibhav-marble_2026-10-27_2030.dump.gpg

# 2. Load it into an empty database (a new Render database, or a local one to check it)
createdb indra_restore
pg_restore --no-owner --no-privileges -d indra_restore backup.dump
```

Then point the backend at the restored database and restart it.

**Test a restore once a month.** Load the latest off-site backup into a local
database as shown above, and check that recent bills are there.

**Before a big update**, take a manual backup from the database's Recovery page
first.

---

## Working on the code

- **Branches:** work on `develop`, then merge to `main` through a pull request
  once CI passes.
- **Database changes:** always add a new migration, `V29__short_description.sql`,
  `V30__…`, and so on. Never edit a migration that has already run, because
  Flyway checks them.
- **Money and stock** are changed only by the server, inside one transaction
  per action. Bills, returns and purchases each record their own stock
  movement, so stock history always matches.
- **Document numbers:** `INV-` GST bills, `EST-` estimates, `RET-` returns and
  `PUR-` purchases. Each comes from its own database sequence, so there are no
  duplicates.
