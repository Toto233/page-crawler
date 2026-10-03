const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
const artifactRoot = path.join(projectRoot, 'artifacts', 'validation');
fs.mkdirSync(artifactRoot, { recursive: true });
const assert = require('node:assert/strict');
const root = projectRoot;
const source = fs.readFileSync(path.join(root, 'page-crawler.user.js'), 'utf8');
const state = page => page.evaluate(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus());
const command = (page, detail) => page.evaluate(detail => document.dispatchEvent(new CustomEvent('pagecrawler:command', { detail })), detail);
const fixture = `<style>body{background:#101312;color:#ccc;margin:30px;font:18px/2.2 monospace}main{max-width:1000px}p{margin:10px 0}span{display:inline;color:#b9d2ff}button{font:inherit}</style><main>${Array.from({ length: 24 }, (_, row) => `<p>${Array.from({ length: 8 }, (_, col) => `<span>ground-${row}-${col}</span> `).join('')}</p>`).join('')}</main>`;

(async () => {
  const browser = await chromium.launch(require('./browser.cjs').launchOptions());
  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    await page.addInitScript(() => {
      window.GM_getValue = (key, fallback) => key === 'page-crawler-config' ? { hunt: false } : fallback;
      window.GM_setValue = () => {};
    });
    await page.setContent(fixture);
    await page.evaluate(() => { let seed = 431; Math.random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646; });
    await page.addScriptTag({ content: source });
    let contactSamples = 0, swingSamples = 0, maxSwing = 0, maxLengthError = 0;
    const projectedRanges = Array.from({ length: 8 }, () => Array.from({ length: 4 }, () => [Infinity, 0]));
    let elevatedKnees = 0, liftedToes = 0;
    const seenLegs = new Set(), samples = [];
    for (let sample = 0; sample < 75; sample++) {
      await page.waitForTimeout(130);
      const data = await page.evaluate(() => {
        const status = document.getElementById('page-crawler-overlay-v1').crawlerStatus();
        return { status, actual: status.legs.map(leg => {
          const hit = document.elementFromPoint(leg.x, leg.y);
          return { index: leg.index, tag: hit?.tagName, protected: Boolean(hit?.closest('input,textarea,button,[contenteditable]')) };
        }) };
      });
      const s = data.status;
      assert(s.finite); assert.equal(s.steps, s.landedOnPage, 'every completed step lands on the page plane');
      assert(s.hits <= s.steps, 'only foot landings cause deformation');
      const swinging = s.legs.filter(leg => leg.state === 'swing');
      maxSwing = Math.max(maxSwing, swinging.length); assert(swinging.length <= 4);
      assert(s.legs.filter(leg => leg.state === 'planted').length >= 4, 'overlapping contact phases maintain ground support');
      if (swinging.length >= 2 && Math.abs(swinging[0].progress - swinging[1].progress) > .05) swingSamples++;
      for (const leg of s.legs) {
        assert.equal(leg.segments, 4);
        if (leg.lastStep > 0) seenLegs.add(leg.index);
        if (leg.state === 'planted') {
          contactSamples++;
          assert(leg.grounded, `leg ${leg.index} must remain grounded`);
          const actual = data.actual[leg.index];
          if (leg.onElement) assert(actual.tag && !['BODY', 'HTML'].includes(actual.tag) && !actual.protected);
          assert.equal(leg.lift, 0);
          assert.equal(leg.joints3D[4].z, 0, 'contact lies in the page plane');
          assert(Math.hypot(leg.joints[4].x - leg.x, leg.joints[4].y - leg.y) < .01, 'drawn toe equals contact location');
          const [hip, knee, shin, ankle] = leg.joints3D;
          const vector = (a, b) => ({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z });
          const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
          const a = vector(hip, knee), b = vector(knee, shin), c = vector(shin, ankle);
          const first = cross(a, b), second = cross(b, c);
          assert(first.x * second.x + first.y * second.y + first.z * second.z > 0, 'both functional hinges form one bow instead of an inverted zigzag');
        }
        if (leg.joints3D[1].z > s.skeleton.bodyHeight + 5) elevatedKnees++;
        if (leg.state === 'swing' && leg.joints3D[4].z > 8) liftedToes++;
        for (let joint = 0; joint < 5; joint++) {
          const point = leg.joints3D[joint], projected = leg.joints[joint];
          const scale = s.skeleton.cameraDistance / (s.skeleton.cameraDistance - point.z);
          assert(Math.hypot(projected.x - (s.x + (point.x - s.x) * scale),
            projected.y - (s.y + (point.y - s.y) * scale)) < .001, 'canvas joints are projections of the 3D joints');
        }
        for (let bone = 0; bone < 4; bone++) {
          const a = leg.joints3D[bone], b = leg.joints3D[bone + 1];
          const error = Math.abs(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) - leg.boneLengths[bone]);
          maxLengthError = Math.max(maxLengthError, error);
          const p = leg.joints[bone], q = leg.joints[bone + 1];
          const projectedLength = Math.hypot(p.x - q.x, p.y - q.y);
          const range = projectedRanges[leg.index][bone];
          range[0] = Math.min(range[0], projectedLength); range[1] = Math.max(range[1], projectedLength);
        }
      }
      if (sample % 10 === 0) samples.push({ distance: s.distance, steps: s.steps, planted: s.legs.filter(leg => leg.state === 'planted').length });
    }
    const final = await state(page);
    assert.equal(seenLegs.size, 8, 'all eight feet move independently');
    assert(final.distance > 50, 'the supported body actually advances');
    assert(swingSamples > 2, 'swinging feet have staggered phases');
    assert(maxLengthError < .001, `3D bones must not stretch: max error ${maxLengthError}`);
    assert(elevatedKnees > 100 && liftedToes > 10, 'knees and swinging toes lift out of the page plane');
    // The middle of a coherent bow stays close to parallel with the page;
    // the proximal and distal links carry most of the visible pitch change.
    assert(projectedRanges.every(bones => bones.every(([min, max], index) => max - min > [5, 1, 1, .25][index])), `each rigid bone changes its apparent length during walking: ${JSON.stringify(projectedRanges.map(bones => bones.map(([min, max]) => max - min)))}`);
    await page.screenshot({ path: path.join(artifactRoot, 'preview-gait.png'), caret: 'initial' });
    results.push({ scene: 'dense text', steps: final.steps, distance: final.distance, contactSamples, swingSamples, maxSwing,
      maxLengthError, elevatedKnees, liftedToes, projectedRanges, samples });

    // Empty areas are continuous ground; only content contacts cause impacts.
    await page.goto('about:blank'); await page.addScriptTag({ content: source });
    await page.mouse.move(800, 382);
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().distance > 50, null, { timeout: 6000 });
    const empty = await state(page);
    assert(empty.steps > 4); assert.equal(empty.hits, 0); assert(empty.distance > 50);
    assert(empty.legs.every(leg => ['planted', 'swing'].includes(leg.state)));
    results.push({ scene: 'empty page', steps: empty.steps, hits: empty.hits, distance: empty.distance });

    // Removing content leaves the ground intact and must not invent DOM impacts.
    await page.setContent(fixture); await page.addScriptTag({ content: source });
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().steps > 6, { timeout: 12000 });
    await page.evaluate(() => document.querySelector('main').remove());
    await page.waitForTimeout(180);
    const removed = await state(page);
    assert(removed.legs.every(leg => ['planted', 'swing'].includes(leg.state)));
    const hitsBefore = removed.hits;
    await page.mouse.move(1000, 400);
    await page.waitForTimeout(800); assert.equal((await state(page)).hits, hitsBefore);
    results.push({ scene: 'removed content', remainingPlanted: removed.legs.filter(leg => leg.state === 'planted').length });
    await command(page, 'destroy');

    // DOM paint deformation does not drag a supporting foot across the floor.
    await page.setContent(`<style>body{background:#111;color:white;margin:60px}div{width:700px;font:19px/2 monospace}p{margin:8px 0}</style><div id="moving">${Array.from({ length: 10 }, () => '<p>' + 'moving support content '.repeat(5) + '</p>').join('')}</div>`);
    await page.addScriptTag({ content: source });
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().legs.filter(leg => leg.state === 'planted').length >= 4, { timeout: 15000 });
    await command(page, 'pause'); await command(page, 'restore');
    await command(page, 'pause');
    const beforeMove = await state(page);
    const move = await page.evaluate(() => {
      const animation = document.querySelector('#moving').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(30px)' }], { duration: 500, fill: 'forwards' });
      return Boolean(animation);
    });
    assert(move);
    await page.waitForTimeout(220);
    const following = await state(page);
    const fixed = following.legs.filter((leg, index) => leg.state === 'planted' && beforeMove.legs[index].state === 'planted' && leg.lastStep === beforeMove.legs[index].lastStep && Math.hypot(leg.x - beforeMove.legs[index].x, leg.y - beforeMove.legs[index].y) < .001);
    assert(fixed.length > 0, 'grounded toes remain fixed while painted content moves');
    results.push({ scene: 'moving content', planted: following.legs.filter(leg => leg.state === 'planted').length, fixed: fixed.length });
    fs.writeFileSync(path.join(artifactRoot, 'gait-results.json'), JSON.stringify({ passed: true, results }, null, 2));
    console.log(JSON.stringify({ passed: true, results }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
