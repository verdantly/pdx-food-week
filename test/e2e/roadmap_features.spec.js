import { test, expect } from '@playwright/test';

test.describe('Roadmap Features E2E', () => {
  test('Day-of-Week filter pills correctly filter restaurants by schedule', async ({ page, isMobile }) => {
    await page.goto('/?week=fried-chicken-2026');
    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });

    if (isMobile) {
      await page.click('#mobile-filter-fab');
      await expect(page.locator('#filter-drawer-overlay')).toHaveClass(/open/);

      const dayFilters = page.locator('#browse-day-filters .day-chip');
      await expect(dayFilters.first()).toBeVisible();

      // Verify Tuesday filter excludes E-San Thai Woodstock (Closed Tuesday's)
      const tueBtn = dayFilters.filter({ hasText: 'Tue' });
      await expect(tueBtn).toBeVisible();
      await tueBtn.click();

      await page.click('#filter-drawer-overlay .btn-apply');
      await expect(page.locator('#filter-drawer-overlay')).not.toHaveClass(/open/);

      // E-San Thai Woodstock should NOT be visible
      const eSanCard = page.locator('.dish-card', { hasText: 'E-San Thai Woodstock' });
      await expect(eSanCard).toHaveCount(0);

      // Monday filter includes E-San Thai Woodstock
      await page.click('#mobile-filter-fab');
      await expect(page.locator('#filter-drawer-overlay')).toHaveClass(/open/);
      const monBtn = dayFilters.filter({ hasText: 'Mon' });
      await monBtn.click();

      await page.click('#filter-drawer-overlay .btn-apply');
      await expect(page.locator('#filter-drawer-overlay')).not.toHaveClass(/open/);
      await expect(page.locator('.dish-card', { hasText: 'E-San Thai Woodstock' })).toHaveCount(1);
    } else {
      // Desktop: test the Day filter dropdown with checkboxes
      const dropdownBtn = page.locator('#day-filter-dropdown-btn');
      await expect(dropdownBtn).toBeVisible();
      await dropdownBtn.click();

      const dropdownMenu = page.locator('#day-filter-dropdown-menu');
      await expect(dropdownMenu).toBeVisible();

      // Select Tuesday
      const tueLabel = dropdownMenu.locator('.day-dropdown-item', { hasText: 'Tue' });
      await expect(tueLabel).toBeVisible();
      await tueLabel.click();

      // Close dropdown
      await page.click('body', { position: { x: 10, y: 10 } });
      await expect(dropdownMenu).toBeHidden();

      // E-San Thai Woodstock should NOT be visible (Closed Tuesday)
      const eSanCard = page.locator('.dish-card', { hasText: 'E-San Thai Woodstock' });
      await expect(eSanCard).toHaveCount(0);

      // Reopen dropdown and toggle Monday
      await dropdownBtn.click();
      await expect(dropdownMenu).toBeVisible();
      const monLabel = dropdownMenu.locator('.day-dropdown-item', { hasText: 'Mon' });
      await monLabel.click();
      await page.click('body', { position: { x: 10, y: 10 } });
      await expect(dropdownMenu).toBeHidden();

      // E-San Thai Woodstock is open Monday, so it should now be visible
      await expect(page.locator('.dish-card', { hasText: 'E-San Thai Woodstock' })).toHaveCount(1);
    }
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

    // Initially, Share Rankings button is hidden before entering Ranking Mode
    const shareRankingsBtn = page.locator('#saved-picks-card-btn');
    await expect(shareRankingsBtn).toBeHidden();

    // Toggle Ranking Mode via #saved-rank-mode-btn
    const rankModeBtn = page.locator('#saved-rank-mode-btn');
    await expect(rankModeBtn).toBeVisible();
    await rankModeBtn.click();

    // Verify #1 and #2 badges
    const rank1 = page.locator('.saved-rank-badge.rank-gold');
    await expect(rank1).toBeVisible();
    await expect(rank1).toHaveText('#1');

    const rank2 = page.locator('.saved-rank-badge.rank-silver');
    await expect(rank2).toBeVisible();
    await expect(rank2).toHaveText('#2');

    // Verify Share Rankings button is now visible with updated text
    await expect(shareRankingsBtn).toBeVisible();
    await expect(shareRankingsBtn).toHaveText('Share Rankings');
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

  test('Saved tab More dropdown allows entering bulk remove mode and removing spots after confirmation', async ({ page, isMobile }) => {
    await page.goto('/?week=burger-2026');
    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });

    // Save three dishes
    const bookmarkBtns = page.locator('.dish-card .bookmark-btn');
    await bookmarkBtns.nth(0).click();
    await bookmarkBtns.nth(1).click();
    await bookmarkBtns.nth(2).click();

    // Navigate to Saved tab
    if (isMobile) {
      await page.click('#compact-menu-btn');
      await page.click('.compact-menu-item[data-tab="saved"]');
    } else {
      await page.click('.nav-tab[data-tab="saved"]');
    }

    await page.waitForSelector('#cards-saved .dish-card', { state: 'visible', timeout: 10000 });
    const initialSavedCards = page.locator('#cards-saved .dish-card');
    await expect(initialSavedCards).toHaveCount(3);

    // Click More dropdown button
    const moreBtn = page.locator('#saved-more-btn');
    await expect(moreBtn).toBeVisible();
    await moreBtn.click();

    // Verify More dropdown menu is open
    const actionsMenu = page.locator('#saved-actions-menu');
    await expect(actionsMenu).toBeVisible();

    // Click "Manage / Remove Spots"
    const manageBtn = page.locator('#saved-manage-mode-btn');
    await expect(manageBtn).toBeVisible();
    await manageBtn.click();

    // Bulk actions bar should now be visible
    const bulkActionsBar = page.locator('#saved-bulk-actions');
    await expect(bulkActionsBar).toBeVisible();

    // Cards should have bulk select indicators
    const selectIndicators = page.locator('#cards-saved .bulk-select-indicator');
    await expect(selectIndicators.first()).toBeVisible();

    // Click first card to select it
    await initialSavedCards.nth(0).click();
    const removeBtn = page.locator('#saved-bulk-remove-btn');
    await expect(removeBtn).toBeEnabled();
    await expect(removeBtn).toContainText('Remove (1)');

    // Click "Select All"
    await page.click('#saved-select-all-btn');
    await expect(removeBtn).toContainText('Remove (3)');

    // Click "Deselect All"
    await page.click('#saved-deselect-all-btn');
    await expect(removeBtn).toBeDisabled();
    await expect(removeBtn).toContainText('Remove (0)');

    // Select the first card again
    await initialSavedCards.nth(0).click();
    await expect(removeBtn).toBeEnabled();
    await expect(removeBtn).toContainText('Remove (1)');

    // Click Remove (1) to open confirmation modal
    await removeBtn.click();
    const confirmModal = page.locator('#bulk-remove-confirm-modal');
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal.locator('#bulk-remove-count')).toHaveText('1 spot');

    // Confirm removal
    await confirmModal.locator('#confirm-remove-btn').click();
    await expect(confirmModal).toBeHidden();

    // Card count in saved tab should now be 2
    await expect(page.locator('#cards-saved .dish-card')).toHaveCount(2);

    // Normal actions should be restored
    await expect(page.locator('#saved-normal-actions')).toBeVisible();
  });

  test('Tablet viewports show inline meta and switcher, header search slot, and floating FAB instead of controls row', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('/?week=burger-2026');
    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });

    // .header-meta-row should be visible and displayed as a flex row
    const metaRow = page.locator('.header-meta-row');
    await expect(metaRow).toBeVisible();

    // The header-search-slot should be visible in app-header
    const headerSearch = page.locator('#header-search-slot');
    await expect(headerSearch).toBeVisible();

    // The inline .header-controls-row should be hidden on tablet
    const controlsRow = page.locator('#view-browse .header-controls-row');
    await expect(controlsRow).toBeHidden();

    // Floating FAB should be visible on tablet
    const fab = page.locator('#mobile-filter-fab');
    await expect(fab).toBeVisible();
  });

  test('Breakpoints > 1440px do not render underline directly under .tab-header-title in saved view', async ({ page }) => {
    // Set wide desktop viewport
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/?week=burger-2026');
    await page.waitForSelector('.dish-card', { state: 'visible', timeout: 10000 });

    // Save a spot so saved tab has contents
    const saveBtn = page.locator('.dish-card .bookmark-btn').first();
    await saveBtn.click();

    // Navigate to saved tab
    await page.click('.nav-tab[data-tab="saved"]');
    await expect(page.locator('#view-saved')).toBeVisible();

    const titleEl = page.locator('#saved-header-title');
    await expect(titleEl).toBeVisible();

    // Verify .tab-header-title::after is hidden via computed style
    const pseudoDisplay = await page.evaluate(() => {
      const el = document.getElementById('saved-header-title');
      return window.getComputedStyle(el, '::after').display;
    });
    expect(pseudoDisplay).toBe('none');
  });
});


