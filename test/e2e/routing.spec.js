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

  test('Initial visit to root URL shows Landing Page by default', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const landingView = page.locator('#view-landing');
    await expect(landingView).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/is-landing/);
    const landingHero = page.locator('.landing-hero');
    await expect(landingHero).toBeVisible();
    await expect(page.locator('#header-title')).toHaveText(/PDX\s*Food Week/);
    
    // Ensure landing cards render properly with spots count
    const landingCards = page.locator('.landing-card');
    await expect(landingCards.first()).toBeVisible();
    await expect(page.locator('.landing-card', { hasText: 'Burger Week' })).toContainText('124 spots');
  });

  test('Header title displays PDX Food Week on root landing page and updates when navigating to a week', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#header-title')).toHaveText(/PDX\s*Food Week/);

    await page.goto('/?week=taco-2026');
    await expect(page.locator('#header-title')).toHaveText(/Taco\s*Week\s*2026/);
  });

  test('Server-rendered HTML contains is-landing body class and generic header before JS execution', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('body')).toHaveClass(/is-landing/);
    await expect(page.locator('#view-landing')).toHaveClass(/active/);
    await expect(page.locator('#header-title')).toHaveText(/PDX\s*Food Week/);
    await context.close();
  });

  test('Data script loading failure gracefully falls back to Landing Page', async ({ page }) => {
    await page.route('**/data/*.js*', route => route.abort());
    await page.goto('/?week=invalid-week', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#view-landing')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/is-landing/);
  });
});
