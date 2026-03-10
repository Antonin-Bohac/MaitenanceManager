const { test, expect } = require('@playwright/test');

test.describe('Dashboard responsive layout', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.stats-grid');
  });

  test('stats grid is visible with 6 cards', async ({ page }) => {
    const grid = page.locator('.stats-grid');
    await expect(grid).toBeVisible();
    const cards = grid.locator('.stat-card');
    await expect(cards).toHaveCount(6);
  });

  test('sidebar navigation works', async ({ page, isMobile }) => {
    if (isMobile) {
      // On mobile/tablet, sidebar is off-screen initially
      const sidebar = page.locator('#sidebar');
      await expect(sidebar).not.toBeInViewport();

      // Open sidebar via hamburger
      await page.click('#mobile-menu-btn');
      await expect(sidebar).toHaveClass(/open/);

      // Navigate to Equipment
      await page.click('.nav-item[data-view="equipment"]');
      await expect(sidebar).not.toHaveClass(/open/);
      await expect(page.locator('#view-equipment')).toHaveClass(/active/);
    } else {
      // On desktop, sidebar is always visible
      const sidebar = page.locator('#sidebar');
      await expect(sidebar).toBeVisible();

      await page.click('.nav-item[data-view="equipment"]');
      await expect(page.locator('#view-equipment')).toHaveClass(/active/);
    }
  });

  test('filter bar is usable', async ({ page }) => {
    const filterSelect = page.locator('#filter-status');
    await expect(filterSelect).toBeVisible();

    const searchInput = page.locator('#filter-search');
    await expect(searchInput).toBeVisible();
  });

  test('task table is scrollable on small screens', async ({ page, isMobile }) => {
    if (isMobile) {
      const wrapper = page.locator('.table-wrapper').first();
      const wrapperBox = await wrapper.boundingBox();
      const table = page.locator('.data-table').first();
      const tableBox = await table.boundingBox();

      if (tableBox && wrapperBox) {
        expect(tableBox.width).toBeGreaterThanOrEqual(wrapperBox.width);
      }
    }
  });

  test('stat cards use 2-column layout on mobile', async ({ page, isMobile }) => {
    if (!isMobile) return;

    const grid = page.locator('.stats-grid');
    const cards = grid.locator('.stat-card');
    const firstCard = await cards.nth(0).boundingBox();
    const secondCard = await cards.nth(1).boundingBox();

    if (firstCard && secondCard) {
      // 2-column: second card on the same row
      expect(secondCard.y).toBeCloseTo(firstCard.y, 0);
    }
  });

  test('modal fits screen on all viewports', async ({ page, isMobile }) => {
    await page.click('#btn-new-task');
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    const modalBox = await modal.boundingBox();
    const viewport = page.viewportSize();

    // Modal should not exceed viewport width
    expect(modalBox.width).toBeLessThanOrEqual(viewport.width);

    if (isMobile) {
      // Modal should be near full width on mobile/tablet
      expect(modalBox.width).toBeGreaterThan(viewport.width * 0.9);
    }
  });

  test('theme toggle works', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.click('#theme-toggle');
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.click('#theme-toggle');
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('all nav views load without JS errors', async ({ page, isMobile }) => {
    const views = ['dashboard', 'equipment', 'tasks', 'plans'];
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    for (const view of views) {
      if (isMobile) {
        await page.click('#mobile-menu-btn');
        await page.waitForTimeout(300);
      }
      await page.click(`.nav-item[data-view="${view}"]`);
      await expect(page.locator(`#view-${view}`)).toHaveClass(/active/);
      await page.waitForTimeout(200);
    }

    expect(errors).toHaveLength(0);
  });
});

test.describe('Mobile/tablet-specific tests', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobile/tablet only');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.stats-grid');
  });

  test('hamburger menu button is visible', async ({ page }) => {
    const menuBtn = page.locator('#mobile-menu-btn');
    await expect(menuBtn).toBeVisible();
  });

  test('topbar date is hidden', async ({ page }) => {
    const dateEl = page.locator('.topbar-center');
    await expect(dateEl).not.toBeVisible();
  });

  test('sidebar backdrop closes sidebar', async ({ page }) => {
    const sidebar = page.locator('#sidebar');
    const backdrop = page.locator('#sidebar-backdrop');

    await page.click('#mobile-menu-btn');
    await expect(sidebar).toHaveClass(/open/);
    await expect(backdrop).toHaveClass(/active/);

    await page.click('#sidebar-backdrop', { force: true });
    await expect(sidebar).not.toHaveClass(/open/);
    await expect(backdrop).not.toHaveClass(/active/);
  });

  test('equipment view stacks tree and detail vertically', async ({ page }) => {
    await page.click('#mobile-menu-btn');
    await page.click('.nav-item[data-view="equipment"]');

    const treePanel = page.locator('.tree-panel');
    const detailPanel = page.locator('.detail-panel');

    const treePanelBox = await treePanel.boundingBox();
    const detailPanelBox = await detailPanel.boundingBox();

    if (treePanelBox && detailPanelBox) {
      // Tree should be above detail (stacked vertically)
      expect(treePanelBox.y).toBeLessThan(detailPanelBox.y);
      // Both should take full width
      expect(treePanelBox.width).toBeCloseTo(detailPanelBox.width, -1);
    }
  });

  test('less-important table columns are hidden', async ({ page }) => {
    const factoryHeader = page.locator('.col-factory').first();
    await expect(factoryHeader).toBeHidden();
  });
});

test.describe('Desktop-specific tests', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop only');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.stats-grid');
  });

  test('sidebar is always visible with labels', async ({ page }) => {
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();

    const navLabel = page.locator('.nav-item[data-view="dashboard"] span');
    await expect(navLabel).toBeVisible();
  });

  test('hamburger menu is hidden on desktop', async ({ page }) => {
    const menuBtn = page.locator('#mobile-menu-btn');
    await expect(menuBtn).not.toBeVisible();
  });

  test('topbar date is visible', async ({ page }) => {
    const dateEl = page.locator('.topbar-date');
    await expect(dateEl).toBeVisible();
  });
});
