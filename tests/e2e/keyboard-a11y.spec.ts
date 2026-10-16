import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('accessibility checks', () => {
  test('home page has no critical a11y violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical.map((v) => v.id)).toEqual([]);
  });

  test('an article page has no critical a11y violations', async ({ page }) => {
    await page.goto('/');
    const href = await page.locator('a[href^="/library/"]').first().getAttribute('href');
    if (href) {
      await page.goto(href);
      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(critical.map((v) => v.id)).toEqual([]);
    }
  });

  test('skip link / main landmark present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main').first()).toBeVisible();
  });
});
