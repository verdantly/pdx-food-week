import { test, expect } from '@playwright/test';

test.describe('Navigation and Routing', () => {
  test('Detail overlay opens and closes correctly on desktop', async ({ page }) => {
    // Open the app
    await page.goto('/?week=test-week-123'); // Fake week just to avoid landing page block
    
    // Switch to Browse tab
    await page.click('button[data-tab="browse"]');
    await expect(page).toHaveURL(/.*tab=browse.*/);

    // Assuming we have mock data or the test env loads data correctly,
    // wait for cards list to populate and click the first dish card
    await page.waitForSelector('.dish-card', { state: 'visible' });
    const firstCard = page.locator('.dish-card').first();
    await firstCard.click();

    // Verify detail overlay opens
    const overlay = page.locator('#detail-overlay');
    await expect(overlay).toHaveClass(/open/);
    await expect(page).toHaveURL(/.*dish=.*/);

    // Click close button inside detail sheet
    const closeBtn = overlay.locator('.sheet-close-btn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      // Mobile close button or overlay click
      await overlay.click({ position: { x: 5, y: 5 } });
    }

    // Verify detail overlay closes and tab remains browse
    await expect(overlay).not.toHaveClass(/open/);
    await expect(page).toHaveURL(/.*tab=browse.*/);
  });
  
  test('Browser Back button safely closes overlays', async ({ page, isMobile }) => {
    await page.goto('/?week=test-week-123');
    await page.click('button[data-tab="browse"]');

    if (isMobile) {
      // Test mobile filter drawer
      await page.click('#mobile-filter-fab');
      const drawer = page.locator('#filter-drawer-overlay');
      await expect(drawer).toHaveClass(/open/);

      // Trigger back button
      await page.goBack();
      
      // Verify drawer is closed without navigating away from the page
      await expect(drawer).not.toHaveClass(/open/);
    }
  });
});
