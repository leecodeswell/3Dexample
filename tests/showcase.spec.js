import { test, expect } from '@playwright/test';
import { Euler, Vector3 } from 'three';
import { samplePose } from '../src/choreography.js';

async function load(page, path = '/') {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const models = [];
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.endsWith('.glb')) models.push(url.pathname); });
  await page.goto(path);
  await page.waitForFunction(() => window.__watchShowcase?.ready, null, { timeout: 90_000 });
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#watch-poster')).toBeHidden();
  expect(models).toEqual(['/watch-photoreal.glb']);
  // A ready scene must also produce visible pixels, including its postprocessing.
  expect((await page.locator('#watch-canvas').screenshot()).byteLength).toBeGreaterThan(50_000);
  return errors;
}

async function setExplosion(page, value) {
  await page.locator('#explosion-slider').evaluate((input, next) => {
    input.value = next; input.dispatchEvent(new Event('input', { bubbles: true }));
  }, String(value));
}

test('source transforms, reversible staging, scroll ownership, rotation, and settings', async ({ page }) => {
  const errors = await load(page);
  expect(await page.evaluate(() => __watchShowcase.parts)).toHaveLength(31);
  expect(await page.evaluate(() => __watchShowcase.meshCount)).toBe(110);
  expect(await page.evaluate(() => __watchShowcase.assembled)).toBe(true);
  expect(await page.evaluate(() => __watchShowcase.sourceTransformsMatch)).toBe(true);
  const assembledPositions = await page.evaluate(() => __watchShowcase.positions);
  expect(await page.evaluate(() => __watchShowcase.crystalRotation)).toEqual([0, 0, 0]);
  const depths = await page.evaluate(() => __watchShowcase.faceDepths);
  expect(depths.glass[0]).toBeGreaterThan(Math.max(...['hour', 'minute', 'second', 'hub'].map(k => depths[k][1])));
  for (const [key, bounds] of Object.entries(depths)) {
    if (key.startsWith('gear') || ['movement', 'bridges', 'tourbillon'].includes(key)) expect(bounds[1]).toBeLessThan(depths.dial[0]);
    if (['hour', 'minute', 'second', 'hub'].includes(key)) expect(bounds[0]).toBeGreaterThan(depths.dial[1]);
  }

  await setExplosion(page, 150);
  const early = await page.evaluate(() => __watchShowcase.positions);
  // Every component has started separating by 15%, including the mechanism
  // and bracelet. The crystal drifts sideways and tilts instead of masking it.
  for (const [part, origin] of Object.entries(assembledPositions)) {
    expect(Math.hypot(...early[part].map((value, i) => value - origin[i])), part).toBeGreaterThan(.0001);
  }
  expect(early.glass[0]).toBeLessThan(assembledPositions.glass[0]);
  expect(Math.abs((await page.evaluate(() => __watchShowcase.crystalRotation))[1])).toBeGreaterThan(.3);
  await setExplosion(page, 1000);
  expect(await page.evaluate(() => __watchShowcase.assembled)).toBe(false);
  await expect(page.locator('#explosion-value')).toHaveText('100%');
  const full = await page.evaluate(() => __watchShowcase.positions);
  expect(full.glass[2]).toBeGreaterThan(full.second[2]);
  expect(full.second[2]).toBeGreaterThan(full.minute[2]);
  expect(full.minute[2]).toBeGreaterThan(full.hour[2]);
  expect(full.hour[2]).toBeGreaterThan(full.bridges[2]);
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

test('hybrid keeps the mechanism facing the camera through the reversible reveal', async ({ page }) => {
  // Inspect the complete camera path, not just the five authored keyframes.
  // A positive, generous facing angle prevents rear/edge views hiding the gears.
  for (const mobile of [false, true]) for (let step = 0; step <= 1000; step++) {
    const pose = samplePose(step / 1000, mobile);
    const normal = new Vector3(0, 0, 1).applyEuler(new Euler(...pose.rotation));
    const sightline = new Vector3(...pose.eye).sub(new Vector3(...pose.target)).normalize();
    expect(normal.dot(sightline)).toBeGreaterThan(.5);
  }
  const errors = await load(page);
  expect(await page.evaluate(() => __watchShowcase.sourceCounts)).toEqual({ exterior: 21, mechanism: 74, design: 15 });
  expect(Object.keys(await page.evaluate(() => __watchShowcase.gearRotations))).toHaveLength(16);
  const stage = await page.locator('#stage').boundingBox();
  expect(stage.x).toBe(0); expect(stage.y).toBe(0);
  expect(stage.width).toBe(1200); expect(stage.height).toBe(800);
  await page.locator('#settings-toggle').click();
  await page.locator('#camera-motion').check();
  await page.keyboard.press('Escape');
  const assembledRotation = await page.evaluate(() => __watchShowcase.modelRotation);
  await setExplosion(page, 460);
  expect(await page.evaluate(() => __watchShowcase.modelRotation)).not.toEqual(assembledRotation);
  expect(Object.values(await page.evaluate(() => __watchShowcase.gearRotations)).some(v => Math.abs(v) > .01)).toBe(true);
  await setExplosion(page, 700);
  expect(await page.evaluate(() => __watchShowcase.modelRotation)).not.toEqual(assembledRotation);
  await setExplosion(page, 1000);
  expect(await page.evaluate(() => __watchShowcase.modelRotation)).not.toEqual(assembledRotation);
  await setExplosion(page, 0);
  expect(await page.evaluate(() => __watchShowcase.modelRotation)).toEqual(assembledRotation);
  expect(Object.values(await page.evaluate(() => __watchShowcase.gearRotations))).toEqual(Array(16).fill(0));
  expect(await page.evaluate(() => __watchShowcase.sourceTransformsMatch)).toBe(true);
  // The newly added dial clears the movement before plates and wheels lift.
  // Check measured geometry through the sequence, not just the assembled pose.
  for (const progress of [50, 150, 300, 450, 600, 750, 1000, 0]) {
    await setExplosion(page, progress);
    const layers = await page.evaluate(() => __watchShowcase.faceDepths);
    expect(layers.glass[0]).toBeGreaterThan(Math.max(...['hour', 'minute', 'second', 'hub'].map(key => layers[key][1])));
    for (const [key, bounds] of Object.entries(layers)) {
      if (key.startsWith('gear') || ['movement', 'bridges', 'tourbillon'].includes(key)) expect(bounds[1]).toBeLessThan(layers.dial[0]);
      if (['hour', 'minute', 'second', 'hub'].includes(key)) expect(bounds[0]).toBeGreaterThan(layers.dial[1]);
    }
  }
  expect(errors).toEqual([]);
});

test('full studio quality preserves a visible dial with contact shading and shadows', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 640 });
  const errors = await load(page, '/?quality=studio');
  expect(await page.evaluate(() => __watchShowcase.rendering)).toEqual({ environment: '/studio.hdr', contactShading: true, shadows: true, opaqueMeshes: 109, glassMeshes: 1 });
  const profiles = await page.evaluate(() => __watchShowcase.finishProfiles);
  for (const profile of ['sapphire', 'dial', 'enamel', 'steelBrushed', 'steelPolished', 'gold', 'goldPolished']) expect(profiles).toContain(profile);
  await setExplosion(page, 450);
  await setExplosion(page, 0);
  expect(await page.evaluate(() => __watchShowcase.sourceTransformsMatch)).toBe(true);
  expect((await page.locator('#watch-canvas').screenshot()).byteLength).toBeGreaterThan(50_000);
  expect(errors).toEqual([]);
});
