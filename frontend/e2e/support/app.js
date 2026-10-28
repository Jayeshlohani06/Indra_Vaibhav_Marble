import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect } from "@playwright/test";

// The app is built with its API address set to /mock-api on the test server
// (see playwright.config.js). Every request to it is answered here from
// fixtures/api.json, so the tests need no backend or database.
//
// To refresh the fixtures, start a backend with sample data and run:
//   RECORD_API=http://localhost:8081 npm run test:e2e
// Each request is then sent to that backend and its answer saved.

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_FILE = path.join(here, "..", "fixtures", "api.json");
export const MOCK_API_PATH = "/mock-api";
const RECORD_API = process.env.RECORD_API;

// The day the fixtures were recorded. The app filters by "today" and "this
// month", so the browser clock is held here to get the same answers.
export const FIXED_NOW = new Date("2026-10-29T12:00:00+05:30");

export const TEST_LOGIN = { identifier: "admin@test.local", password: "MobileTest#2026" };
const TOKEN_KEY = "indra-vaibhav-auth-token";
const USER_KEY = "indra-vaibhav-user";
const RECORDED_TOKEN = "e2e-token";

let fixtures = fs.existsSync(FIXTURE_FILE) ? JSON.parse(fs.readFileSync(FIXTURE_FILE, "utf8")) : {};

function requestKey(request) {
  const url = new URL(request.url());
  const apiPath = url.pathname.slice(url.pathname.indexOf(MOCK_API_PATH) + MOCK_API_PATH.length);
  return `${request.method()} ${apiPath}${url.search}`;
}

function saveFixture(key, status, body) {
  // Re-read so parallel workers do not overwrite each other's recordings.
  const current = fs.existsSync(FIXTURE_FILE) ? JSON.parse(fs.readFileSync(FIXTURE_FILE, "utf8")) : {};
  current[key] = { status, body };
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
  fs.mkdirSync(path.dirname(FIXTURE_FILE), { recursive: true });
  fs.writeFileSync(FIXTURE_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
  fixtures = sorted;
}

function parseBody(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Some answers come wrapped as { success, data }, others bare.
function unwrap(body) {
  return body && typeof body === "object" && "data" in body ? body.data : body;
}

// Recorded logins carry a real signed token; keep only a placeholder.
function sanitize(key, body) {
  if (key.startsWith("POST /api/auth/login") && body?.accessToken) {
    return { ...body, accessToken: RECORDED_TOKEN };
  }
  return body;
}

async function answerFromRecording(route, unmocked) {
  const request = route.request();
  const key = requestKey(request);

  if (RECORD_API) {
    const url = new URL(request.url());
    const target = `${RECORD_API}${url.pathname.slice(url.pathname.indexOf(MOCK_API_PATH) + MOCK_API_PATH.length)}${url.search}`;
    // Sent from the test runner, not the page, so the page's origin would
    // only make the backend's cross-origin check refuse it.
    const headers = { ...request.headers() };
    delete headers.origin;
    delete headers.referer;
    if (headers.authorization === `Bearer ${RECORDED_TOKEN}`) {
      headers.authorization = `Bearer ${await recordingToken()}`;
    }
    const response = await route.fetch({ url: target, headers });
    const text = await response.text();
    const body = parseBody(text);
    if (request.method() === "GET" || key.startsWith("POST /api/auth/login")) {
      saveFixture(key, response.status(), sanitize(key, body));
    }
    await route.fulfill({ status: response.status(), contentType: "application/json", body: text });
    return;
  }

  const recorded = fixtures[key];
  if (!recorded) {
    unmocked.push(key);
    await route.fulfill({
      status: 501,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: `No recorded API answer for ${key}` }),
    });
    return;
  }
  await route.fulfill({
    status: recorded.status,
    contentType: "application/json",
    body: typeof recorded.body === "string" ? recorded.body : JSON.stringify(recorded.body),
  });
}

