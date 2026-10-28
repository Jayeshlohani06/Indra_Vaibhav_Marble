import { SAVE_BAR, box, expect, expectNoSidewaysOverflow, openPage, openPopup, test } from "../support/app.js";

// How to open each popup, and whether it has a Save / Cancel bar.
const POPUPS = [
  { name: "New sale", page: "billing", open: (p) => p.getByRole("button", { name: "+ New sale" }), saveBar: true },
  { name: "Bill details", page: "billing", open: (p) => p.locator(".mobile-card", { hasText: "INV-0002" }), saveBar: true },
  { name: "Take payment", page: "billing", open: async (p) => { await p.locator(".mobile-card", { hasText: "INV-0002" }).click(); return p.getByRole("button", { name: "Take payment" }); }, saveBar: true },
  { name: "Add product", page: "inventory", open: (p) => p.getByRole("button", { name: "+ Add product" }), saveBar: true },
  { name: "Product details", page: "inventory", open: (p) => p.locator(".mobile-card", { hasText: "Kota Stone" }), saveBar: true },
  { name: "Adjust stock", page: "inventory", open: (p) => p.getByRole("button", { name: "Adjust stock" }) },
  { name: "Stock settings", page: "inventory", open: (p) => p.getByRole("button", { name: "Stock settings" }) },
  { name: "Add customer", page: "customers", open: (p) => p.getByRole("button", { name: /Add customer/ }), saveBar: true },
  { name: "Customer details", page: "customers", open: (p) => p.locator(".mobile-card", { hasText: "Sita Devi" }), saveBar: true },
  { name: "New purchase", page: "purchases", open: (p) => p.getByRole("button", { name: "+ New purchase" }), saveBar: true },
  { name: "Purchase details", page: "purchases", open: (p) => p.locator(".mobile-card", { hasText: "Kajaria Distributor Patna" }), saveBar: true },
  { name: "Add supplier", page: "suppliers", open: (p) => p.getByRole("button", { name: "+ Add supplier" }), saveBar: true },
  { name: "Supplier details", page: "suppliers", open: (p) => p.locator(".mobile-card", { hasText: "South Granite Exports" }), saveBar: true },
  { name: "Add expense", page: "expenses", open: (p) => p.getByRole("button", { name: "+ Add expense" }), saveBar: true },
  { name: "Staff", page: "expenses", open: (p) => p.getByRole("button", { name: "Staff", exact: true }) },
  { name: "Correct stock", page: "stock-movements", open: (p) => p.getByRole("button", { name: "Correct stock" }) },
  { name: "Add user", page: "users", open: (p) => p.getByRole("button", { name: "+ Add user" }), saveBar: true },
  {
    name: "Close the day",
    page: "cash",
    open: async (p) => {
      await p.getByLabel(/What caused the difference/).fill("Test count");
      return p.getByRole("button", { name: /Review and close/ });
    },
    saveBar: true,
  },
];

async function openNamedPopup(page, popup) {
  await openPage(page, popup.page);
  const trigger = await popup.open(page);
  await trigger.click();
  const sheet = openPopup(page);
  await expect(sheet).toBeVisible();
  // Let the slide-up animation finish before measuring.
  await page.waitForTimeout(400);
  return sheet;
}

test.describe("popups open as bottom sheets", () => {
  for (const popup of POPUPS) {
    test(popup.name, async ({ loggedIn: page }) => {
      const sheet = await openNamedPopup(page, popup);
      const screen = page.viewportSize();

      // Full width and resting on the bottom edge of the screen.
      const sheetBox = await box(sheet);
      expect(sheetBox.x).toBeCloseTo(0, 0);
      expect(sheetBox.width).toBeCloseTo(screen.width, 0);
      expect(sheetBox.y + sheetBox.height).toBeCloseTo(screen.height, 0);
      expect(sheetBox.y).toBeGreaterThanOrEqual(0);

      await expectNoSidewaysOverflow(page, ".erp-layout");
      expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "nothing scrolls sideways inside").toBe(true);

      if (popup.saveBar) {
        const bar = sheet.locator(SAVE_BAR).last();
        const innerWidth = await sheet.evaluate((el) => el.clientWidth);
        // At the top and at the end of the form, the bar sits flush with the
        // bottom of the sheet, so no form content shows underneath it.
        for (const where of ["top", "end"]) {
          await sheet.evaluate((el, at) => {
            el.scrollTop = at === "top" ? 0 : el.scrollHeight;
          }, where);
          await page.waitForTimeout(100);
          const barBox = await box(bar);
          expect(barBox.y + barBox.height, `Save bar at the bottom (${where})`).toBeCloseTo(sheetBox.y + sheetBox.height, 0);
          // Edge to edge inside the sheet's 1px border.
          expect(Math.abs(barBox.width - innerWidth), "Save bar runs edge to edge").toBeLessThanOrEqual(1);
        }

        // Buttons in the bar share the width equally and are easy to tap.
        const buttons = await bar.locator(":scope > :is(button, a)").filter({ visible: true }).all();
        for (const button of buttons) {
          expect((await box(button)).height).toBeGreaterThanOrEqual(40);
        }
      }
    });
  }
});

