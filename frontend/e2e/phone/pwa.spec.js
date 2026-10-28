import { expect, test } from "../support/app.js";

// What a phone needs to offer "Install app" / "Add to Home Screen".
test.describe("installable app", () => {
  test("the app manifest describes a full-screen app with icons", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();

    expect(manifest.name).toBe("Indra Vaibhav Marble");
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");

    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);

    for (const icon of manifest.icons) {
      const image = await request.get(`/${icon.src}`);
      expect(image.ok(), `${icon.src} exists`).toBe(true);
      expect(image.headers()["content-type"]).toContain("image/png");
    }
  });

  test("the service worker that makes it installable is published", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.ok()).toBe(true);
  });

  test("the page links the manifest and the iPhone home-screen icon", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/apple-touch-icon-180x180.png");
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
    // Lets the bottom tabs keep clear of the iPhone home bar.
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  });
});
