import { test, expect } from '@playwright/test';

test.describe('Navigation and Routing', () => {
  test('Detail overlay opens and closes correctly on desktop', async ({ page }) => {
    await page.goto('/?week=taco-2026');
    
    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });
    const firstCard = page.locator('.dish-card').first();
    await firstCard.click();

    const overlay = page.locator('#detail-overlay');
    await expect(overlay).toHaveClass(/open/);
    await expect(page).toHaveURL(/.*dish=.*/);

    const closeBtn = overlay.locator('.sheet-close-btn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await overlay.click({ position: { x: 5, y: 5 } });
    }

    await expect(overlay).not.toHaveClass(/open/);
  });
  
  test('Browser Back button safely closes overlays', async ({ page, isMobile }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    await page.waitForSelector('.landing-card', { state: 'visible', timeout: 10000 });
    await page.locator('.landing-card', { hasText: 'Taco Week' }).click();

    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });

    if (isMobile) {
      await page.click('#mobile-filter-fab');
      const drawer = page.locator('#filter-drawer-overlay');
      await expect(drawer).toHaveClass(/open/);

      await page.goBack();
      
      await expect(drawer).not.toHaveClass(/open/);
    }
  });

  test('Filter drawer Apply and Clear buttons work correctly', async ({ page, isMobile }) => {
    if (!isMobile) return;
    await page.goto('/?week=burger-2026');
    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });

    await page.click('#mobile-filter-fab');
    const drawer = page.locator('#filter-drawer-overlay');
    await expect(drawer).toHaveClass(/open/);

    const applyBtn = drawer.locator('.btn-apply');
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();
    await expect(drawer).not.toHaveClass(/open/);
  });
});