let realToken;
async function recordingToken() {
  if (!realToken) {
    const response = await fetch(`${RECORD_API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(TEST_LOGIN),
    });
    realToken = unwrap(await response.json()).accessToken;
  }
  return realToken;
}

async function loggedInUser() {
  if (RECORD_API) {
    const response = await fetch(`${RECORD_API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${await recordingToken()}` },
    });
    return unwrap(await response.json());
  }
  return unwrap(fixtures["GET /api/auth/me"]?.body);
}

export const test = base.extend({
  // Each test can override an answer with page.route() before navigating.
  unmockedRequests: async ({ page }, use) => {
    const unmocked = [];
    await page.clock.setFixedTime(FIXED_NOW);
    await page.route(`**${MOCK_API_PATH}/**`, (route) => answerFromRecording(route, unmocked));
    await use(unmocked);
    expect(
      unmocked,
      "The app asked for API answers that are not in e2e/fixtures/api.json. Re-record (see e2e/support/app.js)."
    ).toEqual([]);
  },

  // Opens the app already logged in, as after reopening the installed app.
  loggedIn: async ({ page, unmockedRequests }, use) => {
    void unmockedRequests;
    const user = await loggedInUser();
    await page.addInitScript(
      ([tokenKey, userKey, token, userJson]) => {
        if (!localStorage.getItem(tokenKey)) {
          localStorage.setItem(tokenKey, token);
          localStorage.setItem(userKey, userJson);
        }
      },
      [TOKEN_KEY, USER_KEY, RECORDED_TOKEN, JSON.stringify(user ?? {})]
    );
    await use(page);
  },
});

export { expect };

// ----- Page helpers -----

export async function openPage(page, hash) {
  await page.goto(`/#${hash}`);
  await expect(page.locator(".erp-layout")).toBeVisible();
  // Wait for the page's data so the layout being checked is the real one.
  await expect(page.locator(".skeleton, .skeleton__bar")).toHaveCount(0, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  // Text widths depend on the web font, so measure only once it is in.
  await page.evaluate(() => document.fonts.ready);
}

// Elements sticking out past the left or right edge of the screen, ignoring
// those inside something that scrolls or clips sideways on purpose.
export async function overflowingElements(page, root = "body") {
  return page.evaluate((rootSelector) => {
    const width = document.documentElement.clientWidth;
    const scope = document.querySelector(rootSelector) || document.body;
    const clipped = (el) => {
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (["auto", "scroll", "hidden", "clip"].includes(overflowX)) return true;
      }
      return false;
    };
    const describe = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).join(".")}` : ""} "${(el.innerText || "").trim().slice(0, 30)}"`;
    const bad = [];
    for (const el of scope.querySelectorAll("*")) {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      if ((box.right > width + 1 || box.left < -1) && !clipped(el)) bad.push(describe(el));
    }
    if (document.documentElement.scrollWidth > width + 1) bad.unshift(`page is ${document.documentElement.scrollWidth}px wide on a ${width}px screen`);
    return bad.slice(0, 10);
  }, root);
}

export async function expectNoSidewaysOverflow(page, root) {
  expect(await overflowingElements(page, root), "elements wider than the screen").toEqual([]);
}

// Every popup in the app, by its own class.
export const POPUP = [
  ".customer-modal", ".sales-order-modal", ".sales-order-details-modal",
  ".sales-customer-modal", ".purchase-modal", ".supplier-modal", ".supplier-details-modal",
  ".inventory-modal", ".expenses-modal", ".expenses-small-modal", ".stock-movement-modal",
  ".users-modal", ".cash-modal", ".change-method-dialog",
].join(", ");

// The Save / Cancel bars at the bottom of popups (look for them inside one).
export const SAVE_BAR = [
  ".sales-order-form-actions", ".expenses-form-actions", ".purchase-form-actions",
  ".inventory-form-actions", ".users-modal-actions", ".supplier-form-actions",
  ".customer-form-actions", ".sales-customer-modal-actions", ".change-method-actions",
  ".cash-actions",
].join(", ");

export function openPopup(page) {
  return page.locator(POPUP).filter({ visible: true }).last();
}

// Opens each Cash Book tab in turn and checks that only the open one is
// highlighted.
export async function expectOnlyOpenCashTabHighlighted(page) {
  const tabs = page.locator(".cash-tabs > [role='tab']");
  const names = (await tabs.allInnerTexts()).map((name) => name.trim());
  expect(names.length).toBeGreaterThan(1);

  for (const name of names) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
    // Polled, because the theme fades button shadows in and out.
    await expect
      .poll(() =>
        tabs.evaluateAll((elements) => ({
          // The open tab is filled with the bronze gradient; the rest are flat.
          highlighted: elements.filter((el) => getComputedStyle(el).backgroundImage !== "none").map((el) => el.innerText.trim()),
          raised: elements.filter((el) => getComputedStyle(el).boxShadow !== "none").map((el) => el.innerText.trim()),
        })),
        { message: `only "${name}" is highlighted while open` }
      )
      .toEqual({ highlighted: [name], raised: [name] });
  }
}

export async function box(locator) {
  const result = await locator.boundingBox();
  expect(result, "element should be on screen").not.toBeNull();
  return result;
}
