const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
const artifactRoot = path.join(projectRoot, 'artifacts', 'validation');
fs.mkdirSync(artifactRoot, { recursive: true });
const root = projectRoot;
const source = fs.readFileSync(path.join(root, 'page-crawler.user.js'), 'utf8');
const status = page => page.evaluate(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus());
const command = (page, detail) => page.evaluate(detail => document.dispatchEvent(new CustomEvent('pagecrawler:command', { detail })), detail);
const fingerprint = page => page.evaluate(() => [...document.querySelectorAll('main *')].map(el => ({ tag: el.tagName, style: el.getAttribute('style'), text: el.childNodes.length, parent: el.parentElement.tagName })));

(async () => {
  const browser = await chromium.launch(require('./browser.cjs').launchOptions());
  const results = [];
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 }, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        let seed = 31507;
        Math.random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
        window.GM_getValue = (key, fallback) => key === 'page-crawler-config' ? { speed: 2.5, strength: 1.3, hunt: false } : fallback;
        window.GM_setValue = () => {};
        window.GM_registerMenuCommand = () => {};
      });
      await page.goto('file://' + root.replaceAll('\\', '/') + '/index.html');
      await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1')?.crawlerStatus().running);
      const original = await fingerprint(page);
      if (mobile) {
        const goal = await page.locator('article h2').first().evaluate(el => { const r=el.getBoundingClientRect(); return {x:r.x+35,y:r.y+r.height*.65}; });
        await page.mouse.move(goal.x, goal.y);
      }
      const minimumHits = mobile ? 2 : 3;
      await page.waitForFunction(count => document.getElementById('page-crawler-overlay-v1').crawlerStatus().hits >= count, minimumHits, { timeout: 25000 });
      const walking = await status(page);
      assert(walking.steps > 0 && walking.hits >= minimumHits && walking.finite);
      assert(walking.effects <= 64 && walking.particles <= 200);
      assert.equal(await page.locator('main').evaluate(el => getComputedStyle(el).transform), 'none', 'large layout shell remains untouched');
      await page.getByRole('button', { name: '暂停', exact: true }).click();
      await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.ready)));
      const paused = await status(page);
      const transforms = await page.evaluate(() => [...document.getAnimations()].map(a => a.currentTime));
      await page.waitForTimeout(220);
      assert.deepEqual(await status(page), paused, 'pause stops physics and effects');
      assert.deepEqual(await page.evaluate(() => [...document.getAnimations()].map(a => a.currentTime)), transforms, 'pause freezes active DOM animations');
      await page.getByRole('button', { name: '恢复网页', exact: true }).last().click();
      assert.equal((await status(page)).effects, 0);
      assert.deepEqual(await fingerprint(page), original, 'restore preserves attributes and hierarchy');
      await page.getByRole('combobox', { name: '接触效果', exact: true }).selectOption('collapse');
      await page.getByRole('button', { name: '继续', exact: true }).click();
      const nextGoal = await page.locator('article p').first().evaluate(el => { const r=el.getBoundingClientRect(); return {x:r.x+25,y:r.y+r.height*.5}; });
      await page.mouse.move(nextGoal.x, nextGoal.y);
      await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().effects >= 1, null, { timeout: 20000 });
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: '暂停', exact: true }).click();
      assert((await status(page)).effects >= 1, 'collapse persists');
      await page.screenshot({ path: path.join(artifactRoot, `preview-${mobile ? 'mobile' : 'desktop'}.png`), caret: 'initial' });
      await command(page, 'restore');
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      assert.deepEqual(await fingerprint(page), original);
      await page.locator('#test-input').fill('爬虫不会抢走输入事件');
      await page.getByRole('button', { name: '确认输入' }).click();
      assert.equal(await page.locator('#form-result').textContent(), '已收到：爬虫不会抢走输入事件');
      await page.locator('a[href="#mechanics"]').click();
      assert.equal(new URL(page.url()).hash, '#mechanics', 'link remains clickable');
      await page.keyboard.press('Alt+Shift+KeyR');
      await page.getByRole('button', { name: '追加一段内容' }).click();
      assert(await page.locator('article').textContent().then(text => text.includes('新添加的段落')));
      await page.getByRole('button', { name: '继续', exact: true }).click();
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight * .6));
      await page.waitForTimeout(1000);
      await page.setViewportSize({ width: mobile ? 412 : 1100, height: mobile ? 860 : 800 });
      await page.waitForTimeout(800);
      assert((await status(page)).finite, 'scroll and resize remain finite');
      await page.getByRole('button', { name: '收起面板' }).click();
      await page.getByRole('button', { name: '◈ 爬行者', exact: true }).click();
      await page.getByRole('button', { name: '关闭', exact: true }).click();
      assert.equal((await status(page)).enabled, false);
      assert.equal((await status(page)).effects, 0);
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      await page.keyboard.press('Alt+Shift+KeyC');
      assert.equal((await status(page)).running, true);
      const before = await status(page);
      await page.addScriptTag({ content: source });
      assert.equal(await page.locator('#page-crawler-overlay-v1').count(), 1, 'no duplicate instances');
      await command(page, 'destroy');
      assert.equal(await page.locator('#page-crawler-overlay-v1').count(), 0);
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      assert.deepEqual(errors, []);
      results.push({ mobile, walking, final: before, errors });
      await context.close();
    }
    // A simple third-party page with an independent transform/animation and inline links.
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    await page.setContent(`<style>body{margin:20px;background:white;color:#222}p{width:420px;font:20px/1.6 serif}a{color:blue}.keep{transform:rotate(2deg);opacity:.85}</style><main>${Array.from({ length: 16 }, (_, i) => `<p class="keep">Paragraph ${i}. <a href="#test">A normal inline span and link</a> with enough text to plant a foot.</p>`).join('')}<input value="protected"></main>`);
    await page.addScriptTag({ content: source });
    const original = await fingerprint(page);
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().hits >= 2, { timeout: 25000 });
    await command(page, 'pause'); await command(page, 'restore');
    assert.deepEqual(await fingerprint(page), original);
    assert.equal(await page.locator('.keep').first().evaluate(el => getComputedStyle(el).transform), 'matrix(0.999391, 0.0348995, -0.0348995, 0.999391, 0, 0)');
    assert.equal(await page.locator('main input').evaluate(el => el.getAnimations().length), 0);
    await page.close();
    fs.writeFileSync(path.join(artifactRoot, 'check-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ passed: true, scenarios: results.map(result => ({ mobile: result.mobile,
      walking: { steps: result.walking.steps, hits: result.walking.hits, distance: result.walking.distance },
      final: { steps: result.final.steps, hits: result.final.hits, finite: result.final.finite }, errors: result.errors })) }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
