const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
const artifactRoot = path.join(projectRoot, 'artifacts', 'validation');
fs.mkdirSync(artifactRoot, { recursive: true });
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(projectRoot, 'page-crawler.user.js'), 'utf8');

(async () => {
  const browser = await chromium.launch(require('./browser.cjs').launchOptions());
  let result;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    await page.setContent(`<style>body{margin:20px;background:#111;color:#ddd;font:17px/30px monospace}p{margin:0;height:30px}span{display:inline-block;width:100px}</style><main>${Array.from({ length: 27 }, (_, row) => `<p>${Array.from({ length: 12 }, (_, col) => `<span id="tile-${row}-${col}">floor-${row}-${col}</span>`).join('')}</p>`).join('')}</main>`);
    await page.evaluate(() => {
      let seed = 431;
      Math.random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
      window.GM_getValue = (key, fallback) => key === 'page-crawler-config' ? { strength: .3, hunt: false } : fallback;
      window.GM_setValue = () => {};
    });
    await page.addScriptTag({ content: source });
    await page.mouse.move(1100, 160);
    await page.waitForFunction(() => document.getElementById('page-crawler-overlay-v1')?.crawlerStatus().steps >= 8);
    result = await page.evaluate(async () => {
      const status = () => document.getElementById('page-crawler-overlay-v1').crawlerStatus();
      const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
      const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
      const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
      const clamp = value => Math.max(0, Math.min(1, value));
      // Closest points on finite segments (Ericson), including parallel limbs.
      function closest(p1, q1, p2, q2) {
        const d1 = subtract(q1, p1), d2 = subtract(q2, p2), r = subtract(p1, p2);
        const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
        let s = 0, t = 0;
        if (a <= 1e-10 && e <= 1e-10) return { distance: Math.hypot(r.x, r.y, r.z), a: p1, b: p2 };
        if (a <= 1e-10) t = clamp(f / e);
        else {
          const c = dot(d1, r);
          if (e <= 1e-10) s = clamp(-c / a);
          else {
            const b = dot(d1, d2), denominator = a * e - b * b;
            if (denominator > 1e-10) s = clamp((b * f - c * e) / denominator);
            t = (b * s + f) / e;
            if (t < 0) { t = 0; s = clamp(-c / a); }
            else if (t > 1) { t = 1; s = clamp((b - c) / a); }
          }
        }
        const aa = lerp(p1, q1, s), bb = lerp(p2, q2, t);
        return { distance: Math.hypot(aa.x - bb.x, aa.y - bb.y, aa.z - bb.z), a: aa, b: bb };
      }
      // Ignore the crowded, concealed attachment region only. Clip at its edge
      // so a minimum inside the body cannot hide a collision farther out.
      function visibleParts(a, b, body) {
        const x = a.x - body.x, y = a.y - body.y, dx = b.x - a.x, dy = b.y - a.y;
        const qa = dx * dx + dy * dy, qb = 2 * (x * dx + y * dy), qc = x * x + y * y - 26 ** 2;
        const cuts = [0, 1], discriminant = qb * qb - 4 * qa * qc;
        if (qa > 1e-10 && discriminant >= 0) {
          for (const t of [(-qb - Math.sqrt(discriminant)) / (2 * qa), (-qb + Math.sqrt(discriminant)) / (2 * qa)]) if (t > 0 && t < 1) cuts.push(t);
        }
        cuts.sort((a, b) => a - b);
        const parts = [];
        for (let i = 0; i < cuts.length - 1; i++) {
          const midpoint = lerp(a, b, (cuts[i] + cuts[i + 1]) / 2);
          if (Math.hypot(midpoint.x - body.x, midpoint.y - body.y) >= 26 - .001) parts.push([lerp(a, b, cuts[i]), lerp(a, b, cuts[i + 1])]);
        }
        return parts;
      }
      function projectedCross(a, b, c, d) {
        const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        return cross(a, b, c) * cross(a, b, d) < -1e-7 && cross(c, d, a) * cross(c, d, b) < -1e-7;
      }
      const initial = status(), start = performance.now();
      let minDistance = Infinity, collisionSamples = 0, crossingSamples = 0, orderingSamples = 0, firstCollision = null, firstReversal = null, firstCrossing = null;
      let segmentCounts = new Set(), frames = 0;
      for (let frame = 0; frame < 600; frame++) {
        await new Promise(requestAnimationFrame);
        if (frame === 200) document.dispatchEvent(new PointerEvent('pointermove', { clientX: 150, clientY: 660, bubbles: true }));
        if (frame === 400) document.dispatchEvent(new PointerEvent('pointermove', { clientX: 1000, clientY: 120, bubbles: true }));
        const s = status(); frames++;
        for (const leg of s.legs) segmentCounts.add(leg.joints3D.length - 1);
        const bones = s.legs.flatMap(leg => leg.joints3D.slice(0, -1).flatMap((a, j) => visibleParts(a, leg.joints3D[j + 1], s).map(([a, b]) => ({ leg: leg.index, segment: j, a, b }))));
        let collided = false, crossed = false, reversed = false;
        for (let i = 0; i < bones.length; i++) for (let j = i + 1; j < bones.length; j++) {
          const a = bones[i], b = bones[j]; if (a.leg === b.leg) continue;
          const pair = closest(a.a, a.b, b.a, b.b);
          minDistance = Math.min(minDistance, pair.distance);
          if (pair.distance < 3) {
            collided = true;
            if (!firstCollision) firstCollision = { frame, timeMs: performance.now() - start, distance: pair.distance,
              body: { x: s.x, y: s.y }, pair: [{ leg: a.leg, segment: a.segment }, { leg: b.leg, segment: b.segment }],
              closest: [pair.a, pair.b], legs: [s.legs[a.leg], s.legs[b.leg]] };
          }
        }
        for (let i = 0; i < s.legs.length; i++) for (let j = i + 1; j < s.legs.length; j++) {
          const a = s.legs[i], b = s.legs[j];
          for (let u = 0; u < a.joints.length - 1; u++) for (let v = 0; v < b.joints.length - 1; v++) {
            for (const [p, q] of visibleParts(a.joints[u], a.joints[u + 1], s))
              for (const [r, t] of visibleParts(b.joints[v], b.joints[v + 1], s))
                if (projectedCross(p, q, r, t)) {
                  crossed = true;
                  if (!firstCrossing) firstCrossing = { frame, pair: [i,j,u,v], legs: [a,b], body: {x:s.x,y:s.y,angle:s.angle} };
                }
          }
        }
        const front = subtract(s.legs[0].joints3D[0], s.legs[3].joints3D[0]);
        const norm = Math.hypot(front.x, front.y), fx = front.x / norm, fy = front.y / norm;
        for (const offset of [0, 4]) for (let row = 0; row < 3; row++) {
          const a = s.legs[offset + row], b = s.legs[offset + row + 1];
          if (a.state !== 'planted' || b.state !== 'planted') continue;
          const side = offset === 0 ? -1 : 1;
          const angle = leg => Math.atan2((leg.x - s.x) * fx + (leg.y - s.y) * fy, ((leg.y - s.y) * fx - (leg.x - s.x) * fy) * side);
          if (angle(a) < angle(b) - .03) {
            reversed = true;
            if (!firstReversal) firstReversal = { frame, legs: [a.index, b.index], angles: [angle(a), angle(b)], body: { x: s.x, y: s.y } };
          }
        }
        if (collided) collisionSamples++; if (crossed) crossingSamples++; if (reversed) orderingSamples++;
      }
      const final = status();
      return { frames, durationMs: performance.now() - start, minDistance, collisionSamples, projectedCrossingSamples: crossingSamples,
        plantedOrderReversalSamples: orderingSamples, firstCollision, firstReversal, firstCrossing, segmentCounts: [...segmentCounts],
        steps: final.steps - initial.steps, distance: final.distance - initial.distance, finalNavigation: final.navigation, destination: final.destination };
    });
    const failures = [];
    if (result.collisionSamples) failures.push(`${result.collisionSamples} frames contain inter-leg penetration (clearance < 3)`);
    if (result.projectedCrossingSamples) failures.push(`${result.projectedCrossingSamples} frames cross projected limbs outside the body`);
    if (result.plantedOrderReversalSamples) failures.push(`${result.plantedOrderReversalSamples} frames reverse neighboring planted feet`);
    if (result.steps < 8 || result.distance < 35) failures.push('insufficient actual walking to exercise avoidance');
    result = { passed: failures.length === 0, version: source.match(/@version\s+(\S+)/)?.[1], thresholds: { bodyExclusionRadius: 26, minimumLimbClearance: 3 }, failures, ...result };
    fs.writeFileSync(path.join(artifactRoot, 'collision-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ...result, firstCollision: result.firstCollision && { ...result.firstCollision, legs: undefined } }, null, 2));
    assert.equal(result.passed, true, failures.join('; '));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
