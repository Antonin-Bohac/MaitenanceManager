const { test, expect } = require('@playwright/test');

test.describe('Task detail pane', () => {

  let taskTitle;

  test.beforeEach(async ({ page }) => {
    taskTitle = `TestTask-${Date.now()}`;
    const f = await (await page.request.post('/api/factories', { data: { name: 'PaneFactory' } })).json();
    const s = await (await page.request.post('/api/sections', { data: { name: 'PaneSection', factory_id: f.id } })).json();
    const e = await (await page.request.post('/api/equipment', { data: { name: 'PaneEquip', section_id: s.id } })).json();
    await page.request.post('/api/maintenance/tasks', {
      data: { title: taskTitle, description: 'Pane test description', due_date: '2026-06-01', equipment_id: e.id }
    });
    await page.goto('/');
    await page.waitForSelector('#task-tbody tr');
  });

  async function openTestTask(page) {
    const row = page.locator(`#task-tbody tr`, { hasText: taskTitle });
    await row.click();
    await expect(page.locator('#task-detail-panel')).toHaveClass(/open/);
  }

  test('clicking a task row opens the detail panel', async ({ page }) => {
    await openTestTask(page);
    await expect(page.locator('#detail-title')).toContainText(taskTitle);
  });

  test('close button closes the panel', async ({ page }) => {
    await openTestTask(page);
    await page.click('#detail-close');
    await expect(page.locator('#task-detail-panel')).not.toHaveClass(/open/);
  });

  test('panel shows task metadata', async ({ page }) => {
    await openTestTask(page);
    await expect(page.locator('#detail-title')).toContainText(taskTitle);
    await expect(page.locator('#detail-description')).toContainText('Pane test description');
    await expect(page.locator('#detail-breadcrumb')).toContainText('PaneFactory');
    await expect(page.locator('#detail-status-select')).toBeVisible();
    await expect(page.locator('#detail-priority-select')).toBeVisible();
  });

  test('notes can be edited and saved', async ({ page }) => {
    await openTestTask(page);
    await page.click('#detail-notes-edit');
    await expect(page.locator('#detail-notes-editor')).toBeVisible();
    await page.fill('#detail-notes-textarea', 'Test note content');
    await page.click('#detail-notes-save');
    await expect(page.locator('#detail-notes-display')).toContainText('Test note content');
    await expect(page.locator('#detail-notes-editor')).not.toBeVisible();
  });

  test('notes cancel discards changes', async ({ page }) => {
    await openTestTask(page);
    await page.click('#detail-notes-edit');
    await page.fill('#detail-notes-textarea', 'Unsaved content');
    await page.click('#detail-notes-cancel');
    await expect(page.locator('#detail-notes-editor')).not.toBeVisible();
    await expect(page.locator('#detail-notes-display')).not.toContainText('Unsaved content');
  });

  test('file upload area is visible', async ({ page }) => {
    await openTestTask(page);
    await expect(page.locator('#detail-upload-area')).toBeVisible();
  });

  test('checklist can add items', async ({ page }) => {
    await openTestTask(page);
    await page.fill('#detail-checklist-input', 'Check oil level');
    await page.click('#detail-checklist-add-btn');
    await expect(page.locator('#detail-checklist-list')).toContainText('Check oil level');
  });

  test('status can be changed via dropdown', async ({ page }) => {
    await openTestTask(page);
    await page.selectOption('#detail-status-select', 'completed');
    await expect(page.locator('#detail-status-select')).toHaveValue('completed');
  });

  test('action buttons in row do not open panel', async ({ page }) => {
    const row = page.locator(`#task-tbody tr`, { hasText: taskTitle });
    const actionBtn = row.locator('[data-action]').first();
    if (await actionBtn.count() > 0) {
      await actionBtn.click();
      await expect(page.locator('#task-detail-panel')).not.toHaveClass(/open/);
    }
  });
});
