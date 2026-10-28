import { box, expect, expectNoSidewaysOverflow, expectOnlyOpenCashTabHighlighted, openPage, test } from "../support/app.js";

const PAGES = [
  { hash: "dashboard", summary: ".erp-sales-period-grid" },
  { hash: "billing", summary: ".sales-orders-summary" },
  { hash: "inventory", summary: ".inventory-stats" },
  { hash: "customers", summary: ".customer-summary" },
  { hash: "purchases", summary: ".purchase-kpi-grid" },
  { hash: "suppliers" },
  { hash: "expenses", summary: ".expenses-kpis" },
  { hash: "cash" },
  { hash: "stock-movements" },
  { hash: "reports", summary: ".reports-kpis" },
  { hash: "users" },
];

test.describe("every page fits a phone screen", () => {
  for (const { hash, summary } of PAGES) {
    test(`${hash}`, async ({ loggedIn: page }) => {
      await openPage(page, hash);

      await expectNoSidewaysOverflow(page);
      await expect(page.locator(".erp-bottom-nav")).toBeVisible();
      await expect(page.locator(".erp-sidebar")).toBeHidden();

      if (summary) {
        // Summary boxes sit two to a row so the list starts on the first screen.
        const cards = page.locator(`${summary} > *`);
        const first = await box(cards.nth(0));
        const second = await box(cards.nth(1));
        expect(Math.abs(first.y - second.y), "first two summary boxes share a row").toBeLessThan(2);
        expect(second.x).toBeGreaterThan(first.x + first.width - 1);

        // Amounts stay on one line and inside their box.
        const amounts = await page.locator(`${summary} > * > :is(strong, h3)`).evaluateAll((elements) =>
          elements.map((el) => ({ text: el.innerText, fits: el.scrollWidth <= el.clientWidth + 1, lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)) }))
        );
        for (const amount of amounts) {
          expect(amount.fits, `"${amount.text}" fits its box`).toBe(true);
          expect(amount.lines, `"${amount.text}" stays on one line`).toBeLessThanOrEqual(1);
        }
      }
    });
  }
});

test("a crore-sized amount still fits its summary box", async ({ loggedIn: page }) => {
  await openPage(page, "reports");
  const amount = page.locator(".reports-kpi > strong").last();
  await amount.evaluate((el) => {
    el.textContent = "-₹12,34,56,789.00";
  });
  expect(await amount.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});

test("an odd last summary box takes the full row", async ({ loggedIn: page }) => {
  await openPage(page, "billing");
  const cards = page.locator(".sales-orders-summary > *");
  await expect(cards).toHaveCount(3);
  const row = await box(page.locator(".sales-orders-summary"));
  const last = await box(cards.nth(2));
  expect(last.width).toBeGreaterThan(row.width - 2);
});

test("page buttons share the width, with the main one on its own row", async ({ loggedIn: page }) => {
  await openPage(page, "inventory");
  const adjust = await box(page.getByRole("button", { name: "Adjust stock" }));
  const settings = await box(page.getByRole("button", { name: "Stock settings" }));
  const add = await box(page.getByRole("button", { name: "+ Add product" }));
  expect(Math.abs(adjust.y - settings.y)).toBeLessThan(2);
  expect(Math.abs(adjust.width - settings.width)).toBeLessThan(2);
  expect(add.y).toBeGreaterThan(adjust.y + adjust.height - 1);
  expect(add.width).toBeGreaterThan(adjust.width * 1.8);
});

test("the Clear filters button takes the full row", async ({ loggedIn: page }) => {
  await openPage(page, "billing");
  const clear = await box(page.locator(".sales-orders-filter-controls > button").last());
  const search = await box(page.locator(".sales-orders-filter-controls > input").first());
  expect(Math.abs(clear.width - search.width)).toBeLessThan(2);
});

test("tables become compact cards with two values to a row", async ({ loggedIn: page }) => {
  await openPage(page, "users");
  const card = page.locator(".stack-on-phone tbody tr").first();
  const cells = card.locator("td[data-label]");
  // The first cell is the card's title across the full width.
  const title = await box(cells.nth(0));
  const left = await box(cells.nth(1));
  const right = await box(cells.nth(2));
  expect(title.width).toBeGreaterThan(left.width * 1.8);
  expect(Math.abs(left.y - right.y)).toBeLessThan(2);
  // The column name is shown above each value.
  expect(await cells.nth(1).evaluate((el) => getComputedStyle(el, "::before").content)).toContain("Email");
});

test.describe("Cash Book", () => {
  test("the tabs scroll sideways instead of running off the screen", async ({ loggedIn: page }) => {
    await openPage(page, "cash");
    const tabs = page.locator(".cash-tabs");
    expect(await tabs.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
    const tabsBox = await box(tabs);
    expect(tabsBox.x + tabsBox.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    // The last tab is reachable by scrolling the tab row.
    const lastTab = page.getByRole("tab", { name: "Settings" });
    await lastTab.scrollIntoViewIfNeeded();
    await expect(lastTab).toBeInViewport();
  });

  test("the open tab is highlighted, and the highlight follows the tab", async ({ loggedIn: page }) => {
    await openPage(page, "cash");
    await expectOnlyOpenCashTabHighlighted(page);
  });

  test("payment methods with no money are hidden, with a note", async ({ loggedIn: page }) => {
    await openPage(page, "cash");
    const empty = page.locator(".cash-method-empty");
    expect(await empty.count()).toBeGreaterThan(0);
    for (const row of await empty.all()) await expect(row).toBeHidden();
    await expect(page.getByText("Methods with no money in this period are hidden.")).toBeVisible();
    // Cash is always listed.
    await expect(page.locator(".cash-table tr", { hasText: "Cash" }).first()).toBeVisible();
  });

  test("the Record cash form fits the screen", async ({ loggedIn: page }) => {
    await openPage(page, "cash");
    await page.getByRole("button", { name: "Record cash added or taken out" }).click();
    await expect(page.getByRole("heading", { name: "Cash added or taken out" })).toBeVisible();
    await expectNoSidewaysOverflow(page);
  });
});

test("Reports puts From and To side by side", async ({ loggedIn: page }) => {
  await openPage(page, "reports");
  const from = await box(page.getByLabel("From", { exact: true }));
  const to = await box(page.getByLabel("To", { exact: true }));
  expect(Math.abs(from.y - to.y)).toBeLessThan(2);
});
