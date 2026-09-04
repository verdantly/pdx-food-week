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

  test('Visiting root URL overrides any prior week saved in localStorage', async ({ page }) => {
    await page.goto('/?week=taco-2026', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('pdx_food_week_state', JSON.stringify({ currentWeekId: 'taco-2026' }));
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#view-landing')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/is-landing/);
    await expect(page.locator('#header-title')).toHaveText(/PDX\s*Food Week/);
  });

  test('Clicking brand logo in header from a week view navigates back to Landing Page', async ({ page, isMobile }) => {
    await page.goto('/?week=taco-2026', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });
    
    const logo = isMobile ? page.locator('.compact-brand') : page.locator('.app-wordmark').first();
    await logo.click();

    await expect(page.locator('#view-landing')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/is-landing/);
    await expect(page).not.toHaveURL(/.*week=.*/);
  });

  test('URL query parameter variations (?week=, ?tab=, index.html) fall back to Landing Page', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#view-landing')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/is-landing/);

    await page.goto('/?week=', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#view-landing')).toBeVisible();

    await page.goto('/?week=invalid-week', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#view-landing')).toBeVisible();
  });

  test('Service worker offline load serves Landing Page on root URL', async ({ context, page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await expect(page.locator('#view-landing')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/is-landing/);
  });

  test('Map tab search bar filters locations and clear button resets query', async ({ page }) => {
    await page.goto('/?week=taco-2026&tab=map', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#map-search-input', { state: 'visible', timeout: 10000 });

    const mapSearchInput = page.locator('#map-search-input');
    const mapSearchClearBtn = page.locator('#map-search-clear-btn');
    const mapStatsRow = page.locator('#map-stats-row');

    await expect(mapSearchInput).toBeVisible();
    await expect(mapSearchClearBtn).toBeHidden();
    await expect(mapStatsRow).toBeHidden();

    // Type query
    await mapSearchInput.fill('taco');
    await expect(mapSearchClearBtn).toBeVisible();
    await expect(mapStatsRow).toBeVisible();
    await expect(page.locator('#map-stat-count')).not.toHaveText('0');

    // Click clear button
    await mapSearchClearBtn.click();
    await expect(mapSearchInput).toHaveValue('');
    await expect(mapSearchClearBtn).toBeHidden();
    await expect(mapStatsRow).toBeHidden();
  });

  test('Map tab searching "brie" matches exactly 1 location on Burger Week', async ({ page }) => {
    await page.goto('/?week=burger-2026&tab=map', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#map-search-input', { state: 'visible', timeout: 10000 });

    const mapSearchInput = page.locator('#map-search-input');
    await mapSearchInput.fill('brie');

    await expect(page.locator('#map-stats-row')).toBeVisible();
    await expect(page.locator('#map-stat-count')).toHaveText('1');
    await expect(page.locator('#map-stat-label')).toHaveText('matching location');
  });

  test('Direct dish link with ?week= and ?dish= opens dish detail modal', async ({ page }) => {
    await page.goto('/?week=burger-2026&dish=248616', { waitUntil: 'domcontentloaded' });
    const detailOverlay = page.locator('#detail-overlay');
    await expect(detailOverlay).toHaveClass(/open/, { timeout: 10000 });
    await expect(page.locator('.sheet-dish')).toContainText('Down the Hatch Burger');
  });

  test('Shared static page /d/... redirects and opens dish detail modal', async ({ page }) => {
    await page.goto('/d/burger-2026-248616.html', { waitUntil: 'domcontentloaded' });
    const detailOverlay = page.locator('#detail-overlay');
    await expect(detailOverlay).toHaveClass(/open/, { timeout: 10000 });
    await expect(page.locator('.sheet-dish')).toContainText('Down the Hatch Burger');
  });

  test('Fried Chicken Week loads and displays dishes correctly', async ({ page }) => {
    await page.goto('/?week=fried-chicken-2026', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });
    const cards = page.locator('.dish-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(20);
    await expect(page.locator('#header-title')).toContainText('Fried Chicken Week');
  });

  test('Every registered food week loads successfully without console errors or failed scripts', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const weekIds = await page.evaluate(() => (window.FOOD_WEEKS || []).map(w => w.id));
    expect(weekIds.length).toBeGreaterThan(0);

    for (const weekId of weekIds) {
      await page.goto(`/?week=${weekId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });
      const cards = page.locator('.dish-card');
      expect(await cards.count()).toBeGreaterThan(0);
    }

    const fatalErrors = consoleErrors.filter(err => err.includes('undefined') || err.includes('Error loading data'));
    expect(fatalErrors).toEqual([]);
  });

  test('Dynamically added new week appears in switchers and renders cleanly in browser', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.App !== 'undefined');

    // Inject a new mock week into window.FOOD_WEEKS and trigger switcher rendering
    await page.evaluate(() => {
      window.FOOD_WEEKS.push({
        id: 'mock-dumpling-2027',
        name: 'Dumpling Week 2027',
        organizer: 'Portland Mercury',
        dataFile: 'mockdumpling2027.js',
        emoji: '🥟',
        totalLocations: 1,
        color: '#10B981',
        dates: 'November 1–7, 2027',
        filters: [{ id: 'vegan', label: 'Vegan' }]
      });

      // Hydrate dropdown switchers dynamically
      window.App.renderWeekSwitchers();
    });

    // Verify option appears in dropdown
    const option = page.locator('#week-switcher option[value="mock-dumpling-2027"]');
    await expect(option).toHaveCount(1);
    await expect(option).toContainText('Dumpling Week');
  });
});


