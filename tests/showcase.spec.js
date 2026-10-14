import { test, expect } from '@playwright/test';

async function load(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__watchShowcase?.ready, null, { timeout: 90_000 });
  await expect(page.locator('#loading')).toBeHidden();
  return errors;
}

async function setExplosion(page, value) {
  await page.locator('#explosion-slider').evaluate((input, next) => {
    input.value = next; input.dispatchEvent(new Event('input', { bubbles: true }));
  }, String(value));
}

test('source transforms, reversible staging, scroll ownership, rotation, and settings', async ({ page }) => {
  const errors = await load(page);
  expect(await page.evaluate(() => __watchShowcase.parts)).toHaveLength(12);
  expect(await page.evaluate(() => __watchShowcase.meshCount)).toBe(56);
  expect(await page.evaluate(() => __watchShowcase.assembled)).toBe(true);
  expect(await page.evaluate(() => __watchShowcase.sourceTransformsMatch)).toBe(true);

  await setExplosion(page, 150);
  const early = await page.evaluate(() => __watchShowcase.positions);
  expect(early.glass[2]).toBeGreaterThan(0);
  expect(early.bracelet).toEqual([0, 0, 0]);
  await setExplosion(page, 1000);
  expect(await page.evaluate(() => __watchShowcase.assembled)).toBe(false);
  await expect(page.locator('#explosion-value')).toHaveText('100%');
  const full = await page.evaluate(() => __watchShowcase.positions);
  expect(full.glass[2]).toBeGreaterThan(full.second[2]);
  expect(full.second[2]).toBeGreaterThan(full.minute[2]);
  expect(full.minute[2]).toBeGreaterThan(full.hour[2]);
  expect(full.hour[2]).toBeGreaterThan(full.dial[2]);
  expect(full.bracelet[2]).toBeLessThan(full.case[2]);

  await page.locator('#reset-view').click();
  const glassLabel = page.getByRole('button', { name: 'Inspect glass' });
  await expect.poll(() => glassLabel.evaluate(el => Number(getComputedStyle(el.parentElement).opacity))).toBeGreaterThan(.5);
  await glassLabel.click();
  await expect(page.locator('#inspector')).toBeVisible();
  await expect(page.locator('#inspector-title')).toHaveText('Vitrum');
  const beforeFocus = await page.evaluate(() => __watchShowcase.cameraPosition);
  await page.locator('#focus-part').click();
  expect(await page.evaluate(() => __watchShowcase.cameraPosition)).not.toEqual(beforeFocus);
  await page.keyboard.press('Escape');
  await expect(page.locator('#inspector')).toBeHidden();

  await setExplosion(page, 0);
  await page.locator('#play-explosion').click();
  await expect.poll(() => page.evaluate(() => __watchShowcase.progress)).toBeCloseTo(1, 3);
  await page.locator('#play-explosion').click();
  await expect.poll(() => page.evaluate(() => __watchShowcase.sourceTransformsMatch)).toBe(true);
  await setExplosion(page, 0);
  expect(await page.evaluate(() => __watchShowcase.sourceTransformsMatch)).toBe(true);
  expect(await page.evaluate(() => __watchShowcase.assembled)).toBe(true);
  // Scroll should take over after a manual slider change, including over the canvas.
  await page.locator('#stage').hover();
  await page.mouse.wheel(0, 1000);
  await expect.poll(() => page.evaluate(() => __watchShowcase.progress)).toBeGreaterThan(.1);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => __watchShowcase.progress)).toBeCloseTo(1, 3);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => __watchShowcase.sourceTransformsMatch)).toBe(true);

  const before = await page.evaluate(() => __watchShowcase.cameraPosition);
  const bounds = await page.locator('#stage').boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 100, bounds.y + bounds.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => __watchShowcase.cameraPosition)).not.toEqual(before);
  await page.locator('#auto-rotate').click();
  await expect(page.locator('#auto-rotate')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#reset-view').click();
  await expect(page.locator('#auto-rotate')).toHaveAttribute('aria-pressed', 'false');

  await page.locator('#settings-toggle').click();
  await expect(page.locator('#settings-panel')).toBeVisible();
  expect(await page.evaluate(() => __watchShowcase.appearance.brown)).toBe(true);
  await page.locator('#brown-finish').uncheck();
  expect(await page.evaluate(() => __watchShowcase.appearance.brown)).toBe(false);
  await page.locator('#brown-finish').check();
  await page.locator('#cinematic-finish').uncheck();
  expect(await page.evaluate(() => __watchShowcase.appearance.finish)).toBe(false);
  await page.locator('#studio-glass').uncheck();
  await page.locator('#show-labels').uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-panel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('mobile viewport keeps manual controls usable and avoids horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await load(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#explosion-slider')).toBeVisible();
  await setExplosion(page, 650);
  await expect(page.locator('#explosion-value')).toHaveText('065%');
  expect(await page.evaluate(() => __watchShowcase.progress)).toBe(.65);
  await setExplosion(page, 0);
  expect(await page.evaluate(() => __watchShowcase.sourceTransformsMatch)).toBe(true);
  await page.locator('#settings-toggle').click();
  await expect(page.locator('#settings-panel')).toBeInViewport();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#explosion-slider')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
