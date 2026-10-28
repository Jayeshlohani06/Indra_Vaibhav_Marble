# Deployment Guide (testing on free plans → production)

This guide sets up the app on Render's **free plans** during testing, with the
same setup production will use. Going live is then only a plan upgrade
([Part 9](#part-9--going-live-switching-to-paid)).

Do the parts in order. Each step ends with a **✅ Check**; don't move on until
it passes.

| Part | What | Time |
| --- | --- | --- |
| 1 | Prepare: accounts, passwords, branch | 15 min |
| 2 | Database (Render Postgres) | 5 min |
| 3 | Backend (Render Web Service) | 15 min |
| 4 | Frontend (Render Static Site) | 10 min |
| 5 | Connect frontend ↔ backend, first login | 10 min |
| 6 | Safe deploys (health check, deploy only after CI passes) | 5 min |
| 7 | Nightly off-site backups (Cloudflare R2 + GitHub) | 20 min |
| 8 | Routine: weekly and monthly checks | — |
| 9 | Going live: switch to paid | 15 min |

**Free plans have limits:**

- The **free database is deleted** 30 days after it is created (plus a 14-day
  grace period). It has no automatic backups. Part 7 covers the backups.
- The **free backend sleeps** after 15 minutes without use. The first request
  after that takes about a minute while it wakes up.

Use only test data until you finish Part 9.

---

## Part 1 — Prepare

**1.1 Accounts you need**

- GitHub, which holds the code: `Jayeshlohani06/Indra_Vaibhav_Marble`
- [Render](https://render.com). Sign up with GitHub so it can see the repository.
- [Cloudflare](https://dash.cloudflare.com), for R2 backup storage. R2 asks for
  a payment card, but the first 10 GB are free.

**1.2 Make three secrets and store them in a password manager now**

Run these in Git Bash. Each one prints a random value.

```bash
openssl rand -base64 32   # → JWT_SECRET          (signs logins)
openssl rand -base64 32   # → BACKUP_PASSPHRASE   (encrypts backups)
openssl rand -base64 18   # → first admin password (at least 12 characters)
```

> ⚠️ If you lose `BACKUP_PASSPHRASE`, **no backup can ever be opened**. Keep it
> outside GitHub and Render.

**1.3 Put the latest code on `main`**

Render deploys from `main`. Merge `develop` into `main` with a pull request,
and wait until the CI check is green.

✅ **Check:** On GitHub, the latest commit on `main` shows a green tick.

**1.4 Pick one region for everything**

Use **Singapore**, the closest to India, for the database, backend and
frontend. Everything must be in the same region, or the backend can't use the
database's fast private address.

---

## Part 2 — Database (Render Postgres)

1. Render dashboard → **New +** → **Postgres**.
2. Fill in:
   - **Name:** `indra-vaibhav-marble-db`
   - **Database:** `indra_vaibhav_marble`
   - **User:** `indra_app`
   - **Region:** Singapore
   - **PostgreSQL version:** the default. Note the number; you need it in Part 7.
   - **Plan:** Free
3. Click **Create Database** and wait until it shows **Available**.
4. Open the database → **Info** (or **Connect**) and copy these into your
   password manager:
   - **Hostname** from the *Internal* connection, e.g. `dpg-abc123-a`
   - **Port** (5432), **Database**, **Username**, **Password**
   - **External Database URL**, which starts `postgresql://…render.com/…`.
     You need it for backups in Part 7.
5. **Put a reminder in your calendar 25 days from today:** "Upgrade Render
   database before it expires."

✅ **Check:** The database status is **Available**, and you've saved the
internal hostname and the External Database URL.

---

## Part 3 — Backend (Render Web Service)

1. **New +** → **Web Service** → choose the GitHub repo
   `Indra_Vaibhav_Marble`.
2. Fill in:
   - **Name:** `indra-vaibhav-marble-api`
   - **Language / Runtime:** Docker
   - **Branch:** `main`
   - **Region:** Singapore, the same as the database
   - **Root Directory:** leave **empty**
   - **Dockerfile Path:** `backend/Dockerfile`
   - **Docker Build Context Directory:** `.` (the repository root)
   - **Instance Type:** Free
3. **Environment Variables.** Add each of these:

   | Key | Value |
   | --- | --- |
   | `SPRING_PROFILES_ACTIVE` | `render` |
   | `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<internal hostname>:5432/indra_vaibhav_marble` |
   | `SPRING_DATASOURCE_USERNAME` | `indra_app` |
   | `SPRING_DATASOURCE_PASSWORD` | the database password from Part 2 |
   | `JWT_SECRET` | the JWT secret from Part 1.2 |
   | `DB_POOL_MAX_SIZE` | `5` |
   | `FRONTEND_URL` | `http://localhost:5173` for now; you change it in Part 5 |
   | `BOOTSTRAP_ADMIN_ENABLED` | `true` (only for the first start, see Part 5) |
   | `BOOTSTRAP_ADMIN_NAME` | your name |
   | `BOOTSTRAP_ADMIN_EMAIL` | the email you'll log in with |
   | `BOOTSTRAP_ADMIN_PASSWORD` | the admin password from Part 1.2 |

   > `SPRING_DATASOURCE_URL` must start with **`jdbc:postgresql://`**. Render
   > shows the URL as `postgresql://user:pass@host/db`. Don't paste that form;
   > build it from the internal hostname as shown.
   >
   > **Don't add `DATA_RESET_ENABLED`.** Leaving it out keeps the "Remove
   > business data" button switched off.

4. **Advanced** (open the section):
   - **Health Check Path:** `/api/health`
   - **Auto-Deploy:** **After CI Checks Pass**. If that option isn't shown,
     choose "On Commit" and change it in Part 6.
   - Don't add a disk.
5. Click **Create Web Service**. The first build takes about 5–10 minutes.

✅ **Check:**

- The **Logs** show `Started IndraVaibhavMarbleApplication` and
  `Initial administrator created successfully.`
- Opening `https://<your-backend>.onrender.com/api/health` in a browser shows
  `"database":"UP"`.

If the start fails, read the last red lines in **Logs**:

- `Connection refused` / `UnknownHost`: the `SPRING_DATASOURCE_URL` is wrong,
  or the database is in another region.
- `password authentication failed`: the username or password is wrong.
- `Provide an admin name, email, and password of at least 12 characters`:
  fix the `BOOTSTRAP_ADMIN_*` values.

---

## Part 4 — Frontend (Render Static Site)

1. **New +** → **Static Site** → choose the same repository.
2. Fill in:
   - **Name:** `indra-vaibhav-marble`
   - **Branch:** `main`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
3. **Environment Variables:**

   | Key | Value |
   | --- | --- |
   | `VITE_API_BASE_URL` | `https://<your-backend>.onrender.com` (no `/` at the end) |
   | `NODE_VERSION` | `22` |

4. **Auto-Deploy:** **After CI Checks Pass**.
5. Click **Create Static Site**.

✅ **Check:** The build log ends with `✓ built`, and opening
`https://<your-frontend>.onrender.com` shows the login page.

> If the build fails with `VITE_API_BASE_URL is not set`, the variable is
> missing. Add it and redeploy.

---

## Part 5 — Connect the two, and first login

1. Backend service → **Environment**. Change `FRONTEND_URL` to the frontend's
   address exactly, e.g. `https://indra-vaibhav-marble.onrender.com`, with no
   `/` at the end. Save, and the backend redeploys.
2. Open the frontend and log in with the admin email and password from Part 3.
3. **As soon as the login works**, go back to the backend's **Environment** and:
   - set `BOOTSTRAP_ADMIN_ENABLED` to `false`;
   - **delete** `BOOTSTRAP_ADMIN_PASSWORD`, since it's no longer needed.

   Save.

   > This step matters. If `BOOTSTRAP_ADMIN_ENABLED` stays `true`, every later
   > deploy refuses to start ("users already exist").

4. In the app, go to **Users** and create accounts for staff, with only the
   roles they need.

✅ **Check:**

- You can log in, open Sales & Billing, and create a test product and a test
  bill.
- The backend's latest deploy is **Live** with `BOOTSTRAP_ADMIN_ENABLED=false`.

> If login says "Unable to reach the server" even though `/api/health` works,
> `FRONTEND_URL` doesn't exactly match the address in the browser bar. Check
> `https`, the spelling and the trailing `/`.

### Put the app on staff phones (free, no Play Store)

The site installs like an app: it gets its own home-screen icon and opens full
screen. Send staff the frontend address and these steps:

- **Android (Chrome):** open the address, log in, and tap **Install** on the
  banner at the bottom. If the banner was closed, use Chrome's **⋮** menu →
  **Install app** (or **Add to Home screen**).
- **iPhone (Safari):** open the address, tap **Share** → **Add to Home
  Screen** → **Add**. It must be Safari; other iPhone browsers can't do this.

Updates need nothing from staff: after a deploy, the app picks up the new
version the next time it is opened (sometimes one more reopen).

Logins stay signed in on that phone until the token expires (8 hours by
default, `JWT_EXPIRATION_MS`), so staff log in about once a day. On a shared
phone, tap **More** → **Log out** at the end of the day.

---

## Part 6 — Safe deploys (no downtime, no broken versions)

1. **Deploy only tested code:** on both services, set **Settings → Build &
   Deploy → Auto-Deploy** to **After CI Checks Pass**. A version that fails the
   tests is never deployed.
2. **Health check:** check that the backend has **Health Check Path** =
   `/api/health`. Render switches traffic to a new version only once this check
   answers OK, and it answers 503 if the database can't be reached.
3. **Working routine:**
   1. Build and test on `develop`.
   2. Open a pull request into `main` and wait for the green tick.
   3. Merge. Render deploys by itself.
   4. While the new version starts, the old one keeps serving. Render switches
      only when the new one is healthy. If it fails, the old version stays live.
4. **Database changes** (new `V29__…sql` files): only *add* things, such as new
   tables, new columns or wider rules. Never rename or drop something the
   running version still uses; remove it in a later release instead.
5. **Before a release that changes the database**, run the backup workflow by
   hand (Part 7.5) and wait for it to finish.

✅ **Check:** Push a small change, such as a README edit, to `main`. CI goes
green, then Render deploys, and the app stays usable throughout.

> On the **free** plan the backend may be asleep. The first request after a
> deploy can take about a minute. That's the free plan, not a fault; it stops
> after the upgrade.

---

## Part 7 — Nightly off-site backups

This works on the free database too, and it's the only backup the free plan
has.

**7.1 Create the R2 bucket**

1. Cloudflare dashboard → **R2 Object Storage**. Enable it if asked; it needs a
   card, but the first 10 GB are free.
2. **Create bucket**
   - **Name:** `indra-vaibhav-marble-backups`
   - **Location:** Automatic, or Asia-Pacific
3. Open the bucket → **Settings** → **Object lifecycle rules** → **Add rule**,
   twice:
   - **Rule 1:** prefix `daily/`, delete objects after **30 days**
   - **Rule 2:** prefix `monthly/`, delete objects after **365 days**

**7.2 Create an access key for the bucket**

1. R2 → **Manage R2 API Tokens** → **Create API token**.
2. **Permissions:** Object Read & Write. **Specify bucket:**
   `indra-vaibhav-marble-backups`. **TTL:** forever.
3. Copy into your password manager:
   - **Access Key ID**
   - **Secret Access Key** (shown only once)
   - **Account ID**: the part before `.r2.cloudflarestorage.com` in the
     endpoint shown on the page

**7.3 Add the GitHub secrets**

GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**. Add each of these:

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | the **External Database URL** from Part 2 |
| `BACKUP_PASSPHRASE` | from Part 1.2 |
| `R2_ACCOUNT_ID` | from 7.2 |
| `R2_ACCESS_KEY_ID` | from 7.2 |
| `R2_SECRET_ACCESS_KEY` | from 7.2 |
| `R2_BUCKET` | `indra-vaibhav-marble-backups` |

**7.4 Check the PostgreSQL version**

Open [.github/workflows/backup.yml](.github/workflows/backup.yml).
`PG_CLIENT_VERSION` is `"18"`. If the database's version from Part 2 is
**higher** than 18, set this to that number and commit. Lower versions need no
change.

**7.5 First backup, by hand**

1. GitHub → **Actions** → **Database backup** → **Run workflow** → branch
   `main` → **Run workflow**.
2. Wait about 1–2 minutes for a green tick.

✅ **Check:** In the R2 bucket, `daily/` contains a file like
`indra-vaibhav-marble_2026-10-28_0930.dump.gpg`.

If it fails, open the red step:

- *"Repository secret X is not set"*: add that secret.
- *"server version mismatch"*: raise `PG_CLIENT_VERSION` (7.4).
- An upload error: check the R2 keys and the bucket name.

**7.6 Get an email when a backup fails**

GitHub → your profile → **Settings** → **Notifications** → **Actions** → turn
on email for **failed workflows only**.

From now on the backup runs **every night at 02:00 IST** by itself.

**7.7 First restore test, which proves the backup works**

On your computer (Git Bash; PostgreSQL is installed):

```bash
# 1. Download the newest file from R2 (bucket → daily/ → Download)
# 2. Decrypt it (asks for BACKUP_PASSPHRASE)
gpg --decrypt --output backup.dump indra-vaibhav-marble_2026-10-28_0930.dump.gpg

# 3. Load it into a throw-away local database
createdb -U postgres indra_restore_test
pg_restore -U postgres --no-owner --no-privileges -d indra_restore_test backup.dump

# 4. Check bills and products are there
psql -U postgres -d indra_restore_test -c "select count(*) from sales_orders;"
psql -U postgres -d indra_restore_test -c "select count(*) from products;"

# 5. Clean up
dropdb -U postgres indra_restore_test
```

Then delete the `.dump` and `.dump.gpg` files from your computer.

✅ **Check:** The counts match what you see in the app.

---

## Part 8 — Routine checks

**Every week (2 minutes)**

- GitHub → Actions → **Database backup**: the last 7 runs are green.
- Render dashboard: all three services show **Live / Available**.

**Every month (15 minutes)**

- Do the restore test (7.7) with the newest backup.
- Render → **Billing**: the amount is what you expect ($0 on free plans).
- Render → database: storage used is well below the limit.

**Before each release with database changes**

- Run the backup by hand (7.5) and wait for the green tick before merging.

**If something goes wrong**

| Problem | What to do |
| --- | --- |
| A deploy failed | Nothing is broken; the old version is still live. Read the deploy **Logs**, fix, push again. |
| The new version has a bug | Render → backend → **Events** → pick the previous deploy → **Rollback**. |
| Data deleted or changed by mistake | Free plan: restore the latest off-site backup (7.7) into a new database and point the backend at it. Paid plan: use point-in-time recovery (Part 9). |
| The app is slow on first open | Free plan sleeping; this goes away after the upgrade. |

---

## Part 9 — Going live (switching to paid)

Do this **before** day 25 of the free database, and before entering real shop
data.

1. **Back up first:** run the backup by hand (7.5) and wait for the green tick.
2. **Database:** Render → database → **Settings** → **Instance Type** →
   **Basic-256mb** → Save. Set storage to **5 GB**, a fixed size; don't turn
   on automatic storage growth. The data stays where it is.
   - If Render doesn't offer an in-place upgrade, create a new **Basic-256mb**
     database in Singapore and restore last night's backup into it with
     `pg_restore` (as in 7.7), using the new database's External URL with `-d`.
     Then update the backend's `SPRING_DATASOURCE_*` variables and the GitHub
     secret `DATABASE_URL` to the new database.
3. **Backend:** Render → backend → **Settings** → **Instance Type** →
   **Starter**. Keep **1 instance** and leave autoscaling off.
4. **Frontend:** nothing to do; static sites stay free.
5. **Check the settings once more:**
   - Backend **Health Check Path** = `/api/health`
   - **Auto-Deploy** = After CI Checks Pass, on both services
   - `BOOTSTRAP_ADMIN_ENABLED` = `false`, and `DATA_RESET_ENABLED` is **not**
     set
   - No disk attached to the backend
6. **Clear out test data.** Either start with a new, empty paid database and
   point everything at it, or delete test records in the app. Don't use
   "Remove business data", which is switched off in production.
7. Run the backup by hand once more, then do a restore test (7.7).
8. **Remove the calendar reminder.** Paid databases don't expire.

**What you get after the upgrade**

- The backend never sleeps.
- **Point-in-time recovery:** restore the database to any minute in the last
  3 days, from Render → database → **Recovery**.
- Render's own daily backups, on top of your nightly R2 copies.

**Expected bill:** about **$14.50 a month** ($7 backend + about $7.50
database), plus your card's foreign-exchange and GST charges. Check
[render.com/pricing](https://render.com/pricing) when you upgrade, since Render
changes prices from time to time. Keep the bill fixed:

- 1 backend instance, autoscaling off
- Hobby workspace (don't upgrade to Pro)
- No disks
- Fixed database storage

Check **Billing** after the first month.
