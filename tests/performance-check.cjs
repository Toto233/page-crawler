const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(process.env.CRAWLER_PERF_SOURCE || path.join(root, 'page-crawler.user.js'), 'utf8');
const measureOnly = process.argv.includes('--measure');
const output = path.join(root, 'artifacts/validation');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch(require('./browser.cjs').launchOptions());
  const results = [];
  try {
    for (const appearance of ['cyber', 'ghost', 'marbled']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 850 }, deviceScaleFactor: 2 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.setContent('<style>body{margin:0;min-height:2200px;background:#eee}</style>');
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
      await cdp.send('Performance.enable');
      await page.evaluate(appearance => {
        window.GM_getValue = (key, fallback) => key === 'page-crawler-config' ? { appearance, hunt: false } : fallback;
        window.GM_setValue = () => {};
        const original = window.requestAnimationFrame;
        window.work = { callbacks: 0, milliseconds: 0, attributes: 0 };
        window.requestAnimationFrame = callback => original.call(window, time => {
          const start = performance.now(); callback(time);
          work.callbacks++; work.milliseconds += performance.now() - start;
        });
      }, appearance);
      await page.addScriptTag({ content: source });
      await page.evaluate(() => {
        const host = document.getElementById('page-crawler-overlay-v1');
        new MutationObserver(records => { work.attributes += records.length; }).observe(host.shadowRoot.querySelector('svg.spider'), { attributes: true, subtree: true });
        const s = host.crawlerStatus();
        document.dispatchEvent(new PointerEvent('pointermove', { clientX: s.x, clientY: s.y, bubbles: true }));
      });
      await page.waitForTimeout(1000);
      const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      for (const scene of ['idle', 'walking']) {
        if (scene === 'walking') await page.mouse.move(1100, 140);
        await page.evaluate(() => { work.callbacks = 0; work.milliseconds = 0; work.attributes = 0; });
        const before = await metrics();
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.start');
        await page.waitForTimeout(1600);
        const { profile } = await cdp.send('Profiler.stop');
        const after = await metrics();
        const runtime = await page.evaluate(() => ({ ...work, distance: document.getElementById('page-crawler-overlay-v1').crawlerStatus().distance }));
        const counts = new Map();
        const names = new Map(profile.nodes.map(n => [n.id, n.callFrame.functionName || '(anonymous)']));
        for (const id of profile.samples || []) { const name = names.get(id); counts.set(name, (counts.get(name) || 0) + 1); }
        const result = { appearance, scene, ...runtime, busyPercent: +(100 * (after.TaskDuration - before.TaskDuration) / (after.Timestamp - before.Timestamp)).toFixed(1),
          hottest: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6) };
        results.push(result); console.log(JSON.stringify(result));
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    const report = { cpuSlowdown: 6, viewport: '1280x850', deviceScaleFactor: 2, sampleSeconds: 1.6,
      sourceSha256: crypto.createHash('sha256').update(source).digest('hex'), results, passed: null };
    try {
      if (!measureOnly) {
        report.passed = false;
        for (const r of results) {
          assert(r.busyPercent < 35, `${r.appearance}/${r.scene}: consumes ${r.busyPercent}% of a throttled core`);
          if (r.scene === 'idle') {
            assert(r.callbacks <= 4, `${r.appearance}: keeps recalculating at rest (${r.callbacks} callbacks)`);
            assert(r.attributes <= 20, `${r.appearance}: keeps mutating SVG at rest (${r.attributes} writes)`);
          } else assert(r.distance > 15, `${r.appearance}: optimization must preserve pursuit`);
        }
        report.passed = true;
      }
    } finally { fs.writeFileSync(path.join(output, 'performance-results.json'), JSON.stringify(report, null, 2) + '\n'); }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
