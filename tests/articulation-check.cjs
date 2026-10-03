const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
const artifactRoot = path.join(projectRoot, 'artifacts', 'validation');
fs.mkdirSync(artifactRoot, { recursive: true });
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.argv[2] || path.join(projectRoot, 'page-crawler.user.js'), 'utf8');
(async () => {
  const browser = await chromium.launch(require('./browser.cjs').launchOptions());
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    await page.setContent('<style>body{margin:0;background:#111;min-height:2000px}</style>');
    await page.evaluate(() => {
      let seed = 431, clock = 0, pending = null;
      Math.random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
      window.GM_getValue = (key, fallback) => key === 'page-crawler-config' ? { strength: .3, hunt: false } : fallback;
      window.GM_setValue = () => {};
      window.requestAnimationFrame = callback => { pending = callback; return 1; };
      window.cancelAnimationFrame = () => { pending = null; };
      window.advanceCrawler = () => { const callback = pending; pending = null; callback(clock += 1000 / 60); };
    });
    await page.addScriptTag({ content: source });
    const result = await page.evaluate(() => {
      const state = () => document.getElementById('page-crawler-overlay-v1').crawlerStatus();
      const aim = (x, y) => document.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
      const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
      const local = (point, s) => ({ x: (point.x - s.x) * Math.cos(s.angle) + (point.y - s.y) * Math.sin(s.angle),
        y: -(point.x - s.x) * Math.sin(s.angle) + (point.y - s.y) * Math.cos(s.angle), z: point.z });
      const pitchRanges = Array.from({ length: 8 }, () => [Infinity, -Infinity]);
      let previous = null, previousPlanes = null, maxJointJump = 0, maxBendPlaneChangeDegrees = 0, maxPlaneDivergenceDegrees = 0, maxBoneLengthError = 0;
      let unsupportedFrames = 0, minimumSupportMargin = Infinity;
      const supportMargin = s => {
        const points = s.legs.filter(leg => leg.state === 'planted').map(leg => ({ x: leg.x, y: leg.y })).sort((a, b) => a.x - b.x || a.y - b.y);
        const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        const lower = [], upper = [];
        for (const point of points) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop(); lower.push(point); }
        for (const point of [...points].reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop(); upper.push(point); }
        const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
        return hull.length < 3 ? -Infinity : Math.min(...hull.map((a, i) => {
          const b = hull[(i + 1) % hull.length]; return cross(a, b, { x: s.x, y: s.y }) / Math.hypot(b.x - a.x, b.y - a.y);
        }));
      };
      const sample = frame => {
        window.advanceCrawler(); const s = state();
        const margin = supportMargin(s); minimumSupportMargin = Math.min(minimumSupportMargin, margin);
        if (margin < 0) unsupportedFrames++;
        const joints = s.legs.map(leg => leg.joints3D.map(point => local(point, s)));
        const planes = s.legs.map(leg => {
          const hip = leg.joints3D[0], toe = leg.joints3D[4];
          const d = { x: toe.x - hip.x, y: toe.y - hip.y, z: toe.z - hip.z };
          const length = Math.hypot(d.x, d.y, d.z), axis = { x: d.x / length, y: d.y / length, z: d.z / length };
          const flat = Math.hypot(axis.x, axis.y);
          const up = { x: -axis.x * axis.z / flat, y: -axis.y * axis.z / flat, z: flat };
          const lateral = { x: -axis.y / flat, y: axis.x / flat, z: 0 };
          return [1, 2].map(j => {
            const p = leg.joints3D[j], x = p.x - hip.x, y = p.y - hip.y, z = p.z - hip.z;
            const a = x * lateral.x + y * lateral.y, b = x * up.x + y * up.y + z * up.z;
            return Math.hypot(a, b) < 3 ? null : Math.atan2(a, b);
          });
        });
        for (let i = 0; i < 8; i++) {
          const [a, b] = joints[i];
          const pitch = Math.atan2(b.z - a.z, Math.hypot(b.x - a.x, b.y - a.y));
          pitchRanges[i][0] = Math.min(pitchRanges[i][0], pitch);
          pitchRanges[i][1] = Math.max(pitchRanges[i][1], pitch);
          const leg = s.legs[i];
          for (let bone = 0; bone < 4; bone++) {
            const a = leg.joints3D[bone], b = leg.joints3D[bone + 1];
            maxBoneLengthError = Math.max(maxBoneLengthError,
              Math.abs(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) - (leg.boneLengths || s.skeleton.boneLengths)[bone]));
          }
          if (planes[i].every(angle => angle !== null)) maxPlaneDivergenceDegrees = Math.max(maxPlaneDivergenceDegrees,
            Math.abs(wrap(planes[i][0] - planes[i][1])) * 180 / Math.PI);
          if (previous) for (let j = 1; j < 4; j++) {
            const p = previous[i][j], q = joints[i][j], jump = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
            maxJointJump = Math.max(maxJointJump, jump);
          }
        }
        if (previousPlanes) for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
          if (planes[i][j] !== null && previousPlanes[i][j] !== null)
            maxBendPlaneChangeDegrees = Math.max(maxBendPlaneChangeDegrees, Math.abs(wrap(planes[i][j] - previousPlanes[i][j])) * 180 / Math.PI);
        }
        previous = joints; previousPlanes = planes; return s;
      };
      aim(1150, 382);
      for (let frame = 0; frame < 240; frame++) sample(frame);
      const before = state();
      const desired = before.angle + Math.PI;
      aim(before.x + Math.cos(desired) * 260, before.y + Math.sin(desired) * 260);
      let halfTurnSeconds = null;
      for (let frame = 0; frame < 180; frame++) {
        const s = sample(240 + frame);
        if (halfTurnSeconds === null && Math.abs(wrap(desired - s.angle)) < .15) halfTurnSeconds = (frame + 1) / 60;
      }
      const afterTurn = state();
      for (let frame = 420; frame < 900; frame++) {
        if (frame % 80 === 20) {
          const s = state(), angle = frame / 80 * .83;
          aim(s.x + Math.cos(angle) * 240, s.y + Math.sin(angle) * 240);
        }
        sample(frame);
      }
      return { maxBodyRelativeJointTravel: maxJointJump, maxBendPlaneChangeDegrees, maxPlaneDivergenceDegrees, maxBoneLengthError, unsupportedFrames, minimumSupportMargin,
        proximalPitchDegrees: pitchRanges.map(([min, max]) => (max - min) * 180 / Math.PI),
        halfTurnSeconds, remainingTurnDegrees: Math.abs(wrap(desired - afterTurn.angle)) * 180 / Math.PI,
        steps: state().steps, distance: state().distance, finite: state().finite };
    });
    const failures = [];
    // Endpoint motion during a fast turn is expected. A sudden change of the
    // leg's bending plane reveals a mirror-branch flip independently of it.
    if (result.maxBendPlaneChangeDegrees > 12) failures.push(`bending plane flips ${result.maxBendPlaneChangeDegrees.toFixed(2)} degrees in one frame`);
    if (result.maxPlaneDivergenceDegrees > 1) failures.push('proximal and distal joints bend in different planes');
    if (result.maxBoneLengthError > .001) failures.push('rigid bones stretch');
    if (result.unsupportedFrames) failures.push('body leaves the polygon of grounded feet');
    if (result.proximalPitchDegrees.some(range => range < 8)) failures.push('proximal bones do not participate in the full gait');
    if (result.halfTurnSeconds === null || result.halfTurnSeconds > 2) failures.push('half turn takes more than 2 s at normal speed');
    if (!result.finite || result.distance < 100) failures.push('locomotion fails');
    const output = { passed: !failures.length, version: source.match(/@version\s+(\S+)/)[1], frameRate: 60, frames: 900, failures, ...result };
    fs.writeFileSync(path.join(artifactRoot, process.argv[3] || 'articulation-results.json'), JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
    assert(output.passed, failures.join('; '));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
