const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
const artifactRoot = path.join(projectRoot, 'artifacts', 'validation');
fs.mkdirSync(artifactRoot, { recursive: true });
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(projectRoot, 'page-crawler.user.js'), 'utf8');
const state = page => page.evaluate(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus());
(async () => {
  const browser = await chromium.launch(require('./browser.cjs').launchOptions());
  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    await page.setContent('<style>body{margin:0;min-height:1200px;background:#111}</style>');
    await page.evaluate(() => {
      window.GM_getValue = (key, fallback) => key === 'page-crawler-config' ? { speed: 2, hunt: false } : fallback;
      window.GM_setValue = () => {};
    });
    await page.addScriptTag({ content: source });
    const begin = await state(page), goal = { x: Math.round(begin.x + 230), y: Math.round(begin.y) };
    await page.mouse.move(goal.x, goal.y);
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().navigation === 'arrived', null, { timeout: 15000 });
    await page.waitForTimeout(600);
    const settled = await state(page);
    assert(settled.steps >= 8 && settled.distance > 200, 'body advances across a completely blank page');
    assert.equal(settled.hits, 0, 'blank ground never produces a DOM impact');
    assert(Math.hypot(settled.x - goal.x, settled.y - goal.y) <= 15.1);
    assert.deepEqual(settled.destination, goal, 'fixed cursor keeps the selected target');
    await page.waitForTimeout(900);
    const resting = await state(page);
    assert.equal(resting.steps, settled.steps, 'no idle shuffling');
    assert(Math.hypot(resting.x - settled.x, resting.y - settled.y) < .001, 'stance remains stable');
    results.push({ scene: 'blank-page pursuit and stable stance', distance: settled.distance, steps: settled.steps, distanceToGoal: Math.hypot(settled.x - goal.x, settled.y - goal.y) });

    const reverseGoal = { x: 180, y: 620 };
    await page.mouse.move(reverseGoal.x, reverseGoal.y);
    await page.waitForTimeout(4500);
    const turned = await state(page);
    assert.deepEqual(turned.destination, reverseGoal);
    assert(Math.hypot(turned.x - resting.x, turned.y - resting.y) > 65, 'reversing the target moves the body, not just the legs');
    assert(Math.hypot(turned.x - reverseGoal.x, turned.y - reverseGoal.y) < Math.hypot(resting.x - reverseGoal.x, resting.y - reverseGoal.y) - 65);
    assert.equal(turned.hits, 0);
    results.push({ scene: 'reverse-direction pursuit', displacement: Math.hypot(turned.x - resting.x, turned.y - resting.y), newSteps: turned.steps - resting.steps });

    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().navigation === 'arrived', null, { timeout: 18000 });
    await page.waitForTimeout(600);
    const arrived = await state(page);
    const nearby = { x: Math.round(arrived.x + 2), y: Math.round(arrived.y + 1) };
    await page.mouse.move(nearby.x, nearby.y);
    await page.waitForTimeout(900);
    const small = await state(page);
    assert.deepEqual(small.destination, nearby, 'small cursor moves update the target');
    assert.equal(small.steps, arrived.steps, 'cursor jitter within the stopping distance does not cause stepping');
    results.push({ scene: 'small pointer movement', newSteps: small.steps - arrived.steps });
    await page.screenshot({ path: path.join(artifactRoot, 'preview-navigation.png') });
    fs.writeFileSync(path.join(artifactRoot, 'navigation-results.json'), JSON.stringify({ passed: true, results }, null, 2));
    console.log(JSON.stringify({ passed: true, results }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
