import { TEST_LOGIN, expect, expectNoSidewaysOverflow, test } from "../support/app.js";

test.describe("logging in on a phone", () => {
  test("the login page fits the screen", async ({ page, unmockedRequests }) => {
    void unmockedRequests;
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expectNoSidewaysOverflow(page);
  });

  test("staff stay logged in after closing and reopening the app", async ({ page, unmockedRequests }) => {
    void unmockedRequests;
    await page.goto("/");
    await page.getByLabel("Mobile number or email").fill(TEST_LOGIN.identifier);
    await page.getByLabel("Password", { exact: true }).fill(TEST_LOGIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    const bottomTabs = page.locator(".erp-bottom-nav");
    await expect(bottomTabs).toBeVisible();

    // Reopening the installed app is a fresh page load.
    await page.reload();
    await expect(bottomTabs).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);
  });

  test("logging out from the More menu forgets the login", async ({ loggedIn: page }) => {
    await page.goto("/#dashboard");
    await page.locator(".erp-bottom-nav").getByRole("button", { name: "More" }).click();
    await page.locator(".erp-more-sheet").getByRole("button", { name: "Log out" }).click();

    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("indra-vaibhav-auth-token"))).toBeNull();
  });

  test("an expired login goes back to the login page", async ({ page, unmockedRequests }) => {
    void unmockedRequests;
    await page.addInitScript(() => {
      localStorage.setItem("indra-vaibhav-auth-token", "expired");
      localStorage.setItem("indra-vaibhav-user", JSON.stringify({ fullName: "Test Admin", permissions: [] }));
    });
    // Routes added later take priority over the recorded answers.
    await page.route("**/mock-api/**", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: '{"message":"Session expired"}' })
    );

    await page.goto("/#dashboard");

    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
