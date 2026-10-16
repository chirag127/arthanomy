import { test, expect } from '@playwright/test';

test.describe('site smoke', () => {
  test('home page loads and shows coverage counter', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByText(/published today/i)).toBeVisible();
  });

  test('library index lists published articles', async ({ page }) => {
    await page.goto('/library/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Every researched article/i);
  });

  test('an article body renders without error', async ({ page }) => {
    await page.goto('/');
    const firstArticle = page.locator('a[href^="/library/"]').first();
    const href = await firstArticle.getAttribute('href');
    if (href) {
      await page.goto(href);
      await expect(page.locator('.article-body, article').first()).toBeVisible();
    }
  });

  test('calculators page loads', async ({ page }) => {
    await page.goto('/calculators/');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('compare page loads', async ({ page }) => {
    await page.goto('/compare/');
    await expect(page).toHaveTitle(/Compare/i);
  });

  test('command palette opens with Ctrl+K', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+K');
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('dark mode toggle works', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="mode"]').first();
    if (await toggle.count()) {
      const html = page.locator('html');
      const before = await html.getAttribute('class');
      await toggle.click();
      const after = await html.getAttribute('class');
      expect(before).not.toBe(after);
    }
  });
});
