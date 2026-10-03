const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
const artifactRoot = path.join(projectRoot, 'artifacts', 'validation');
fs.mkdirSync(artifactRoot, { recursive: true });
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(projectRoot, 'page-crawler.user.js'), 'utf8');
const state = page => page.evaluate(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus());
async function scene(browser, speed = 1, viewport = { width: 1280, height: 850 }) {
  const page = await browser.newPage({ viewport });
  await page.setContent('<style>body{margin:0;min-height:3000px;background:#f3f3ee}</style>');
  await page.evaluate(speed => {
    let clock = 0, pending = null;
    window.GM_getValue = (key, fallback) => key === 'page-crawler-config' ? { speed, neon: false } : fallback;
    window.GM_setValue = () => {};
    window.requestAnimationFrame = callback => { pending = callback; return 1; };
    window.cancelAnimationFrame = () => { pending = null; };
    window.aim = (x, y) => document.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
    window.step = () => { clock += 1000 / 60; const callback = pending; pending = null; if (callback) callback(clock); };
  }, speed);
  await page.addScriptTag({ content: source });
  return page;
}
(async () => {
  const browser = await chromium.launch(require('./browser.cjs').launchOptions());
  const results = [];
  try {
    for (const speed of [.3, 1, 2.5]) {
      const page = await scene(browser, speed);
      const result = await page.evaluate(() => {
        const state = () => document.getElementById('page-crawler-overlay-v1').crawlerStatus();
        const begin = state(), target = { x: begin.x + Math.cos(begin.angle) * 280, y: begin.y + Math.sin(begin.angle) * 280 };
        aim(target.x, target.y);
        let maxHeight = 0, maxBoneError = 0, airborneFrames = 0, badSupportFrames = 0, earlyJump = false, launchDistance = null;
        let settled = null, lastStage = 'idle', launchFrame = null, flightSeconds = null, maximumAirSpeed = 0;
        let windup = null, entryDistance = null, backwardStroke = 0, footSlip = 0, coilAtLaunch = 0, airborneCoil = 0;
        const stages = [];
        for (let frame = 0; frame < 2500; frame++) {
          const before = state(); step(); const s = state();
          if (!s.finite) throw new Error('nonfinite hunt pose');
          if (before.hunt.stage !== 'crouch' && s.hunt.stage === 'crouch') {
            windup = { x: s.x, y: s.y, angle: s.angle };
            entryDistance = Math.hypot(s.x - target.x, s.y - target.y);
          }
          if (before.hunt.stage === 'crouch') {
            backwardStroke = Math.max(backwardStroke, (windup.x - s.x) * Math.cos(windup.angle) + (windup.y - s.y) * Math.sin(windup.angle));
            for (let i = 0; i < 8; i++) {
              footSlip = Math.max(footSlip, Math.hypot(s.legs[i].x - before.legs[i].x, s.legs[i].y - before.legs[i].y));
              if (before.legs[i].lift !== 0) throw new Error('windup foot left ground');
            }
          }
          if (s.hunt.stage !== lastStage) { stages.push(s.hunt.stage); lastStage = s.hunt.stage; }
          if (before.hunt.stage !== 'airborne' && s.hunt.stage === 'airborne') { launchFrame = frame; coilAtLaunch = s.bodyCoil; }
          if (s.hunt.stage === 'airborne' && s.hunt.time > 0) airborneCoil = s.bodyCoil;
          if (before.hunt.stage === 'airborne') maximumAirSpeed = Math.max(maximumAirSpeed, Math.hypot(s.x - before.x, s.y - before.y) * 60);
          if (before.hunt.stage === 'airborne' && s.hunt.stage === 'landing') flightSeconds = (frame - launchFrame) / 60;
          if (!before.hunt.jumps && s.hunt.jumps) launchDistance = Math.hypot(before.x - target.x, before.y - target.y);
          if (s.hunt.jumps && entryDistance > s.hunt.range + 1) earlyJump = true;
          maxHeight = Math.max(maxHeight, s.bodyHeight);
          if (s.hunt.stage === 'airborne' && s.bodyHeight > 30) {
            airborneFrames++;
            if (s.legs.some(leg => leg.grounded || leg.lift <= 0)) throw new Error('a foot remains planted in mid-air');
          } else if (s.hunt.stage !== 'airborne' && s.supportMargin < 0) badSupportFrames++;
          for (const leg of s.legs) for (let bone = 0; bone < 4; bone++) {
            const a = leg.joints3D[bone], b = leg.joints3D[bone + 1];
            maxBoneError = Math.max(maxBoneError, Math.abs(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) - leg.boneLengths[bone]));
          }
          if (s.hunt.catches === 1 && s.hunt.stage === 'idle' && s.navigation === 'arrived' && frame > 20) { settled = s; break; }
        }
        if (!settled) throw new Error('did not complete pursuit, jump, bite and recovery');
        for (let frame = 0; frame < 360; frame++) step();
        const resting = state();
        aim(target.x + 2, target.y + 1); for (let frame = 0; frame < 120; frame++) step();
        const jitter = state();
        return { speed: GM_getValue('page-crawler-config').speed, stages, maxHeight, maxBoneError, airborneFrames,
          badSupportFrames, earlyJump, entryDistance, launchDistance, backwardStroke, footSlip, coilAtLaunch, airborneCoil,
          flightSeconds, maximumAirSpeed, displacement: settled.distance,
          finalDistance: Math.hypot(settled.x - target.x, settled.y - target.y), jumps: jitter.hunt.jumps, catches: jitter.hunt.catches,
          idleSteps: resting.steps - settled.steps, jitterSteps: jitter.steps - resting.steps,
          idleMovement: Math.hypot(resting.x - settled.x, resting.y - settled.y), ground: resting.legs.every(leg => leg.grounded && leg.lift === 0) };
      });
      assert.deepEqual(result.stages.slice(0, 7), ['gather', 'crouch', 'airborne', 'landing', 'feeding', 'recover', 'idle']);
      assert(!result.earlyJump && result.launchDistance > 70, 'walk into hunting range before launching');
      assert(result.backwardStroke >= 10 && result.backwardStroke <= 22.001, 'visible backward loading before forward pounce');
      assert(result.footSlip < .001 && result.coilAtLaunch === 1 && result.airborneCoil === 0, 'planted windup feet, compressed body, then rapid release');
      assert(result.maxHeight > 42 && result.airborneFrames > 1, 'short height arc with genuinely airborne feet');
      const huntSpeed = Math.max(.5, Math.min(1.6, speed));
      assert(result.flightSeconds >= .11 / huntSpeed && result.flightSeconds <= .17 / huntSpeed + 1 / 60, 'short flight duration');
      assert(result.maximumAirSpeed > 700 * huntSpeed, 'fast forward pounce');
      assert(result.maxBoneError < .001 && result.badSupportFrames === 0, `fixed bones and grounded support: ${JSON.stringify(result)}`);
      assert(result.displacement > 260 && result.finalDistance <= 15.1);
      assert.equal(result.jumps, 1); assert.equal(result.catches, 1);
      assert.equal(result.idleSteps, 0); assert.equal(result.jitterSteps, 0); assert(result.idleMovement < .001 && result.ground);
      results.push({ scene: 'pursuit, pounce, capture, stable rest', ...result }); await page.close();
    }
    const page = await scene(browser);
    const escape = await page.evaluate(() => {
      const state = () => document.getElementById('page-crawler-overlay-v1').crawlerStatus();
      const begin = state(), target = { x: begin.x + Math.cos(begin.angle) * 95, y: begin.y + Math.sin(begin.angle) * 95 };
      aim(target.x, target.y);
      for (let f = 0; f < 100 && state().hunt.stage !== 'airborne'; f++) step();
      const takeoff = state(), away = { x: target.x + 200, y: target.y + 90 };
      aim(away.x, away.y); let landing = null;
      for (let f = 0; f < 80; f++) { step(); if (state().hunt.stage === 'landing') { landing = state(); break; } }
      if (!landing) throw new Error('never landed');
      const miss = { target: takeoff.hunt.target, landingTarget: landing.hunt.target, misses: landing.hunt.misses, catches: landing.hunt.catches,
        distanceToLockedTarget: Math.hypot(landing.x - target.x, landing.y - target.y), distanceToEscapedCursor: Math.hypot(landing.x - away.x, landing.y - away.y) };
      for (let f = 0; f < 700 && state().hunt.catches < 1; f++) step();
      return { ...miss, rearmedJumps: state().hunt.jumps, rearmedCatches: state().hunt.catches };
    });
    assert.deepEqual(escape.target, escape.landingTarget, 'no mid-air homing');
    assert.equal(escape.misses, 1); assert.equal(escape.catches, 0);
    assert(escape.distanceToLockedTarget < 19 && escape.distanceToEscapedCursor > 150);
    assert.equal(escape.rearmedJumps, 2); assert.equal(escape.rearmedCatches, 1, 'chases and hunts a new target');
    results.push({ scene: 'escaping cursor and new hunt', ...escape }); await page.close();

    const carried = await scene(browser);
    await carried.evaluate(() => {
      const s = document.getElementById('page-crawler-overlay-v1').crawlerStatus();
      aim(s.x + Math.cos(s.angle) * 90, s.y + Math.sin(s.angle) * 90);
      for (let f = 0; f < 100; f++) { step(); const s = document.getElementById('page-crawler-overlay-v1').crawlerStatus(); if (s.hunt.stage === 'airborne' && s.hunt.time > .05) break; }
      document.dispatchEvent(new CustomEvent('pagecrawler:command', { detail: 'pause' }));
    });
    const paused = await state(carried);
    await carried.evaluate(() => { for (let f = 0; f < 60; f++) step(); });
    assert.deepEqual(await state(carried), paused, 'pause freezes flight and bite');
    await carried.evaluate(() => scrollTo(0, 180));
    await carried.waitForFunction(() => document.getElementById('page-crawler-overlay-v1').crawlerStatus().y < 220, null, { polling: 20 });
    const scroll = await state(carried);
    assert(Math.abs(scroll.worldY - paused.worldY) < .001);
    assert(Math.abs(scroll.y - paused.y + 180) < .001);
    assert.equal(scroll.hunt.time, paused.hunt.time); assert.equal(scroll.bodyHeight, paused.bodyHeight);
    assert(Math.abs(scroll.hunt.target.y - paused.hunt.target.y + 180) < .001);
    assert(scroll.legs.every((leg, i) => Math.abs(leg.y - paused.legs[i].y + 180) < .001));
    await carried.evaluate(() => { document.dispatchEvent(new CustomEvent('pagecrawler:command', { detail: 'pause' })); for (let f = 0; f < 50; f++) step(); });
    assert((await state(carried)).finite);
    results.push({ scene: 'pause and actual scroll during flight', scrollDelta: 180, flightTime: scroll.hunt.time }); await carried.close();

    const loading = await scene(browser);
    await loading.evaluate(() => {
      const state = () => document.getElementById('page-crawler-overlay-v1').crawlerStatus();
      const s = state(); aim(s.x + Math.cos(s.angle) * 125, s.y + Math.sin(s.angle) * 125);
      for (let f = 0; f < 100; f++) { step(); if (state().hunt.stage === 'crouch' && state().hunt.time >= .1) break; }
      document.dispatchEvent(new CustomEvent('pagecrawler:command', { detail: 'pause' }));
    });
    const loaded = await state(loading);
    assert.equal(loaded.hunt.stage, 'crouch'); assert(loaded.bodyCoil > .5);
    await loading.evaluate(() => { for (let f = 0; f < 30; f++) step(); });
    assert.deepEqual(await state(loading), loaded, 'pause freezes backward windup');
    await loading.evaluate(() => scrollTo(0, 100));
    await loading.waitForFunction(() => scrollY === 100 && document.getElementById('page-crawler-overlay-v1').crawlerStatus().y < 300, null, { polling: 20 });
    const shifted = await state(loading);
    assert(Math.abs(shifted.worldY - loaded.worldY) < .001 && shifted.bodyCoil === loaded.bodyCoil);
    await loading.evaluate(() => { document.dispatchEvent(new CustomEvent('pagecrawler:command', { detail: 'pause' })); step(); step(); });
    const resumed = await state(loading);
    assert(Math.hypot(resumed.x - shifted.x, resumed.y - shifted.y) < 5, 'windup origin scrolls too; no body teleport on resume');
    assert.equal(resumed.hunt.jumps, 0, 'cursor escaping during windup cancels launch');
    results.push({ scene: 'paused backward windup, scroll and cancellation', bodyCoil: loaded.bodyCoil, resumeMovement: Math.hypot(resumed.x - shifted.x, resumed.y - shifted.y) });
    await loading.close();

    const controls = await scene(browser, 1, { width: 390, height: 844 });
    const toggles = await controls.evaluate(() => {
      const host = document.getElementById('page-crawler-overlay-v1'), state = host.crawlerStatus;
      const change = (id, checked) => { const el = host.shadowRoot.getElementById(id); el.checked = checked; el.dispatchEvent(new Event('change')); };
      const s = state(); aim(s.x + Math.cos(s.angle) * 90, s.y + Math.sin(s.angle) * 90);
      for (let f = 0; f < 50; f++) { step(); if (state().hunt.stage === 'crouch' && state().bodyCoil > .5) break; }
      change('hunt', false); for (let f = 0; f < 45; f++) step(); const cancelled = state();
      change('hunt', true); for (let f = 0; f < 100 && state().hunt.stage !== 'airborne'; f++) step();
      const launched = state(); change('follow', false);
      for (let f = 0; f < 60; f++) step(); const landed = state();
      return { cancelledJumps: cancelled.hunt.jumps, cancelledHeight: cancelled.bodyHeight, cancelledCoil: cancelled.bodyCoil, launched: launched.hunt.stage,
        catches: landed.hunt.catches, misses: landed.hunt.misses, finite: landed.finite, stage: landed.hunt.stage, following: landed.following };
    });
    assert.equal(toggles.cancelledJumps, 0); assert.equal(toggles.cancelledHeight, 18);
    assert.equal(toggles.cancelledCoil, 0, 'cancelled windup restores uncompressed body');
    assert.equal(toggles.launched, 'airborne'); assert.equal(toggles.catches, 0); assert.equal(toggles.misses, 1);
    assert(toggles.finite && !toggles.following && toggles.stage === 'idle');
    results.push({ scene: 'narrow screen, cancel crouch and disable follow during flight', ...toggles }); await controls.close();
    fs.writeFileSync(path.join(artifactRoot, 'hunt-results.json'), JSON.stringify({ passed: true, version: source.match(/@version\s+(\S+)/)[1], results }, null, 2));
    console.log(JSON.stringify({ passed: true, results }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
