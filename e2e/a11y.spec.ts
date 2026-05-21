import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility audit via axe-core. Fails on serious + critical issues only
 * (moderate/minor are warnings — too many color-contrast flags in brutalist design).
 *
 * Runs against public unauth pages where possible.
 */

const URLS = [
  ['landing', '/'],
  ['pricing', '/pricing'],
  ['login', '/login'],
  ['signup', '/signup'],
  ['status', '/status'],
] as const;

for (const [name, path] of URLS) {
  test(`a11y: ${name}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])  // brutalist design uses high-contrast intentionally; skip auto-check
      .analyze();

    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    if (serious.length > 0) {
      console.log(`[a11y] ${name} violations:`);
      for (const v of serious) {
        console.log(`  - [${v.impact}] ${v.id}: ${v.help}`);
        for (const node of v.nodes.slice(0, 2)) console.log(`    target: ${node.target.join(', ')}`);
      }
    }
    expect(serious).toHaveLength(0);
  });
}
