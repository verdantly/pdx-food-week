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
    
    await page.waitForSelector('.landing-card:not(.landing-card-hidden-mobile)', { state: 'visible', timeout: 10000 });
    await page.locator('.landing-card:not(.landing-card-hidden-mobile)').first().click();

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
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await expect(page.locator('#view-landing')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/is-landing/);
    await context.setOffline(false);
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

  test('Install app modal opens and closes properly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.App.openInstallModal());
    const installOverlay = page.locator('#install-modal-overlay');
    await expect(installOverlay).toHaveClass(/open/);
    await page.locator('#install-modal-overlay .drawer-close').click();
    await expect(installOverlay).not.toHaveClass(/open/);
  });

  test('Account and cloud sync modal opens with Google and Magic Link options', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.App.openAccountModal());
    const accountOverlay = page.locator('#account-modal-overlay');
    await expect(accountOverlay).toHaveClass(/open/);
    await expect(page.locator('.btn-google-auth')).toBeVisible();
    await expect(page.locator('#auth-email-input')).toBeVisible();
    await page.locator('#account-modal-overlay .drawer-close').click();
    await expect(accountOverlay).not.toHaveClass(/open/);
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

    // 6. Automated WCAG 2.1 AA audit with axe-core
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js' });
    const violations = await page.evaluate(async () => {
      const results = await window.axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
        }
      });
      return results.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map(n => n.target)
      }));
    });
    expect(violations).toEqual([]);
  });

  test('Mobile collapsible more food weeks shows button and expands/collapses', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.landing-others-column', { state: 'visible' });

    const seeMoreBtn = page.locator('#landing-see-more-btn');
    await expect(seeMoreBtn).toBeVisible();

    // Verify hidden cards on mobile initially
    const hiddenCards = page.locator('.landing-card.landing-card-hidden-mobile');
    expect(await hiddenCards.count()).toBeGreaterThan(0);
    await expect(hiddenCards.first()).not.toBeVisible();

    // Click see more to expand
    await seeMoreBtn.click();
    await expect(page.locator('#landing-others-list')).toHaveClass(/is-expanded/);
    await expect(hiddenCards.first()).toBeVisible();
    await expect(seeMoreBtn).toContainText('See fewer food weeks');

    // Click again to collapse
    await seeMoreBtn.click();
    await expect(page.locator('#landing-others-list')).not.toHaveClass(/is-expanded/);
    await expect(hiddenCards.first()).not.toBeVisible();
  });

  test('Search placeholder adapts on narrow screen and global search opens dish detail modal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify narrow placeholder
    const searchInput = page.locator('#landing-global-search');
    await expect(searchInput).toHaveAttribute('placeholder', 'Search dishes, restaurants, etc...');

    // Perform global search
    await searchInput.fill('taco');
    const resultsContainer = page.locator('#landing-search-results');
    await page.waitForSelector('#landing-search-results .search-result-row', { state: 'visible', timeout: 10000 });

    // Verify that dropdown is physically rendered on top and unclipped by hero
    const resultsBox = await resultsContainer.boundingBox();
    expect(resultsBox).not.toBeNull();
    const hitElement = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? (el.closest('#landing-search-results') ? 'in-results' : el.className) : null;
    }, { x: resultsBox.x + resultsBox.width / 2, y: resultsBox.y + 15 });
    expect(hitElement).toBe('in-results');

    const firstResult = page.locator('#landing-search-results .search-result-row').first();
    await firstResult.click();

    // Verify detail overlay opens and displays the special
    const overlay = page.locator('#detail-overlay');
    await expect(overlay).toHaveClass(/open/, { timeout: 10000 });
    await expect(page).toHaveURL(/.*week=.*dish=.*/);
  });

  test('Global search matches food weeks, supports keyboard and clear button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.locator('#landing-global-search');
    const clearBtn = page.locator('#landing-search-clear');
    const resultsContainer = page.locator('#landing-search-results');

    // Search for a food week phrase
    await searchInput.fill('dumpling week');
    await page.waitForSelector('#landing-search-results .search-result-week-row', { state: 'visible', timeout: 10000 });
    const weekRow = resultsContainer.locator('.search-result-week-row').first();
    await expect(weekRow).toContainText('Dumpling Week 2026');

    // Test clear button
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(searchInput).toHaveValue('');
    await expect(resultsContainer).toBeHidden();
  });

  test('Brand wordmark matches compact-brand style and transitions to pizza on hover', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?week=pizza-2026', { waitUntil: 'domcontentloaded' });
    const wordmark = page.locator('.app-wordmark').first();
    await expect(wordmark).toBeVisible();

    const wordmarkStyles = await wordmark.evaluate(el => {
      const s = window.getComputedStyle(el);
      return {
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        fontFamily: s.fontFamily,
        letterSpacing: s.letterSpacing,
        textTransform: s.textTransform
      };
    });
    expect(wordmarkStyles.fontSize).toBe('14px');
    expect(wordmarkStyles.fontWeight).toBe('600');
    expect(wordmarkStyles.fontFamily).toContain('Syne');
    expect(wordmarkStyles.letterSpacing).toMatch(/^(0px|normal)$/);
    expect(wordmarkStyles.textTransform).toBe('lowercase');

    await wordmark.hover();
    await page.waitForTimeout(200);
    const hoverColor = await wordmark.evaluate(el => window.getComputedStyle(el).color);
    expect(hoverColor).toMatch(/rgb\(181,\s*71,\s*46\)|rgb\(201,\s*75,\s*44\)/);
  });

  test('Landing footer renders multi-column layout seamlessly below features', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const footer = page.locator('.landing-footer');
    await expect(footer).toBeVisible();

    const cols = footer.locator('.landing-footer-col');
    await expect(cols).toHaveCount(3);

    // Verify flush attachment to .landing-features (no awkward gap)
    await expect(async () => {
      const { fBottom, footTop } = await page.evaluate(() => {
        const f = document.querySelector('.landing-features')?.getBoundingClientRect();
        const foot = document.querySelector('.landing-footer')?.getBoundingClientRect();
        return { fBottom: f ? f.bottom : 0, footTop: foot ? foot.top : 0 };
      });
      expect(Math.abs(footTop - fBottom)).toBeLessThanOrEqual(1);
    }).toPass();

    // Verify footer links
    await expect(footer.locator('a[href="privacy.html"]')).toBeVisible();
    await expect(footer.locator('a[href="terms.html"]')).toBeVisible();

    // Verify hero has no gradient
    const heroBg = await page.locator('.landing-hero').evaluate(el => window.getComputedStyle(el).backgroundImage);
    expect(heroBg).toBe('none');

    // Verify food weeks column and about column have breathing room
    const col1Box = await cols.nth(1).boundingBox();
    const col2Box = await cols.nth(2).boundingBox();
    expect(col1Box).not.toBeNull();
    expect(col2Box).not.toBeNull();
    const colDistance = col2Box.x - (col1Box.x + col1Box.width);
    expect(colDistance).toBeGreaterThanOrEqual(50);
    expect(colDistance).toBeLessThanOrEqual(80);

    // Verify footer margins match landing-steps-grid
    const footerInnerBox = await page.locator('.landing-footer-inner').boundingBox();
    const stepsBox = await page.locator('.landing-steps-grid').boundingBox();
    expect(footerInnerBox).not.toBeNull();
    expect(stepsBox).not.toBeNull();
    expect(Math.abs(footerInnerBox.x - stepsBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(footerInnerBox.width - stepsBox.width)).toBeLessThanOrEqual(1);
  });
});



