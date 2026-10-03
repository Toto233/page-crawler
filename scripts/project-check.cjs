const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.CRAWLER_DEMO_URL || 'http://127.0.0.1:8825';
const report = { checkedLocalLinks: 0, galleryImages: 0, galleryVideos: 0 };
// Check document links against real files, without requiring a Markdown viewer.
for (const file of ['README.md', ...fs.readdirSync(path.join(root, 'docs')).filter(name => name.endsWith('.md')).map(name => 'docs/' + name)]) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const ref = match[1].split('#')[0];
    if (!ref || /^[a-z]+:\/\//i.test(ref)) continue;
    assert(fs.existsSync(path.resolve(path.dirname(path.join(root, file)), ref)), `${file}: broken local link ${ref}`);
    report.checkedLocalLinks++;
  }
}
(async () => {
  const full = await fetch(base + '/assets/videos/hunt.mp4', { method: 'HEAD' });
  assert.equal(full.status, 200); assert.equal(full.headers.get('content-type'), 'video/mp4');
  const range = await fetch(base + '/assets/videos/hunt.mp4', { headers: { Range: 'bytes=0-1023' } });
  assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 1024);
  assert.equal((await fetch(base + '/node_modules/playwright/package.json')).status, 403);
  assert.equal((await fetch(base + '/%2e%2e%5cpackage.json')).status, 403);
  const browser = await chromium.launch(require('../tests/browser.cjs').launchOptions());
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/');
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1')?.crawlerStatus().running);
    assert(await page.getByRole('checkbox', { name: '接近鼠标时扑跳捕食', exact: true }).isChecked());
    await page.getByRole('button', { name: '恢复网页', exact: true }).last().click();
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await page.screenshot({ path: path.join(root, 'assets/images/project-demo.png') });
    await page.getByRole('link', { name: '照片与视频 ↗', exact: true }).click();
    await page.waitForFunction(() => [...document.images].length === 6 && [...document.images].every(image => image.complete && image.naturalWidth > 0));
    report.galleryImages = await page.locator('img').count();
    report.galleryVideos = await page.locator('video').count();
    assert.equal(report.galleryVideos, 2);
    await page.evaluate(async () => {
      for (const video of document.querySelectorAll('video')) {
        if (video.readyState < 1) await new Promise((resolve, reject) => { video.addEventListener('loadedmetadata', resolve, { once: true }); video.addEventListener('error', reject, { once: true }); });
        if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('video metadata missing');
      }
    });
    await page.screenshot({ path: path.join(root, 'assets/images/project-gallery.png'), fullPage: true });
    assert.deepEqual(errors, []);
    report.passed = true; report.errors = errors;
    fs.mkdirSync(path.join(root, 'artifacts/validation'), { recursive: true });
    fs.writeFileSync(path.join(root, 'artifacts/validation/project-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
