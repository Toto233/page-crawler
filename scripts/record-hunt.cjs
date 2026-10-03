const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
const artifactRoot = path.join(projectRoot, 'artifacts', 'validation');
fs.mkdirSync(artifactRoot, { recursive: true });
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch(require('../tests/browser.cjs').launchOptions());
  const context = await browser.newContext({ viewport: { width: 900, height: 600 }, recordVideo: { dir: path.join(projectRoot, 'artifacts', 'capture'), size: { width: 900, height: 600 } } });
  const page = await context.newPage(), video = page.video();
  try {
    await page.setContent(`<meta charset="utf-8"><style>body{margin:0;background-color:#f3f3ee;background-image:linear-gradient(#6572610c 1px,transparent 1px),linear-gradient(90deg,#6572610c 1px,transparent 1px);background-size:30px 30px;color:#425047;font:14px system-ui}header{position:fixed;left:30px;top:24px;line-height:1.8}small{color:#7c867c}#cursor-marker{position:fixed;width:14px;height:14px;border:1px solid #bb705e;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}#cursor-marker::after{content:'鼠标';position:absolute;left:18px;top:-5px;font-size:11px;color:#a27365;white-space:nowrap}</style><header data-crawler-ignore><b>PAGE CRAWLER · v1.0.0</b><div id="phase">追赶 → 蓄力 → 扑跳 → 捕食</div><small>正常速度 · 鼠标中途移开会扑空</small></header><div id="cursor-marker" data-crawler-ignore></div>`);
    await page.evaluate(() => {
      window.GM_getValue = (key, fallback) => key === 'page-crawler-config' ? { speed: 1, neon: false } : fallback;
      window.GM_setValue = () => {};
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(projectRoot, 'page-crawler.user.js'), 'utf8') });
    await page.getByRole('button', { name: '收起面板', exact: true }).click();
    const aim = async (x, y, caption) => {
      await page.evaluate(({ x, y, caption }) => {
        const marker = document.getElementById('cursor-marker'); marker.style.left = `${x}px`; marker.style.top = `${y}px`;
        document.getElementById('phase').textContent = caption;
      }, { x, y, caption });
      await page.mouse.move(x, y);
    };
    await aim(650, 170, '追赶 → 蓄力 → 扑跳 → 捕食');
    await page.waitForFunction(() => { const s = document.getElementById('page-crawler-overlay-v1').crawlerStatus(); return s.hunt.stage === 'airborne' && s.hunt.time > .025; }, null, { timeout: 12000 });
    await page.screenshot({ path: path.join(artifactRoot, 'preview-hunt-airborne.png') });
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().hunt.stage === 'feeding', null, { timeout: 6000 });
    await page.screenshot({ path: path.join(artifactRoot, 'preview-hunt-feeding.png') });
    await page.waitForFunction(() => { const s = document.getElementById('page-crawler-overlay-v1').crawlerStatus(); return s.hunt.stage === 'idle' && s.navigation === 'arrived'; });
    await page.waitForTimeout(1400);
    await aim(430, 275, '第二次追赶 · 起跳时移开鼠标');
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().hunt.stage === 'airborne', null, { timeout: 12000 });
    await page.waitForTimeout(25);
    await aim(260, 390, '鼠标逃开 → 扑空 → 继续追赶');
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().hunt.catches === 2, null, { timeout: 12000 });
    await page.waitForFunction(() => { const s = document.getElementById('page-crawler-overlay-v1').crawlerStatus(); return s.hunt.stage === 'idle' && s.navigation === 'arrived'; });
    await page.evaluate(() => { document.getElementById('phase').textContent = '捕食结束 · 保持站姿，不反复起跳'; });
    await page.waitForTimeout(800);
    const before = await page.evaluate(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus());
    await page.waitForTimeout(1000);
    const after = await page.evaluate(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus());
    assert.equal(after.hunt.jumps, 3); assert.equal(after.hunt.catches, 2); assert.equal(after.hunt.misses, 1);
    assert.equal(after.steps, before.steps); assert(after.finite);
    await page.screenshot({ path: path.join(artifactRoot, 'preview-hunt.png') });
  } finally { await context.close(); await browser.close(); }
  console.log(JSON.stringify({ video: await video.path(), screenshot: path.join(artifactRoot, 'preview-hunt.png') }));
})().catch(error => { console.error(error); process.exit(1); });
