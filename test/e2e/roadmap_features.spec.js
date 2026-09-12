import { test, expect } from '@playwright/test';

test.describe('Roadmap Features E2E', () => {
  test('Day-of-Week filter pills correctly filter restaurants by schedule', async ({ page, isMobile }) => {
    await page.goto('/?week=fried-chicken-2026');
    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });

    if (isMobile) {
      await page.click('#mobile-filter-fab');
      await expect(page.locator('#filter-drawer-overlay')).toHaveClass(/open/);
    }

    const dayFilters = page.locator('#browse-day-filters .day-chip');
    await expect(dayFilters.first()).toBeVisible();

    // Verify Tuesday filter excludes E-San Thai Woodstock (Closed Tuesday's)
    const tueBtn = dayFilters.filter({ hasText: 'Tue' });
    await expect(tueBtn).toBeVisible();
    await tueBtn.click();

    if (isMobile) {
      await page.click('#filter-drawer-overlay .btn-apply');
      await expect(page.locator('#filter-drawer-overlay')).not.toHaveClass(/open/);
    }

    // E-San Thai Woodstock should NOT be visible
    const eSanCard = page.locator('.dish-card', { hasText: 'E-San Thai Woodstock' });
    await expect(eSanCard).toHaveCount(0);

    // Monday filter includes E-San Thai Woodstock
    if (isMobile) {
      await page.click('#mobile-filter-fab');
      await expect(page.locator('#filter-drawer-overlay')).toHaveClass(/open/);
    }
    const monBtn = dayFilters.filter({ hasText: 'Mon' });
    await monBtn.click();

    if (isMobile) {
      await page.click('#filter-drawer-overlay .btn-apply');
      await expect(page.locator('#filter-drawer-overlay')).not.toHaveClass(/open/);
    }
    await expect(page.locator('.dish-card', { hasText: 'E-San Thai Woodstock' })).toHaveCount(1);
  });

  test('Status badges have no pulsing dots or live dot elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.landing-card', { state: 'visible', timeout: 10000 });

    const liveDots = page.locator('.badge-dot-live');
    await expect(liveDots).toHaveCount(0);

    const badges = page.locator('.landing-status-badge');
    expect(await badges.count()).toBeGreaterThan(0);
  });

  test('Install App links are present in footers alongside Privacy Policy', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.landing-footer', { state: 'visible', timeout: 10000 });

    const landingInstallLink = page.locator('.landing-footer-links .install-app-link');
    await expect(landingInstallLink).toBeVisible();
    await expect(landingInstallLink).toHaveText('Install App');

    // Go to a week view
    await page.goto('/?week=burger-2026');
    await page.waitForSelector('.sidebar-footer', { state: 'attached', timeout: 10000 });

    const sidebarInstallLink = page.locator('.sidebar-footer .install-app-link');
    await expect(sidebarInstallLink).toHaveCount(1);
  });

  test('Notification Preferences modal opens and toggles work', async ({ page, isMobile }) => {
    await page.goto('/?week=burger-2026');
    await page.waitForSelector('#view-browse', { state: 'visible', timeout: 10000 });

    const notifModal = page.locator('#notifications-modal');
    await expect(notifModal).toBeHidden();

    // Trigger modal via header or compact menu
    if (isMobile) {
      await page.click('#compact-menu-btn');
      await page.click('.compact-menu-item:has-text("Notifications")');
    } else {
      await page.click('.header-notif-btn');
    }

    await expect(notifModal).toBeVisible();

    const switchToggles = page.locator('.notif-switch');
    await expect(switchToggles.first()).toBeVisible();

    // Close modal
    await notifModal.locator('.drawer-close').click();
    await expect(notifModal).toBeHidden();
  });

  test('Saved tab custom sort displays ordinal rank badges and Share Picks button', async ({ page, isMobile }) => {
    await page.goto('/?week=burger-2026');
    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });

    // Save first two dishes
    const bookmarkBtns = page.locator('.dish-card .bookmark-btn');
    await bookmarkBtns.nth(0).click();
    await bookmarkBtns.nth(1).click();

    // Navigate to Saved tab
    if (isMobile) {
      await page.click('#compact-menu-btn');
      await page.click('.compact-menu-item[data-tab="saved"]');
    } else {
      await page.click('.nav-tab[data-tab="saved"]');
    }

    await page.waitForSelector('#cards-saved .dish-card', { state: 'visible', timeout: 10000 });

    // On mobile, sort might be in drawer or header
    if (isMobile) {
      await page.click('#mobile-filter-fab');
      const customBtn = page.locator('#saved-sort-section button.filter-chip:has-text("Custom")');
      await customBtn.click();
      await page.click('#filter-drawer-overlay .btn-apply');
    } else {
      const customSortBtn = page.locator('#saved-sort-section button.filter-chip:has-text("Custom")');
      await customSortBtn.click();
    }

    // Verify #1 and #2 badges
    const rank1 = page.locator('.saved-rank-badge.rank-gold');
    await expect(rank1).toBeVisible();
    await expect(rank1).toHaveText('#1');

    const rank2 = page.locator('.saved-rank-badge.rank-silver');
    await expect(rank2).toBeVisible();
    await expect(rank2).toHaveText('#2');

    // Verify Share Saved button
    const shareSavedBtn = page.locator('#saved-picks-card-btn');
    await expect(shareSavedBtn).toBeVisible();
    await expect(shareSavedBtn).toHaveText('Share Saved');
  });

  test('Detail sheet displays restaurant days and hours schedule', async ({ page }) => {
    await page.goto('/?week=fried-chicken-2026');
    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });

    // Open E-San Thai Woodstock detail sheet (which has "(Closed Tuesday's)")
    const eSanCard = page.locator('.dish-card', { hasText: 'E-San Thai Woodstock' });
    await eSanCard.click();

    const detailOverlay = page.locator('#detail-overlay');
    await expect(detailOverlay).toHaveClass(/open/);

    const scheduleEl = page.locator('#detail-sheet-content .sheet-schedule');
    await expect(scheduleEl).toBeVisible();
    await expect(scheduleEl).toContainText('Closed Tuesday');

    // Close detail
    const closeBtn = detailOverlay.locator('.sheet-close-btn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await detailOverlay.click({ position: { x: 5, y: 5 } });
    }
    await expect(detailOverlay).not.toHaveClass(/open/);
  });

  test('Mobile filter drawer displays Days label stacked above pills', async ({ page, isMobile }) => {
    if (!isMobile) return;

    await page.goto('/?week=burger-2026');
    await page.waitForSelector('#mobile-filter-fab', { state: 'visible', timeout: 10000 });

    await page.click('#mobile-filter-fab');
    const overlay = page.locator('#filter-drawer-overlay');
    await expect(overlay).toHaveClass(/open/);
    const drawer = overlay.locator('.filter-drawer');
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(400); // Wait for CSS translateY transition

    const dayFilter = overlay.locator('#browse-day-filters');
    await expect(dayFilter).toBeVisible();

    const label = dayFilter.locator('.filter-label');
    const firstChip = dayFilter.locator('.day-chip').first();

    const labelBox = await label.boundingBox();
    const chipBox = await firstChip.boundingBox();

    // The label is stacked above the chips (label bottom <= chip top)
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(chipBox.y + 2);

    await page.click('#filter-drawer-overlay .drawer-close');
  });

  test('Compact top bar has only Search and Menu, with Avatar inside compact menu', async ({ page, isMobile }) => {
    if (!isMobile) return;

    await page.goto('/?week=burger-2026');
    await page.waitForSelector('.compact-app-bar', { state: 'visible', timeout: 10000 });

    // Verify top bar actions only have compact-search-btn and compact-menu-btn
    const actionButtons = page.locator('.compact-app-bar .compact-actions button');
    await expect(actionButtons).toHaveCount(2);
    await expect(page.locator('#compact-search-btn')).toBeVisible();
    await expect(page.locator('#compact-menu-btn')).toBeVisible();
    await expect(page.locator('#compact-account-btn')).toHaveCount(0);

    // Open compact menu
    await page.click('#compact-menu-btn');
    const compactMenu = page.locator('#compact-menu-dropdown');
    await expect(compactMenu).toBeVisible();

    // Verify account menu button has inline avatar
    const accountBtn = page.locator('.compact-menu-item-account');
    await expect(accountBtn).toBeVisible();
    const inlineAvatar = accountBtn.locator('.menu-avatar-inline.user-avatar-btn');
    await expect(inlineAvatar).toBeVisible();

    // Avatar should be to the left of the text label
    const avatarBox = await inlineAvatar.boundingBox();
    const labelSpan = accountBtn.locator('.auth-logged-out');
    const labelBox = await labelSpan.boundingBox();
    expect(avatarBox.x + avatarBox.width).toBeLessThanOrEqual(labelBox.x + 2);
  });
});