test.describe("form layouts", () => {
  test("New sale: product lines put numbers two to a row", async ({ loggedIn: page }) => {
    await openNamedPopup(page, POPUPS[0]);
    const line = page.locator(".sales-order-item").first();
    const product = await box(line.locator(".sales-order-product-field"));
    const quantity = await box(line.getByText(/^Quantity/).first());
    const price = await box(line.getByText("Price per unit (₹)"));
    expect(Math.abs(quantity.y - price.y)).toBeLessThan(2);
    expect(product.width).toBeGreaterThan(quantity.width * 1.8);
  });

  test("Bill details: main action on top, no second Close", async ({ loggedIn: page }) => {
    const sheet = await openNamedPopup(page, POPUPS[1]);
    const bar = sheet.locator(".sales-order-form-actions");
    // The Close at the top stays; the one repeated in the footer is dropped.
    await expect(sheet.getByRole("button", { name: "Close order details" })).toBeVisible();
    await expect(bar.locator(".sales-details-footer-close")).toBeHidden();

    const pay = await box(bar.getByRole("button", { name: "Take payment" }));
    const print = await box(bar.getByRole("button", { name: "Print invoice" }));
    const whatsapp = await box(bar.getByRole("link", { name: "Send on WhatsApp" }));
    expect(pay.y).toBeLessThan(print.y);
    expect(pay.width).toBeGreaterThan(print.width * 1.8);
    expect(Math.abs(print.y - whatsapp.y)).toBeLessThan(2);
    expect(Math.abs(print.height - whatsapp.height), "buttons in a row are the same height").toBeLessThan(2);

    // Bill facts sit two to a row.
    const facts = sheet.locator(".sales-order-detail-summary > *");
    const first = await box(facts.nth(0));
    const second = await box(facts.nth(1));
    expect(Math.abs(first.y - second.y)).toBeLessThan(2);
  });

  test("Add product: prices and tax codes pair up; + Add stays beside its list", async ({ loggedIn: page }) => {
    await openNamedPopup(page, POPUPS[3]);
    const pairs = [
      ["Purchase price (₹) *", "Selling price (₹) *"],
      ["GST rate (%) *", "HSN code"],
    ];
    for (const [left, right] of pairs) {
      const a = await box(page.getByText(left, { exact: true }));
      const b = await box(page.getByText(right, { exact: true }));
      expect(Math.abs(a.y - b.y), `${left} beside ${right}`).toBeLessThan(2);
    }
    const name = await box(page.getByPlaceholder("e.g. Italian White Marble"));
    const price = await box(page.getByPlaceholder("What you pay, e.g. 450"));
    expect(name.width).toBeGreaterThan(price.width * 1.8);

    const category = await box(page.locator(".inventory-inline-field select").first());
    const addCategory = await box(page.locator(".inventory-inline-field > button").first());
    expect(Math.abs(category.y - addCategory.y)).toBeLessThan(4);
  });

  test("Product details fit two facts to a row", async ({ loggedIn: page }) => {
    await openNamedPopup(page, POPUPS[4]);
    const facts = page.locator(".inventory-detail-list > p");
    const first = await box(facts.nth(0));
    const second = await box(facts.nth(1));
    expect(Math.abs(first.y - second.y)).toBeLessThan(2);
  });

  test("Add supplier: phones open the number pad and short fields pair up", async ({ loggedIn: page }) => {
    const sheet = await openNamedPopup(page, POPUPS[11]);
    await expect(sheet.locator("input[name=phone]")).toHaveAttribute("type", "tel");
    await expect(sheet.locator("input[name=alternatePhone]")).toHaveAttribute("type", "tel");
    await expect(sheet.locator("input[name=postalCode]")).toHaveAttribute("inputmode", "numeric");
    for (const [left, right] of [["phone", "alternatePhone"], ["city", "state"]]) {
      const a = await box(sheet.locator(`input[name=${left}]`));
      const b = await box(sheet.locator(`input[name=${right}]`));
      expect(Math.abs(a.y - b.y), `${left} beside ${right}`).toBeLessThan(2);
    }
  });

  test("Add expense: amount and payment method share a row", async ({ loggedIn: page }) => {
    const sheet = await openNamedPopup(page, POPUPS[13]);
    const amount = await box(sheet.locator("input[name=amount]"));
    const method = await box(sheet.locator("select[name=paymentMethod]"));
    expect(Math.abs(amount.y - method.y)).toBeLessThan(2);
  });

  test("New purchase: invoice number and date share a row", async ({ loggedIn: page }) => {
    const sheet = await openNamedPopup(page, POPUPS[9]);
    const invoice = await box(sheet.getByPlaceholder("Number from supplier bill"));
    const date = await box(sheet.locator("input[type=date]").first());
    expect(Math.abs(invoice.y - date.y)).toBeLessThan(2);
  });

  for (const popup of [POPUPS[9], POPUPS[10]]) {
    test(`${popup.name}: Close sits beside the title and closes it`, async ({ loggedIn: page }) => {
      const sheet = await openNamedPopup(page, popup);
      const heading = sheet.locator(":scope > .purchase-section-heading").first();
      const title = await box(heading.getByRole("heading"));
      const close = heading.getByRole("button", { name: "Close", exact: true });
      const closeBox = await box(close);
      expect(closeBox.x, "Close is to the right of the title").toBeGreaterThan(title.x + title.width - 1);
      expect(closeBox.y, "Close is level with the title, not below it").toBeLessThan(title.y + title.height);

      await close.click();
      await expect(sheet).toBeHidden();
    });
  }

  test("Adjust stock shows its title once", async ({ loggedIn: page }) => {
    const sheet = await openNamedPopup(page, POPUPS[5]);
    await expect(sheet.getByRole("heading", { name: "Stock Operations" }).filter({ visible: true })).toHaveCount(1);
  });
});
