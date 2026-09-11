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
});
