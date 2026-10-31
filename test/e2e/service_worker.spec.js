import { test, expect } from '@playwright/test';

test.describe('Service Worker and PWA Offline Support', () => {
  test('Service worker registers and enables offline navigation fallback', async ({ context, page }) => {
    // 1. Visit online
    await page.goto('/', { waitUntil: 'networkidle' });

    // 2. Wait for Service Worker registration
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return !!reg && !!reg.active;
    });
    expect(swRegistered).toBe(true);

    // 3. Verify landing view rendered
    await expect(page.locator('#view-landing')).toBeVisible();

    // 4. Simulate offline network mode
    await context.setOffline(true);

    // 5. Reload while offline - should fallback to cached index.html
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#view-landing')).toBeVisible();
    await expect(page.locator('.landing-title')).toContainText('PDX Food Week');

    // 6. Restore online mode
    await context.setOffline(false);
  });

  test('Active week dish lineup automatically refreshes when resumed if new dishes are published', async ({ page }) => {
    await page.goto('/?week=wiener-2026', { waitUntil: 'networkidle' });

    await expect(page.locator('#cards-browse .dish-card').first()).toBeVisible();
    const initialCount = await page.evaluate(() => {
      return (window.RESTAURANTS || []).filter(r => r.weekId === 'wiener-2026').length;
    });
    expect(initialCount).toBeGreaterThan(0);

    // Intercept data/wienerweek2026.js at the context level (so SW network fetches are also intercepted)
    await page.context().route('**/data/wienerweek2026.js*', async (route) => {
      const response = await route.fetch();
      const originalCode = await response.text();
      const extraDish = `{
        "id": 9999991,
        "weekId": "wiener-2026",
        "dish": "Auto-Refreshed Surprise Dog",
        "restaurant": "PWA Live Update Test Spot",
        "neighborhood": "Downtown",
        "address": "123 SW Main St, Portland, OR",
        "lat": 45.515,
        "lng": -122.679,
        "type": "meat",
        "desc": "Freshly added dish without manual page reload.",
        "emoji": "🌭",
        "isNew": true
      },`;
      const modifiedCode = originalCode.replace('const newItems = [', `const newItems = [\n${extraDish}`);
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: modifiedCode
      });
    });

    // Trigger checkMetadataUpdate(true) as happens when an installed PWA resumes/reconnects
    await page.evaluate(async () => {
      await window.App.checkMetadataUpdate(true);
    });

    const updatedCount = await page.evaluate(() => {
      return (window.RESTAURANTS || []).filter(r => r.weekId === 'wiener-2026').length;
    });
    expect(updatedCount).toBe(initialCount + 1);

    await expect(page.locator('#cards-browse')).toContainText('Auto-Refreshed Surprise Dog');
  });
});
