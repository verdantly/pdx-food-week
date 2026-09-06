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

    await page.waitForSelector('#cards-browse .dish-card', { state: 'visible', timeout: 10000 });

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
    const featuredOrCard = page.locator('.landing-featured-card, .landing-card');
    await expect(featuredOrCard.first()).toBeVisible();
    await expect(page.locator('.landing-featured-card, .landing-card', { hasText: 'Burger Week' })).toContainText('124 spots');
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

  test('Saved tab crawl mode displays crawl-fab without being obscured by mobile-filter-fab', async ({ page, isMobile }) => {
    if (!isMobile) return;
    await page.goto('/?week=burger-2026&tab=browse');
    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });

    // Save 2 dishes
    const saveButtons = page.locator('.bookmark-btn');
    await saveButtons.nth(0).click();
    await saveButtons.nth(1).click();

    // Navigate to Saved tab
    if (isMobile) {
      await page.click('#compact-menu-btn');
      await page.waitForSelector('#compact-menu-dropdown', { state: 'visible' });
      await page.click('#compact-menu-dropdown [data-tab="saved"]');
    } else {
      await page.click('.nav-tab[data-tab="saved"]');
    }
    await expect(page.locator('#saved-plan-crawl-btn')).toBeVisible();

    // Verify filter FAB is initially visible when saved items exist
    const filterFab = page.locator('#mobile-filter-fab');
    await expect(filterFab).toBeVisible();

    // Activate Crawl Mode
    await page.click('#saved-plan-crawl-btn');

    // Crawl FAB should be visible
    const crawlFab = page.locator('#crawl-fab');
    await expect(crawlFab).toBeVisible();

    // Filter FAB must NOT be visible (no overlap or obscurity)
    await expect(filterFab).not.toBeVisible();

    // Cancel Crawl Mode
    await page.click('#saved-plan-crawl-btn');
    await expect(crawlFab).not.toBeVisible();
    await expect(filterFab).toBeVisible();
  });

  test('Landing hero row layout wraps as needed and matches landing-steps-grid margins', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.landing-hero-content', { state: 'visible' });

    // Test across several viewport sizes (landing-subtitle is always left-aligned)
    const viewports = [
      { width: 1440, height: 900, expectSameRow: true, expectedAlign: 'left' },
      { width: 1024, height: 768, expectSameRow: true, expectedAlign: 'left' },
      { width: 768, height: 1024, expectSameRow: true, expectedAlign: 'left' },
      { width: 480, height: 800, expectSameRow: false, expectedAlign: 'left' },
      { width: 375, height: 667, expectSameRow: false, expectedAlign: 'left' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const layout = await page.evaluate(() => {
        const heroContent = document.querySelector('.landing-hero-content');
        const stepsGrid = document.querySelector('.landing-steps-grid');
        const title = document.querySelector('.landing-title');
        const sub = document.querySelector('.landing-subtitle');

        const heroRect = heroContent.getBoundingClientRect();
        const stepsRect = stepsGrid.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        const subRect = sub.getBoundingClientRect();

        return {
          heroLeft: heroRect.left,
          heroWidth: heroRect.width,
          stepsLeft: stepsRect.left,
          stepsWidth: stepsRect.width,
          titleTop: titleRect.top,
          subTop: subRect.top,
          subAlign: window.getComputedStyle(sub).textAlign,
        };
      });

      // Margin/padding alignment check: hero-content and steps-grid should match left and width
      if (Math.abs(layout.heroLeft - layout.stepsLeft) > 1) {
        console.log(`Mismatch at width ${vp.width}:`, layout);
      }
      expect(Math.abs(layout.heroLeft - layout.stepsLeft)).toBeLessThanOrEqual(1);
      expect(Math.abs(layout.heroWidth - layout.stepsWidth)).toBeLessThanOrEqual(1);

      // Subtitle alignment check (always left-aligned)
      expect(layout.subAlign).toBe(vp.expectedAlign);

      // Same row check: if expected same row, vertical tops should be close
      const isSameRow = Math.abs(layout.titleTop - layout.subTop) < 25;
      expect(isSameRow).toBe(vp.expectSameRow);
    }
  });

  test('Landing grid renders 3-column desktop layout with unified featured week showcase and other weeks', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.landing-featured-showcase', { state: 'visible' });

    // Verify unified featured showcase is present with header and carousel
    const showcase = page.locator('.landing-featured-showcase');
    await expect(showcase).toBeVisible();
    await expect(showcase.locator('.featured-title')).toBeVisible();

    // Verify no emoji in featured showcase header
    const featuredEmoji = showcase.locator('.featured-showcase-header .landing-emoji');
    await expect(featuredEmoji).toHaveCount(0);

    // Verify carousel controls overlaying the photo inside showcase
    const prevBtn = page.locator('.landing-carousel-arrow-overlay.prev');
    const nextBtn = page.locator('.landing-carousel-arrow-overlay.next');
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();

    // Verify other weeks column is present with "More Food Weeks" subtitle
    const othersCol = page.locator('.landing-others-column');
    await expect(othersCol).toBeVisible();
    const othersSubtitle = othersCol.locator('.landing-others-title');
    await expect(othersSubtitle).toBeVisible();
    await expect(othersSubtitle).toHaveText('More Food Weeks');

    const otherCards = page.locator('.landing-others-list .landing-card');
    await expect(otherCards.first()).toBeVisible();

    // Verify "Explore Food Weeks" and "Featured Specials" headers are NOT in DOM
    const exploreHeading = page.locator('.landing-festivals-header');
    await expect(exploreHeading).toHaveCount(0);
    const featuredHeading = page.locator('.landing-carousel-heading');
    await expect(featuredHeading).toHaveCount(0);

    // Verify borderless and shadowless styling on landing cards and showcase
    const styleInfo = await page.evaluate(() => {
      const card = document.querySelector('.landing-card');
      const showcaseEl = document.querySelector('.landing-featured-showcase');
      const cardStyle = card ? window.getComputedStyle(card) : null;
      const featStyle = showcaseEl ? window.getComputedStyle(showcaseEl) : null;
      return {
        cardBorderWidth: cardStyle ? cardStyle.borderWidth : '',
        cardBorderStyle: cardStyle ? cardStyle.borderStyle : '',
        cardBoxShadow: cardStyle ? cardStyle.boxShadow : '',
        featBorderWidth: featStyle ? featStyle.borderWidth : '',
        featBorderStyle: featStyle ? featStyle.borderStyle : '',
        featBoxShadow: featStyle ? featStyle.boxShadow : '',
      };
    });

    expect(['0px', 'none'].includes(styleInfo.cardBorderWidth) || styleInfo.cardBorderStyle === 'none').toBe(true);
    expect(['0px', 'none'].includes(styleInfo.featBorderWidth) || styleInfo.featBorderStyle === 'none').toBe(true);
    expect(['none', ''].includes(styleInfo.cardBoxShadow) || styleInfo.cardBoxShadow.includes('rgba(0, 0, 0, 0)')).toBe(true);
    expect(['none', ''].includes(styleInfo.featBoxShadow) || styleInfo.featBoxShadow.includes('rgba(0, 0, 0, 0)')).toBe(true);

    // Verify hover underline effect
    const hoverTitle = page.locator('.landing-card').first();
    await hoverTitle.hover();
    const hoverDecoration = await page.evaluate(() => {
      const h3 = document.querySelector('.landing-card:hover h3');
      return h3 ? window.getComputedStyle(h3).textDecorationLine : '';
    });
    expect(hoverDecoration).toBe('underline');

    // Verify landing grid margins match landing-hero-content and landing-steps-grid
    const marginMatch = await page.evaluate(() => {
      const hero = document.querySelector('.landing-hero-content');
      const grid = document.querySelector('.landing-grid');
      const steps = document.querySelector('.landing-steps-grid');

      const heroRect = hero.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      const stepsRect = steps.getBoundingClientRect();

      return {
        leftDiff: Math.abs(heroRect.left - gridRect.left),
        widthDiff: Math.abs(heroRect.width - gridRect.width),
        stepsLeftDiff: Math.abs(gridRect.left - stepsRect.left),
        stepsWidthDiff: Math.abs(gridRect.width - stepsRect.width),
      };
    });

    expect(marginMatch.leftDiff).toBeLessThanOrEqual(1);
    expect(marginMatch.widthDiff).toBeLessThanOrEqual(1);
    expect(marginMatch.stepsLeftDiff).toBeLessThanOrEqual(1);
    expect(marginMatch.stepsWidthDiff).toBeLessThanOrEqual(1);
  });

  test('Landing grid stacks featured showcase before other weeks on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.landing-featured-showcase', { state: 'visible' });

    const order = await page.evaluate(() => {
      const showcase = document.querySelector('.landing-featured-showcase');
      const others = document.querySelector('.landing-others-column');

      const sRect = showcase.getBoundingClientRect();
      const oRect = others.getBoundingClientRect();

      return {
        showcaseBeforeOthers: sRect.bottom <= oRect.top + 10,
      };
    });

    expect(order.showcaseBeforeOthers).toBe(true);
  });

  test('Landing page meets WCAG accessibility standards', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.landing-featured-showcase', { state: 'visible' });

    // 1. Carousel region role and aria-roledescription
    const showcase = page.locator('.landing-featured-showcase');
    await expect(showcase).toHaveAttribute('role', 'region');
    await expect(showcase).toHaveAttribute('aria-roledescription', 'carousel');

    // 2. Screen reader live region
    const liveStatus = page.locator('#landing-carousel-live-status');
    await expect(liveStatus).toHaveAttribute('aria-live', 'polite');

    // 3. Slides carry group role and slide roledescription
    const firstSlide = page.locator('.landing-carousel-slide').first();
    await expect(firstSlide).toHaveAttribute('role', 'group');
    await expect(firstSlide).toHaveAttribute('aria-roledescription', 'slide');

    // 4. Dot controls have accessible names and aria-current
    const dots = page.locator('.landing-carousel-dot');
    await expect(dots.first()).toHaveAttribute('aria-current', 'true');
    await expect(dots.first()).toHaveAttribute('aria-label', /Go to special/);

    // 5. Arrow overlay buttons have accessible names
    const prevBtn = page.locator('.landing-carousel-arrow-overlay.prev');
    const nextBtn = page.locator('.landing-carousel-arrow-overlay.next');
    await expect(prevBtn).toHaveAttribute('aria-label', 'Previous special');
    await expect(nextBtn).toHaveAttribute('aria-label', 'Next special');
  });
});


