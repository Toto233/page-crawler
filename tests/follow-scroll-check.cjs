const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
const artifactRoot = path.join(projectRoot, 'artifacts', 'validation');
fs.mkdirSync(artifactRoot, { recursive: true });
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(projectRoot, 'page-crawler.user.js'), 'utf8');
const state = page => page.evaluate(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus());
const command = (page, detail) => page.evaluate(detail => document.dispatchEvent(new CustomEvent('pagecrawler:command', { detail })), detail);
(async () => {
  const browser = await chromium.launch(require('./browser.cjs').launchOptions());
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    await page.setContent(`<style>body{margin:25px;background:#101312;color:#ccc;font:17px/2.2 monospace}p{width:970px;margin:12px 0}span{color:#b7d6ff}</style>${Array.from({ length: 70 }, (_, row) => `<p>${Array.from({ length: 10 }, (_, col) => `<span>floor-${row}-${col}</span> `).join('')}</p>`).join('')}`);
    await page.evaluate(() => {
      window.GM_getValue = (key, fallback) => key === 'page-crawler-config' ? { hunt: false } : fallback;
      window.GM_setValue = () => {};
    });
    await page.addScriptTag({ content: source });
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().steps >= 8, null, { timeout: 15000 });
    const start = await state(page), target = { x: Math.min(940, start.x + 220), y: start.y };
    await page.mouse.move(target.x, target.y);
    const initialDistance = Math.hypot(start.x - target.x, start.y - target.y);
    await page.waitForTimeout(6200);
    const chased = await state(page), finalDistance = Math.hypot(chased.x - target.x, chased.y - target.y);
    assert(chased.following);
    assert(Math.hypot(chased.destination.x - target.x, chased.destination.y - target.y) < .01);
    assert(finalDistance < initialDistance - 45, `mouse chasing must make progress: ${initialDistance} -> ${finalDistance}`);
    assert.equal(chased.steps, chased.landedOnPage);
    await command(page, 'pause');
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.ready)));
    const before = await state(page), scrollBefore = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 240);
    await page.waitForFunction(old => scrollY >= old + 239, scrollBefore);
    const scrollAfter = await page.evaluate(() => scrollY), carried = await state(page);
    const delta = scrollAfter - scrollBefore;
    assert(Math.abs(carried.y - (before.y - delta)) < 1, 'body is carried by root scroll');
    assert(Math.abs(carried.worldY - before.worldY) < 1, 'document position is preserved');
    assert.equal(carried.steps, before.steps, 'scroll does not restart or invent steps');
    assert.deepEqual(carried.legs.map(leg => leg.state), before.legs.map(leg => leg.state), 'scroll preserves gait phases');
    for (let i = 0; i < 8; i++) {
      assert(Math.abs(carried.legs[i].y - (before.legs[i].y - delta)) < 1, 'each foot travels with its original support');
    }
    await page.evaluate(() => scrollTo(0, 1550));
    await page.waitForFunction(worldY => {
      const s = document.getElementById('page-crawler-overlay-v1').crawlerStatus();
      return scrollY >= 1549 && Math.abs(s.worldY - worldY) < 1;
    }, before.worldY);
    const offscreen = await state(page);
    assert(offscreen.y < -500, 'creature can scroll out of view with the page');
    assert(Math.abs(offscreen.worldY - before.worldY) < 1);
    await command(page, 'pause'); await page.waitForTimeout(180);
    assert((await state(page)).y < -500, 'no snap back to viewport edge on resume');
    await command(page, 'pause');
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => scrollY === 0 && document.getElementById('page-crawler-overlay-v1').crawlerStatus().y > 0);
    await page.getByRole('checkbox', { name: '跟随鼠标（关闭后自主选目标）' }).uncheck();
    assert.equal((await state(page)).follow, false);
    await page.getByRole('checkbox', { name: '跟随鼠标（关闭后自主选目标）' }).check();
    await command(page, 'pause');
    await page.mouse.move(510, 370); await page.waitForTimeout(150);
    assert.deepEqual((await state(page)).destination, { x: 510, y: 370 });
    await page.screenshot({ path: path.join(artifactRoot, 'preview-follow.png'), caret: 'initial' });
    const result = { passed: true, initialDistance, finalDistance, steps: chased.steps, scrollDelta: delta,
      viewportBefore: before.y, viewportAfter: carried.y, worldBefore: before.worldY, worldAfter: carried.worldY };
    fs.writeFileSync(path.join(artifactRoot, 'follow-scroll-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
