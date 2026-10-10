const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'page-crawler.user.js'), 'utf8');
const output = path.join(root, 'artifacts/validation');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch(require('./browser.cjs').launchOptions());
  const report = { passed: false };
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<meta charset="utf-8"><style>body{margin:0;min-height:2200px;background:#f3f3ee;color:#605849;font:16px system-ui}header{position:fixed;left:30px;top:24px}small{display:block;margin-top:8px;color:#8a8174}</style><header data-crawler-ignore><b id="caption">赛博蜘蛛</b><small>同一套骨骼与动作 · 三种外观</small></header>');
    await page.evaluate(() => {
      let clock = 0, pending;
      window.requestAnimationFrame = callback => (pending = callback, 1);
      window.cancelAnimationFrame = () => { pending = null; };
      window.step = () => { clock += 1000 / 60; const callback = pending; pending = null; if (callback) callback(clock); };
      window.saved = { speed: 1, neon: true, hunt: true };
      window.GM_getValue = (key, fallback) => key === 'page-crawler-config' ? saved : fallback;
      window.GM_setValue = (key, value) => { if (key === 'page-crawler-config') saved = { ...value }; };
    });
    await page.addScriptTag({ content: source });
    await page.evaluate(() => { step(); step(); });
    // Explicit redraw before pixel comparison: physics can advance between
    // display frames when painting is capped at 30 Hz.
    await page.getByRole('combobox', { name: '蜘蛛外观', exact: true }).selectOption('cyber');
    await page.getByRole('button', { name: '收起面板', exact: true }).click();
    const read = () => page.evaluate(() => {
      const host = document.getElementById('page-crawler-overlay-v1'), svg = host.shadowRoot.querySelector('svg.spider');
      return { state: host.crawlerStatus(), hidden: svg.hasAttribute('hidden'), canvas: host.shadowRoot.querySelector('canvas').toDataURL(), bones: svg.querySelectorAll('[data-bone]').length };
    });
    const cyber = await read(); assert.equal(cyber.state.appearance, 'cyber'); assert(cyber.hidden);
    await page.screenshot({ path: path.join(output, 'preview-cyber-light.png') });
    await page.evaluate(() => { document.body.style.background = '#12182a'; document.body.style.color = '#c7eaff'; });
    await page.screenshot({ path: path.join(output, 'preview-cyber.png') });
    await page.evaluate(() => { document.body.style.background = '#f3f3ee'; document.body.style.color = '#605849'; });
    await page.getByRole('button', { name: '◈ 爬行者', exact: true }).click();
    await page.getByRole('combobox', { name: '蜘蛛外观', exact: true }).selectOption('ghost');
    const ghost = await read(); assert.equal(ghost.state.appearance, 'ghost'); assert(!ghost.hidden && ghost.bones === 32);
    const motion = state => ({ x: state.x, y: state.y, angle: state.angle, height: state.bodyHeight, steps: state.steps,
      hunt: state.hunt, feet: state.legs.map(({ x, y, lift, progress }) => ({ x, y, lift, progress })) });
    assert.deepEqual(motion(ghost.state), motion(cyber.state), 'appearance switch preserves motion and every foot contact');
    assert(ghost.state.legs.every(leg => {
      const hip = leg.joints3D[0], dx = hip.x - ghost.state.x, dy = hip.y - ghost.state.y;
      const x = dx * Math.cos(ghost.state.angle) + dy * Math.sin(ghost.state.angle);
      const y = -dx * Math.sin(ghost.state.angle) + dy * Math.cos(ghost.state.angle);
      return (x / 9.5) ** 2 + (y / 8.5) ** 2 < 1.1;
    }), 'all eight natural leg roots attach to the cephalothorax');
    assert(await page.evaluate(() => saved.neon === false), 'existing saved neon=false maps to ghost appearance');
    await page.getByRole('button', { name: '收起面板', exact: true }).click();
    await page.evaluate(() => document.getElementById('caption').textContent = '普通幽灵蛛 · SVG');
    await page.screenshot({ path: path.join(output, 'preview-ghost.png') });
    const checkProjection = () => page.evaluate(() => {
      const host = document.getElementById('page-crawler-overlay-v1'), svg = host.shadowRoot.querySelector('svg.spider');
      let error = 0;
      for (const leg of host.crawlerStatus().legs) for (let bone = 0; bone < 4; bone++) {
        const group = svg.querySelector(`[data-bone="${leg.index * 4 + bone}"]`);
        const segment = group.querySelector('path'), points = segment.getAttribute('d').match(/[\d.e+-]+/g).map(Number);
        const start = new DOMPoint(0, 0).matrixTransform(group.getCTM());
        const end = new DOMPoint(points[2], 0).matrixTransform(group.getCTM());
        error = Math.max(error, Math.hypot(start.x - leg.joints[bone].x, start.y - leg.joints[bone].y), Math.hypot(end.x - leg.joints[bone + 1].x, end.y - leg.joints[bone + 1].y));
      }
      return error;
    });
    report.maximumProjectionError = await checkProjection(); assert(report.maximumProjectionError < .001, 'SVG endpoints follow projected joints exactly');
    const originalGhostSvg = await page.evaluate(() => {
      const svg = document.getElementById('page-crawler-overlay-v1').shadowRoot.querySelector('svg.spider');
      window.originalBones = [...svg.querySelectorAll('[data-bone]')];
      return svg.outerHTML;
    });
    await page.getByRole('button', { name: '◈ 爬行者', exact: true }).click();
    await page.getByRole('combobox', { name: '蜘蛛外观', exact: true }).selectOption('marbled');
    const marbled = await read();
    assert.equal(marbled.state.appearance, 'marbled'); assert(!marbled.hidden && marbled.bones === 32);
    assert.deepEqual(marbled.state.legs, ghost.state.legs, 'natural skins share every projected and 3D joint, foot and gait state');
    assert.deepEqual(motion(marbled.state), motion(ghost.state), 'third skin preserves motion');
    assert(await page.evaluate(() => saved.appearance === 'marbled' && saved.neon === false), 'third skin saved independently of legacy flag');
    assert(await page.evaluate(() => originalBones.every(bone => bone.isConnected)), 'skin changes reuse original bone nodes');
    assert((await checkProjection()) < .001);
    await page.getByRole('button', { name: '收起面板', exact: true }).click();
    await page.evaluate(() => document.getElementById('caption').textContent = '斑腹幽灵蛛 · Holocnemus pluchei');
    await page.screenshot({ path: path.join(output, 'preview-marbled.png') });
    await page.getByRole('button', { name: '◈ 爬行者', exact: true }).click();
    await page.getByRole('combobox', { name: '蜘蛛外观', exact: true }).selectOption('ghost');
    assert.equal(await page.evaluate(() => document.getElementById('page-crawler-overlay-v1').shadowRoot.querySelector('svg.spider').outerHTML), originalGhostSvg, 'ordinary skin artwork restores exactly');
    await page.getByRole('button', { name: '收起面板', exact: true }).click();
    await page.evaluate(() => document.getElementById('caption').textContent = '普通幽灵蛛 · SVG');
    await page.evaluate(() => { document.body.style.background = '#202522'; document.body.style.color = '#d5cbb6'; });
    await page.screenshot({ path: path.join(output, 'preview-ghost-dark.png') });
    await page.evaluate(() => { document.body.style.background = '#f3f3ee'; scrollTo(0, 120); });
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().y < 200, null, { polling: 20 });
    assert((await checkProjection()) < .001, 'paused SVG follows real page scroll');
    await page.getByRole('button', { name: '◈ 爬行者', exact: true }).click();
    await page.getByRole('combobox', { name: '蜘蛛外观', exact: true }).selectOption('cyber');
    assert((await read()).hidden);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().y > 200, null, { polling: 20 });
    assert.equal((await read()).canvas, cyber.canvas, 'switching back restores exact cyber canvas pixels');
    await page.getByRole('combobox', { name: '蜘蛛外观', exact: true }).selectOption('ghost');
    await page.evaluate(() => {
      const s = document.getElementById('page-crawler-overlay-v1').crawlerStatus();
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: s.x + Math.cos(s.angle) * 110, clientY: s.y + Math.sin(s.angle) * 110, bubbles: true }));
      for (let f = 0; f < 100; f++) { step(); const s = document.getElementById('page-crawler-overlay-v1').crawlerStatus(); if (s.hunt.stage === 'airborne' && s.hunt.time >= .05) break; }
    });
    assert.equal((await read()).state.hunt.stage, 'airborne');
    await page.getByRole('combobox', { name: '蜘蛛外观', exact: true }).selectOption('ghost');
    assert((await checkProjection()) < .001, 'SVG tracks airborne feet and compressed body');
    await page.getByRole('button', { name: '收起面板', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'preview-ghost-pounce.png') });
    await page.getByRole('button', { name: '◈ 爬行者', exact: true }).click();
    const airborneGhost = (await read()).state;
    await page.getByRole('combobox', { name: '蜘蛛外观', exact: true }).selectOption('marbled');
    assert.deepEqual(motion((await read()).state), motion(airborneGhost), 'third skin preserves in-flight pounce');
    assert((await checkProjection()) < .001, 'marbled skin follows airborne feet');
    // Reload from saved settings, then independently check legacy and invalid values.
    for (const [settings, expected] of [
      [{ appearance: 'marbled', neon: false }, 'marbled'],
      [{ neon: false }, 'ghost'],
      [{ appearance: 'invalid', neon: true }, 'cyber']
    ]) {
      const restored = await browser.newPage();
      await restored.setContent('<body></body>');
      await restored.evaluate(settings => {
        window.GM_getValue = (key, fallback) => key === 'page-crawler-config' ? settings : fallback;
        window.GM_setValue = () => {};
        window.requestAnimationFrame = () => 1;
      }, settings);
      await restored.addScriptTag({ content: source });
      assert.equal(await restored.evaluate(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().appearance), expected);
      assert.equal(await restored.getByRole('combobox', { name: '蜘蛛外观', exact: true }).inputValue(), expected);
      await restored.close();
    }
    assert.deepEqual(errors, []); report.passed = true;
    fs.writeFileSync(path.join(output, 'appearance-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
