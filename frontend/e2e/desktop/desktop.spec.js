import { box, expect, expectNoSidewaysOverflow, expectOnlyOpenCashTabHighlighted, openPage, openPopup, test } from "../support/app.js";

// The phone layout is only for small screens; desktop keeps its own.
test.describe("desktop keeps its layout", () => {
  for (const hash of ["dashboard", "billing", "inventory", "cash", "reports"]) {
    test(`${hash} uses the sidebar`, async ({ loggedIn: page }) => {
      await openPage(page, hash);
      await expect(page.locator(".erp-sidebar")).toBeVisible();
      await expect(page.locator(".erp-bottom-nav")).toBeHidden();
      await expectNoSidewaysOverflow(page);
    });
  }

  test("summary boxes sit in one row", async ({ loggedIn: page }) => {
    await openPage(page, "billing");
    const cards = page.locator(".sales-orders-summary > *");
    const first = await box(cards.nth(0));
    const third = await box(cards.nth(2));
    expect(Math.abs(first.y - third.y)).toBeLessThan(2);
  });

  test("popups open in the middle, not as bottom sheets", async ({ loggedIn: page }) => {
    await openPage(page, "billing");
    await page.getByRole("button", { name: "+ New sale" }).click();
    const sheet = openPopup(page);
    await expect(sheet).toBeVisible();
    const sheetBox = await box(sheet);
    const screen = page.viewportSize();
    expect(sheetBox.x).toBeGreaterThan(0);
    expect(sheetBox.y + sheetBox.height).toBeLessThan(screen.height - 4);
  });

  test("bill details keeps its Close button in the footer", async ({ loggedIn: page }) => {
    await openPage(page, "billing");
    await page.getByRole("row", { name: /INV-0002/ }).getByRole("button", { name: "View" }).click();
    const sheet = openPopup(page);
    await expect(sheet.locator(".sales-details-footer-close")).toBeVisible();
  });

  test("cash book highlights the open tab", async ({ loggedIn: page }) => {
    await openPage(page, "cash");
    await expectOnlyOpenCashTabHighlighted(page);
  });

  test("cash book lists every payment method", async ({ loggedIn: page }) => {
    await openPage(page, "cash");
    for (const row of await page.locator(".cash-method-empty").all()) await expect(row).toBeVisible();
    await expect(page.getByText("Methods with no money in this period are hidden.")).toBeHidden();
  });

  test("New purchase has a Close button beside its title", async ({ loggedIn: page }) => {
    await openPage(page, "purchases");
    await page.getByRole("button", { name: "+ New purchase" }).click();
    const sheet = openPopup(page);
    const heading = sheet.locator(":scope > .purchase-section-heading").first();
    const title = await box(heading.getByRole("heading", { name: "New purchase" }));
    const close = heading.getByRole("button", { name: "Close", exact: true });
    const closeBox = await box(close);
    expect(closeBox.x).toBeGreaterThan(title.x + title.width - 1);
    expect(closeBox.y).toBeLessThan(title.y + title.height);

    await close.click();
    await expect(sheet).toBeHidden();
  });

  test("Adjust stock shows its title once", async ({ loggedIn: page }) => {
    await openPage(page, "inventory");
    await page.getByRole("button", { name: "Adjust stock" }).click();
    const sheet = openPopup(page);
    await expect(sheet.getByRole("heading", { name: "Stock Operations" }).filter({ visible: true })).toHaveCount(1);
  });
});
