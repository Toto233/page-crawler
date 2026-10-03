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
  const page = await context.newPage();
  const video = page.video();
  try {
    await page.setContent(`<meta charset="utf-8"><style>body{margin:0;background-color:#f3f3ee;background-image:linear-gradient(#6572610c 1px,transparent 1px),linear-gradient(90deg,#6572610c 1px,transparent 1px);background-size:30px 30px;color:#425047;font:14px system-ui}header{position:fixed;left:30px;top:24px;line-height:1.8}small{color:#7c867c}#cursor-marker{position:fixed;width:14px;height:14px;border:1px solid #bb705e;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}</style><header data-crawler-ignore><b>PAGE CRAWLER · v1.0.0 · 行走模式</b><div id="phase">正常速度 · 前进</div><small>圆圈为鼠标目标 · 地面上的支撑脚保持固定</small></header><div id="cursor-marker" data-crawler-ignore></div>`);
    await page.evaluate(() => {
      window.GM_getValue = (key, fallback) => key === 'page-crawler-config' ? { speed: 1, neon: false, hunt: false } : fallback;
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
    await aim(600, 270, '正常速度 · 前进');
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().navigation === 'arrived', null, { timeout: 12000 });
    await page.waitForTimeout(650);
    await aim(360, 270, '正常速度 · 180° 转身');
    await page.waitForTimeout(1800);
    await page.evaluate(() => { document.getElementById('phase').textContent = '正常速度 · 朝新目标前进'; });
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().navigation === 'arrived', null, { timeout: 12000 });
    await page.waitForTimeout(650);
    await page.evaluate(() => { document.getElementById('phase').textContent = '到达目标 · 保持站姿'; });
    const before = await page.evaluate(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus());
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus());
    assert.equal(after.steps, before.steps); assert(after.finite);
    await page.screenshot({ path: path.join(artifactRoot, 'preview-motion.png') });
  } finally { await context.close(); await browser.close(); }
  console.log(JSON.stringify({ video: await video.path(), screenshot: path.join(artifactRoot, 'preview-motion.png') }));
})().catch(error => { console.error(error); process.exit(1); });
