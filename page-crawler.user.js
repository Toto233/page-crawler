// ==UserScript==
// @name         网页爬行者 · Page Crawler
// @namespace    page-crawler.local
// @version      1.0.0
// @description  三维长腿蜘蛛，跟随鼠标、近距离蓄力扑跳与捕食，踩中文字和容器产生可恢复塌陷。
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(() => {
  'use strict';
  const ID = 'page-crawler-overlay-v1';
  if (document.getElementById(ID) || !document.body) return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const random = (a, b) => a + Math.random() * (b - a);
  const palette = ['#61ffc4', '#fa62da', '#76a0ff', '#ff886f', '#adff73'];
  const forbidden = 'input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[role="textbox"],video,audio,iframe,canvas,svg,[data-crawler-ignore]';
  const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  let config = { speed: 1, strength: 1, mode: 'recover', neon: true, enabled: true, follow: true, hunt: true };
  if (hasGM) {
    try { config = { ...config, ...GM_getValue('page-crawler-config', {}) }; } catch (_) { /* defaults */ }
  }
  config.speed = clamp(Number(config.speed) || 1, .3, 2.5);
  config.strength = clamp(Number(config.strength) || 1, .3, 2);
  config.mode = config.mode === 'collapse' ? 'collapse' : 'recover';
  let excluded = false;
  if (hasGM) {
    try { excluded = GM_getValue('page-crawler-excluded-hosts', []).includes(location.hostname); } catch (_) { /* defaults */ }
  }
  const save = () => { if (hasGM) { try { GM_setValue('page-crawler-config', config); } catch (_) { /* unavailable storage */ } } };
  const host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;width:100%!important;height:100%!important;z-index:2147483647!important;pointer-events:none!important;contain:layout style!important;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host{color-scheme:dark}*{box-sizing:border-box}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
      .dock{position:absolute;right:18px;bottom:18px;pointer-events:auto;color:#e7eee9;background:#141a18f5;border:1px solid #45524a;border-radius:14px;box-shadow:0 8px 35px #0003;font:12px/1.5 system-ui,sans-serif;width:276px;padding:14px;user-select:none}
      header{display:flex;align-items:center;gap:9px;margin-bottom:11px}header b{font-size:13px;letter-spacing:.04em}.dot{width:7px;height:7px;border-radius:50%;background:#79efb4;box-shadow:0 0 9px #79efb455}header small{margin-left:auto;color:#8c9a91;font:10px monospace}
      button,select{font:inherit;color:inherit;background:#242e28;border:1px solid #435147;border-radius:6px;padding:6px 9px;cursor:pointer}button:hover{border-color:#a0c3ad}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #79efb4;outline-offset:2px}
      header button{padding:0 5px;border:0;background:none;color:#a8b7ad;font-size:16px}label{display:flex;gap:8px;align-items:center;margin:10px 0;color:#b9c9bf}label span{min-width:48px}input[type=range]{flex:1;min-width:0;accent-color:#79efb4}output{width:30px;font:11px monospace}select{flex:1;padding:4px 6px}input[type=checkbox]{accent-color:#79efb4}
      .actions{display:flex;gap:6px;margin-top:12px}.actions button{flex:1}.actions button:first-child{color:#83edb6}.hint{margin:10px 0 0;color:#83958a;font-size:10px}.tab{position:absolute;bottom:18px;right:18px;pointer-events:auto;font:12px system-ui;background:#141a18;color:#9df2c1;border:1px solid #45524a;border-radius:24px;padding:9px 14px;cursor:pointer}[hidden]{display:none!important}
      @media(max-width:500px){.dock{right:10px;bottom:10px;width:252px}.tab{right:10px;bottom:10px}}
    </style>
    <canvas aria-hidden="true"></canvas>
    <section class="dock" aria-label="网页爬行者控制面板">
      <header><i class="dot"></i><b>PAGE CRAWLER</b><small>快速扑击 / v1.0.0</small><button id="fold" title="收起面板" aria-label="收起面板">−</button></header>
      <label><span>爬行速度</span><input id="speed" type="range" min="0.3" max="2.5" step="0.1"><output id="speedValue"></output></label>
      <label><span>踩踏力度</span><input id="strength" type="range" min="0.3" max="2" step="0.1"><output id="strengthValue"></output></label>
      <label><span>接触效果</span><select id="mode"><option value="recover">踩塌后自动回弹</option><option value="collapse">保留塌陷，手动恢复</option></select></label>
      <label><input id="follow" type="checkbox">跟随鼠标（关闭后自主选目标）</label>
      <label><input id="hunt" type="checkbox">接近鼠标时扑跳捕食</label>
      <label><input id="neon" type="checkbox">霓虹关节与文字碎片</label>
      <div class="actions"><button id="pause">暂停</button><button id="restore">恢复网页</button><button id="close">关闭</button></div>
      <p class="hint" id="navigation">正在寻找路线</p>
      <p class="hint">Alt + Shift：C 开关 · R 恢复 · P 暂停</p>
    </section>
    <button class="tab" hidden title="展开控制面板">◈ 爬行者</button>`;
  document.documentElement.appendChild(host);
  const $ = (selector) => shadow.querySelector(selector);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) { host.remove(); return; }
  let width = innerWidth, height = innerHeight, dpr = 1;
  let frame = 0, lastTime = 0, running = false, destroyed = false, paused = false;
  let elapsed = 0, nextTarget = 0, steps = 0, hits = 0;
  let lastTakeoff = -1, initialized = false;
  let landedOnPage = 0, rejectedLandings = 0;
  const landingHistory = [];
  const gaitOrder = [0, 5, 2, 7, 1, 4, 3, 6];
  let gaitCursor = 0;
  let goalSet = false, goalMode = 'wander', arrivedAt = 0;
  let route = [], routeCursor = 0, navState = 'planning';
  let navigationPoint = null;
  let destination = { x: width * .48, y: height * .45 };
  const body = { x: width * .48, y: height * .45, z: 18, coil: 0, angle: -.5, distance: 0, velocity: 0, angularVelocity: 0, turnSign: 1 };
  const pointer = { x: 0, y: 0, active: false };
  let pageScrollX = scrollX, pageScrollY = scrollY;
  const nestedScrolls = new WeakMap();
  const legs = [];
  // Page = z:0; positive z points out of the screen toward the camera.
  const skeleton = { boneLengths: [52, 66, 68, 10], pairScales: [1, 1.06, .84, .96], bodyHeight: 18, cameraDistance: 600 };
  // Distinct tracks inspired by Fig. 1: two anterior pairs, a lateral third
  // pair, and a posterior fourth pair. These are animation-scale angles.
  const restAngles = [.38, .93, 1.78, 2.57];
  // A visual hunt, independent of normal walking. The browser cursor and page
  // input are untouched. Flight has a fixed launch target, so prey can escape.
  const hunt = { stage: 'idle', time: 0, range: 125, armed: true, cooldownUntil: 0,
    target: null, lastTarget: null, origin: null, windup: null, windupDuration: .18, retreat: 22,
    feet: [], jumps: 0, catches: 0, misses: 0, caught: false };
  const smoothstep = t => t * t * (3 - 2 * t);
  let turnDemand = 0, blockedTurn = false, avoidanceStops = 0;
  const effects = new Map();
  let cooldowns = new WeakMap();
  const particles = [], marks = [];
  const listeners = [];
  function listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    listeners.push(() => target.removeEventListener(event, handler, options));
  }
  function resize() {
    width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!initialized) {
      body.x = clamp(body.x, 20, Math.max(20, width - 20));
      body.y = clamp(body.y, 20, Math.max(20, height - 20));
    }
    destination = { x: body.x, y: body.y }; nextTarget = 0;
    hunt.stage = 'idle'; hunt.time = 0; body.z = skeleton.bodyHeight; body.coil = 0;
    resetLegs();
    initialized = true;
  }
  function world(forward, sideways, heading = body.angle) {
    return { x: body.x + Math.cos(heading) * forward - Math.sin(heading) * sideways,
      y: body.y + Math.sin(heading) * forward + Math.cos(heading) * sideways };
  }
  function restRadius(i) { return [158, 166, 130, 150][i % 4]; }
  function lengthsFor(i) { return skeleton.boneLengths.map(length => length * skeleton.pairScales[i % 4]); }
  function angleDifference(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  function idealFoot(i, ahead = 0, heading = body.angle) {
    const side = i < 4 ? -1 : 1, row = i % 4;
    const center = restAngles[row];
    const angle = center - ahead * .001;
    const radius = restRadius(i) + ahead * .14;
    return world(Math.cos(angle) * radius, side * Math.sin(angle) * radius, heading);
  }
  function hipFor(i, pose = body) {
    const forward = [15, 4, -4, -12][i % 4] * (1 - .12 * pose.coil);
    const sideways = (i < 4 ? -1 : 1) * [7, 10, 10, 7][i % 4] * (1 - .08 * pose.coil);
    return { x: pose.x + Math.cos(pose.angle) * forward - Math.sin(pose.angle) * sideways,
      y: pose.y + Math.sin(pose.angle) * forward + Math.cos(pose.angle) * sideways };
  }
  function footAngle(index, point) {
    const x = point.x - body.x, y = point.y - body.y, side = index < 4 ? -1 : 1;
    return Math.atan2((-x * Math.sin(body.angle) + y * Math.cos(body.angle)) * side,
      x * Math.cos(body.angle) + y * Math.sin(body.angle));
  }
  function supportMargin(exclude = -1, point = body) {
    const points = legs.filter((leg, index) => index !== exclude && leg.state === 'planted')
      .map(leg => ({ x: leg.x, y: leg.y })).sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const lower = [], upper = [];
    for (const foot of points) {
      while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], foot) <= 0) lower.pop();
      lower.push(foot);
    }
    for (const foot of [...points].reverse()) {
      while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], foot) <= 0) upper.pop();
      upper.push(foot);
    }
    const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    if (hull.length < 3) return -Infinity;
    return Math.min(...hull.map((a, i) => {
      const b = hull[(i + 1) % hull.length];
      return cross(a, b, point) / Math.hypot(b.x - a.x, b.y - a.y);
    }));
  }
  function resetLegs() {
    legs.length = 0;
    for (let i = 0; i < 8; i++) {
      const foot = idealFoot(i);
      legs.push({ ...foot, from: { ...foot, z: 0 }, anchor: null, state: 'planted', progress: 1, lift: 0,
        lastStep: -1, lastDistance: body.distance, lastAngle: body.angle,
        nextSearch: 0, duration: .34, phase: (gaitOrder.indexOf(i) / 8), joints: [], joints3D: [] });
    }
    lastTakeoff = -1;
  }
  function huntReady() {
    return config.hunt && config.follow && pointer.active && pointer.x >= 0 && pointer.x <= width && pointer.y >= 0 && pointer.y <= height;
  }
  function huntStage(stage) { hunt.stage = stage; hunt.time = 0; }
  function coilPose(amount, retreat) {
    return { x: hunt.windup.x - Math.cos(body.angle) * retreat * amount,
      y: hunt.windup.y - Math.sin(body.angle) * retreat * amount,
      z: skeleton.bodyHeight - 8 * amount, coil: amount, angle: body.angle };
  }
  function prepareWindup() {
    hunt.windup = { x: body.x, y: body.y };
    // Keep feet planted throughout the loading stroke. Shorten the backward
    // shift if the current stance cannot support it with fixed bone lengths.
    hunt.retreat = 22;
    const allowed = retreat => [.25, .5, .75, 1].every(amount => {
      const pose = coilPose(amount, retreat);
      return supportMargin(-1, pose) >= 8 && legs.every((leg, i) => {
        const hip = hipFor(i, pose), scale = skeleton.pairScales[i % 4];
        const reach = Math.hypot(leg.x - hip.x, leg.y - hip.y, pose.z);
        return reach >= 94 * scale && reach <= lengthsFor(i).reduce((a, b) => a + b) - 8 * scale;
      });
    });
    while (hunt.retreat > 0 && !allowed(hunt.retreat)) hunt.retreat = Math.max(0, hunt.retreat - 2);
  }
  function updateHunt(dt) {
    const ready = huntReady(), distance = Math.hypot(pointer.x - body.x, pointer.y - body.y);
    if (!hunt.armed && ready && elapsed >= hunt.cooldownUntil && hunt.lastTarget &&
        Math.hypot(pointer.x - hunt.lastTarget.x, pointer.y - hunt.lastTarget.y) > 65) hunt.armed = true;
    if (hunt.stage === 'idle') {
      const facing = Math.abs(angleDifference(Math.atan2(pointer.y - body.y, pointer.x - body.x), body.angle));
      if (!ready || !hunt.armed || elapsed < hunt.cooldownUntil || distance > hunt.range || (distance > 22 && facing > .28)) return false;
      huntStage('gather');
    }
    hunt.time += dt * clamp(config.speed, .5, 1.6);
    body.velocity = 0; body.angularVelocity = 0; turnDemand = 0;
    navState = 'hunting'; navigationPoint = null; route = [];
    if (hunt.stage === 'gather') {
      // Complete existing swings, but do not start new walking steps.
      updateLegs(dt);
      if (!ready || distance > hunt.range + 20) { huntStage('idle'); return false; }
      if (legs.every(leg => leg.state === 'planted')) {
        hunt.target = { x: pointer.x, y: pointer.y };
        prepareWindup();
        huntStage('crouch');
      }
    } else if (hunt.stage === 'crouch') {
      const t = clamp(hunt.time / hunt.windupDuration, 0, 1);
      const pose = coilPose(smoothstep(t), hunt.retreat), oldX = body.x, oldY = body.y;
      Object.assign(body, pose); body.distance += Math.hypot(body.x - oldX, body.y - oldY);
      // Range is measured before the intentional backward shift, so loading
      // near the range boundary does not cancel its own attack.
      if (!ready || Math.hypot(pointer.x - hunt.windup.x, pointer.y - hunt.windup.y) > hunt.range + 20 ||
          Math.hypot(pointer.x - hunt.target.x, pointer.y - hunt.target.y) > 35) {
        hunt.caught = false; huntStage('recover');
      } else if (t === 1) {
        // Lock the prey position at launch; no homing or snapping mid-air.
        hunt.target = { x: pointer.x, y: pointer.y };
        hunt.lastTarget = { ...hunt.target }; hunt.armed = false;
        hunt.cooldownUntil = elapsed + 2.2; hunt.origin = { x: body.x, y: body.y };
        hunt.landing = { x: hunt.target.x - Math.cos(body.angle) * 18, y: hunt.target.y - Math.sin(body.angle) * 18 };
        hunt.duration = clamp(Math.hypot(hunt.landing.x - body.x, hunt.landing.y - body.y) / 820, .11, .17);
        hunt.height = 34; hunt.feet = legs.map(leg => ({ x: leg.x - body.x, y: leg.y - body.y }));
        hunt.caught = false; hunt.jumps++; huntStage('airborne');
        for (const leg of legs) { leg.state = 'airborne'; leg.anchor = null; }
      }
    } else if (hunt.stage === 'airborne') {
      const t = clamp(hunt.time / hunt.duration, 0, 1), arc = Math.sin(Math.PI * t);
      const oldX = body.x, oldY = body.y;
      body.x = hunt.origin.x + (hunt.landing.x - hunt.origin.x) * t;
      body.y = hunt.origin.y + (hunt.landing.y - hunt.origin.y) * t;
      body.distance += Math.hypot(body.x - oldX, body.y - oldY);
      body.z = skeleton.bodyHeight - 8 * (1 - t) + 4 * hunt.height * t * (1 - t);
      // Release the compressed stance in the first half of the fast flight.
      body.coil = 1 - smoothstep(clamp(t / .45, 0, 1));
      for (let i = 0; i < 8; i++) {
        const leg = legs[i], rest = idealFoot(i), blend = smoothstep(t), tuck = 1 - .30 * arc;
        const offsetX = hunt.feet[i].x * (1 - blend) + (rest.x - body.x) * blend;
        const offsetY = hunt.feet[i].y * (1 - blend) + (rest.y - body.y) * blend;
        leg.x = body.x + offsetX * tuck; leg.y = body.y + offsetY * tuck;
        leg.lift = Math.max(0, (body.z - skeleton.bodyHeight) * (.72 + .28 * arc) + 10 * arc);
        // A compressed starting stance must not tuck beyond the bow's usable
        // reach. Keep the same outward ray instead of stretching the last bone.
        const hip = hipFor(i), flatReach = Math.hypot(leg.x - hip.x, leg.y - hip.y);
        const minimum = 94 * skeleton.pairScales[i % 4];
        const minimumFlat = Math.sqrt(Math.max(0, minimum ** 2 - (leg.lift - body.z) ** 2));
        if (flatReach < minimumFlat) {
          const scale = minimumFlat / (flatReach || 1);
          leg.x = hip.x + (leg.x - hip.x) * scale; leg.y = hip.y + (leg.y - hip.y) * scale;
        }
        leg.progress = t;
      }
      if (t === 1) {
        body.z = skeleton.bodyHeight;
        for (const leg of legs) {
          leg.state = 'planted'; leg.lift = 0; leg.from = { x: leg.x, y: leg.y, z: 0 };
          leg.lastStep = elapsed; leg.lastDistance = body.distance; leg.lastAngle = body.angle; leg.progress = 1;
          const contact = targetAt(leg.x, leg.y); leg.anchor = contact ? { element: contact.element } : null;
          impact(leg.x, leg.y);
        }
        impact(hunt.target.x, hunt.target.y);
        hunt.caught = ready && Math.hypot(pointer.x - hunt.target.x, pointer.y - hunt.target.y) <= 28;
        if (hunt.caught) hunt.catches++; else hunt.misses++;
        hunt.feet = legs.map(leg => ({ x: leg.x, y: leg.y }));
        huntStage('landing');
      }
    } else if (hunt.stage === 'landing') {
      const t = clamp(hunt.time / .10, 0, 1);
      body.z = skeleton.bodyHeight - 6 * Math.sin(Math.PI * t) ** 2;
      if (t === 1) {
        hunt.feet = legs.map(leg => ({ x: leg.x, y: leg.y }));
        huntStage(hunt.caught && ready ? 'feeding' : 'recover');
      }
    } else if (hunt.stage === 'feeding') {
      const t = clamp(hunt.time / .75, 0, 1), grasp = Math.sin(Math.PI * t) ** 2;
      body.z = skeleton.bodyHeight - 2 * grasp + grasp * Math.sin(hunt.time * 30);
      // Only the front pair reaches inward; six ground contacts keep support.
      for (const i of [0, 4]) {
        const leg = legs[i], base = hunt.feet[i];
        leg.x = base.x + (body.x - base.x) * .16 * grasp;
        leg.y = base.y + (body.y - base.y) * .16 * grasp;
        leg.lift = 10 * grasp; leg.state = grasp > .001 ? 'grasp' : 'planted';
      }
      if (t === 1) for (const i of [0, 4]) Object.assign(legs[i], hunt.feet[i], { lift: 0, state: 'planted', lastStep: elapsed });
      if (t === 1 || !ready) huntStage('recover');
    } else if (hunt.stage === 'recover') {
      const t = clamp(hunt.time / .20, 0, 1);
      body.z += (skeleton.bodyHeight - body.z) * Math.min(1, dt * 25);
      body.coil *= 1 - Math.min(1, dt * 25);
      for (let i = 0; i < 8; i++) {
        const leg = legs[i];
        if (leg.state !== 'grasp') continue;
        const base = hunt.feet[i], blend = Math.min(1, dt * 25);
        leg.x += (base.x - leg.x) * blend; leg.y += (base.y - leg.y) * blend; leg.lift *= 1 - blend;
      }
      if (t === 1) {
        for (let i = 0; i < 8; i++) if (legs[i].state === 'grasp') {
          Object.assign(legs[i], hunt.feet[i], { lift: 0, state: 'planted', lastStep: elapsed });
        }
        body.z = skeleton.bodyHeight; body.coil = 0; huntStage('idle');
        arrivedAt = elapsed; lastTakeoff = elapsed;
      }
    }
    return true;
  }
  function eligible(element) {
    return element instanceof HTMLElement && element !== host && !host.contains(element) &&
      !element.closest(forbidden) && element !== document.body && element !== document.documentElement &&
      !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(element.tagName);
  }
  function targetAt(x, y) {
    if (x < 0 || y < 0 || x > width || y > height) return null;
    const element = document.elementFromPoint(x, y);
    if (!eligible(element)) return null;
    for (let parent = element; parent && parent !== document.body; parent = parent.parentElement) {
      const position = getComputedStyle(parent).position;
      if (position === 'fixed' || position === 'sticky') return null;
    }
    let candidate = element;
    for (let n = 0; candidate && n < 3; candidate = candidate.parentElement, n++) {
      if (!eligible(candidate)) return null;
      const rect = candidate.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 6 && rect.width < Math.min(760, width * .92) && rect.height < 260) {
        if (candidate.querySelector(forbidden)) return null;
        const style = getComputedStyle(candidate);
        if (style.visibility === 'visible' && Number(style.opacity) > .15 && style.position !== 'fixed' && style.position !== 'sticky' &&
          (candidate.textContent.trim() || style.backgroundColor !== 'rgba(0, 0, 0, 0)')) return { element: candidate, rect, style };
      }
    }
    return null;
  }
  function chooseFoothold(index, settling = false) {
    // Predict a landing around the future heading, rather than waiting until
    // the body hits a narrow arbitrary sector boundary before changing feet.
    const heading = body.angle + clamp(turnDemand, -.55, .55);
    const point = idealFoot(index, settling ? 0 : 28, heading);
    const direction = Math.atan2(destination.y - body.y, destination.x - body.x);
    const advance = settling ? 0 : Math.min(10, body.velocity * .14);
    point.x += Math.cos(direction) * advance; point.y += Math.sin(direction) * advance;
    const leg = legs[index], currentAngle = Math.atan2(leg.y - body.y, leg.x - body.x);
    const targetAngle = Math.atan2(point.y - body.y, point.x - body.x);
    let minimum = -Math.PI, maximum = Math.PI;
    for (let other = 0; other < 8; other++) {
      if (other === index) continue;
      const neighbor = legs[other], gap = angleDifference(Math.atan2(neighbor.y - body.y, neighbor.x - body.x), currentAngle);
      if (gap > 0) maximum = Math.min(maximum, gap - Math.min(.14, gap * .3));
      else minimum = Math.max(minimum, gap + Math.min(.14, -gap * .3));
    }
    const angle = currentAngle + clamp(clamp(angleDifference(targetAngle, currentAngle), -.72, .72), minimum, maximum);
    const radius = Math.min(Math.hypot(point.x - body.x, point.y - body.y), restRadius(index) + 12);
    return { x: body.x + Math.cos(angle) * radius, y: body.y + Math.sin(angle) * radius };
  }
  function nearestWord(x, y, target) {
    let range;
    try {
      if (document.caretPositionFromPoint) {
        const caret = document.caretPositionFromPoint(x, y);
        if (!caret) return null;
        range = document.createRange(); range.setStart(caret.offsetNode, caret.offset); range.collapse(true);
      } else if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y);
      if (!range || range.startContainer.nodeType !== Node.TEXT_NODE || !target.element.contains(range.startContainer)) return null;
      const text = range.startContainer.textContent, offset = Math.min(range.startOffset, text.length - 1);
      let start = offset, end = offset;
      if (/[\u3400-\u9fff]/.test(text[offset] || '')) {
        start = Math.max(0, offset - 1); end = Math.min(text.length, offset + 3);
      } else {
        while (start > 0 && /[\w'-]/.test(text[start - 1]) && offset - start < 15) start--;
        while (end < text.length && /[\w'-]/.test(text[end]) && end - start < 26) end++;
      }
      if (end <= start) return null;
      range.setStart(range.startContainer, start); range.setEnd(range.startContainer, end);
      const rect = range.getBoundingClientRect();
      if (!rect.width || Math.hypot(rect.x + rect.width / 2 - x, rect.y + rect.height / 2 - y) > 75) return null;
      const textStyle = getComputedStyle(range.startContainer.parentElement);
      return { text: text.slice(start, end), x: rect.x, y: rect.y + rect.height * .8,
        font: `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize} ${textStyle.fontFamily}` };
    } catch (_) { return null; }
  }
  function impact(x, y) {
    const target = targetAt(x, y);
    if (!target || effects.has(target.element) || (cooldowns.get(target.element) || 0) > elapsed) return;
    const { element, rect, style } = target;
    // Avoid animating parent and child at once, which compounds the deformation.
    for (const active of effects.keys()) if (active.contains(element) || element.contains(active)) return;
    if (effects.size >= 64) release(effects.keys().next().value);
    cooldowns.set(element, elapsed + 4);
    const color = palette[Math.floor(Math.random() * palette.length)];
    const force = config.strength, angle = random(-10, 10) * force;
    const dx = random(-10, 10) * force, dy = random(16, 33) * force;
    const inline = style.display === 'inline' || style.display === 'contents';
    const base = style.transform === 'none' ? '' : style.transform;
    const origin = { transform: base || 'none', opacity: style.opacity, filter: style.filter };
    const squash = { transform: `${base} translate(${dx}px,${dy}px) rotate(${angle}deg) scale(1.02,${1 - .25 * force})`, opacity: '.6' };
    const settled = { transform: `${base} translate(${dx * .6}px,${dy * .66}px) rotate(${angle * .6}deg) scale(1,${1 - .16 * force})`, opacity: '.8' };
    let keyframes;
    if (inline) {
      // Inline text cannot be transformed without wrapping/reparenting it.
      // Animate its paint properties and render a detached word on the overlay.
      keyframes = [{ opacity: style.opacity, color: style.color },
        { opacity: '.25', color, offset: .22 }, { opacity: '.7', color, offset: .55 }];
      keyframes.push(config.mode === 'recover' ? { opacity: style.opacity, color: style.color } : { opacity: '.48', color });
    } else {
      keyframes = [origin, { ...squash, offset: .18 }, { ...settled, offset: .4 },
        config.mode === 'recover' ? origin : settled];
    }
    let animation;
    try {
      animation = element.animate(keyframes, { duration: config.mode === 'recover' ? 2200 : 720,
        easing: 'cubic-bezier(.22,.7,.25,1)', fill: config.mode === 'recover' ? 'none' : 'forwards' });
    } catch (_) { return; }
    effects.set(element, { animation, permanent: config.mode === 'collapse' });
    animation.onfinish = () => {
      if (config.mode === 'recover' && effects.get(element)?.animation === animation) release(element);
    };
    hits++;
    if (config.neon) {
      marks.push({ x: rect.x, y: rect.y, w: rect.width, h: rect.height, life: 1.1, maxLife: 1.1, color });
      const word = nearestWord(x, y, target);
      if (word) particles.push({ ...word, vx: random(-20, 20), vy: random(-60, -22), angle: 0,
        spin: random(-1, 1), life: 1.8, maxLife: 1.8, color, word: true });
      for (let i = 0; i < 5; i++) particles.push({ x, y, vx: random(-65, 65), vy: random(-100, -25),
        angle: random(-1, 1), spin: random(-3, 3), life: random(.5, 1), maxLife: 1, color, word: false });
      if (particles.length > 200) particles.splice(0, particles.length - 200);
      if (marks.length > 48) marks.splice(0, marks.length - 48);
    }
  }
  function release(element) {
    const effect = effects.get(element);
    if (effect) { effect.animation.onfinish = null; effect.animation.cancel(); effects.delete(element); }
  }
  function restore() {
    for (const element of [...effects.keys()]) release(element);
    particles.length = 0; marks.length = 0; cooldowns = new WeakMap();
    ctx.clearRect(0, 0, width, height);
  }
  function updateLegs(dt) {
    for (let i = 0; i < 8; i++) {
      const leg = legs[i];
      if (leg.state !== 'swing') continue;
      const point = leg.target;
      leg.progress = Math.min(1, leg.progress + dt * config.speed / leg.duration);
      const t = leg.progress, smooth = t * t * (3 - 2 * t);
      leg.x = leg.from.x + (point.x - leg.from.x) * smooth;
      leg.y = leg.from.y + (point.y - leg.from.y) * smooth;
      leg.lift = Math.sin(t * Math.PI) ** 2 * [22, 20, 16, 20][i % 4];
      if (t === 1) {
        const contact = targetAt(point.x, point.y);
        leg.anchor = contact ? { element: contact.element } : null;
        leg.state = 'planted'; leg.lastStep = elapsed; leg.lift = 0;
        leg.lastDistance = body.distance; leg.lastAngle = body.angle;
        steps++; landedOnPage++;
        landingHistory.push({ leg: i, time: elapsed, x: point.x, y: point.y, tag: contact?.element.tagName || 'GROUND',
          target: contact?.element.id || contact?.element.tagName || 'page-plane' });
        if (landingHistory.length > 80) landingHistory.shift();
        impact(point.x, point.y);
      }
    }
    const settling = navState === 'arrived' && elapsed - arrivedAt < .4 / config.speed;
    if (navState !== 'walking' && !settling) return;
    const turning = Math.abs(turnDemand) > .3 || settling;
    const swingLimit = turning ? 4 : 3;
    if (elapsed - lastTakeoff < (turning ? .035 : .075) / config.speed || legs.filter(leg => leg.state === 'swing').length >= swingLimit) return;
    const candidates = [];
    for (let i = 0; i < 8; i++) {
      const leg = legs[i];
      if (leg.state === 'swing' || elapsed < leg.nextSearch || elapsed - leg.lastStep < (turning ? .08 : .18) / config.speed) continue;
      const hip = hipFor(i), ideal = idealFoot(i, settling ? 0 : 28, body.angle + clamp(turnDemand, -.55, .55));
      const reach = Math.hypot(leg.x - hip.x, leg.y - hip.y);
      const strain = Math.hypot(leg.x - ideal.x, leg.y - ideal.y);
      const center = restAngles[i % 4];
      const yawError = Math.abs(angleDifference(footAngle(i, leg), center));
      const maximum = lengthsFor(i).reduce((a, b) => a + b) - 12;
      const needsSupport = reach > maximum - 9 || Math.hypot(leg.x - body.x, leg.y - body.y) < restRadius(i) - 30 || yawError > .36;
      if (settling && yawError < .24 && Math.abs(Math.hypot(leg.x - body.x, leg.y - body.y) - restRadius(i)) < 24) continue;
      if (!needsSupport && strain < (turning ? 24 : 34)) continue;
      if (!needsSupport && !turning && body.distance - leg.lastDistance < 24) continue;
      const rank = (gaitOrder.indexOf(i) - gaitCursor + 8) % 8;
      candidates.push({ index: i, priority: (needsSupport ? 100 : 0) + strain + yawError * 60 - rank * 5 });
    }
    candidates.sort((a, b) => b.priority - a.priority);
    for (const { index } of candidates) {
      // Count alone does not establish support: the remaining contact polygon
      // must contain the body before this foot is allowed to lift.
      if (supportMargin(index) < 8) continue;
      const leg = legs[index], target = chooseFoothold(index, settling);
      if (Math.hypot(leg.x - target.x, leg.y - target.y) < 8) { leg.nextSearch = elapsed + .05; continue; }
      leg.from = { x: leg.x, y: leg.y, z: 0 }; leg.target = target; leg.anchor = null;
      leg.state = 'swing'; leg.progress = 0;
      leg.duration = turning ? .15 + leg.phase * .015 : [ .26, .27, .21, .23 ][index % 4];
      lastTakeoff = elapsed; gaitCursor = (gaitOrder.indexOf(index) + 1) % 8;
      break;
    }
  }
  function project(point) {
    // A body-centered camera preserves translation under page scrolling.
    // At z=0 this is exactly the DOM coordinate, including at viewport edges.
    const scale = skeleton.cameraDistance / (skeleton.cameraDistance - point.z);
    return { x: body.x + (point.x - body.x) * scale, y: body.y + (point.y - body.y) * scale };
  }
  function solveLeg(index) {
    const foot = legs[index], side = index < 4 ? -1 : 1, row = index % 4;
    const hip = { ...hipFor(index), z: body.z };
    const toe = { x: foot.x, y: foot.y, z: foot.lift };
    const delta = { x: toe.x - hip.x, y: toe.y - hip.y, z: toe.z - hip.z };
    const distance = Math.hypot(delta.x, delta.y, delta.z) || .001;
    const axis = { x: delta.x / distance, y: delta.y / distance, z: delta.z / distance };
    const lengths = lengthsFor(index), [femur, tibia, meta, tarsus] = lengths;
    // One continuous, same-sign bow in a transported leg plane. There is no
    // per-frame selection between mirror solutions. The attachment segment
    // follows the metatarsus, giving three functional bending segments.
    const fraction = .5;
    const resultant = bend => ({ x: femur + tibia * Math.cos(bend * fraction) + (meta + tarsus) * Math.cos(bend),
      y: -tibia * Math.sin(bend * fraction) - (meta + tarsus) * Math.sin(bend) });
    let low = 0, high = 2.85;
    for (let iteration = 0; iteration < 24; iteration++) {
      const middle = (low + high) / 2, vector = resultant(middle);
      if (Math.hypot(vector.x, vector.y) > distance) low = middle;
      else high = middle;
    }
    const bend = (low + high) / 2, vector = resultant(bend);
    const pitch = -Math.atan2(vector.y, vector.x);
    const flat = Math.hypot(axis.x, axis.y) || 1;
    const up = { x: -axis.x * axis.z / flat, y: -axis.y * axis.z / flat, z: flat };
    const lateral = { x: -axis.y / flat, y: axis.x / flat, z: 0 };
    const bearing = Math.atan2(foot.y - body.y, foot.x - body.x);
    const clearance = Math.min(...legs.filter(leg => leg !== foot).map(leg =>
      Math.abs(angleDifference(Math.atan2(leg.y - body.y, leg.x - body.x), bearing))));
    const lean = side * [.15, .075, -.065, -.13][row] * clamp(clearance / .5, 0, 1);
    const normal = { x: up.x * Math.cos(lean) + lateral.x * Math.sin(lean),
      y: up.y * Math.cos(lean) + lateral.y * Math.sin(lean), z: up.z * Math.cos(lean) };
    const angles = [pitch, pitch - bend * fraction, pitch - bend, pitch - bend];
    const points = [hip];
    for (let bone = 0; bone < 4; bone++) {
      const previous = points[bone], length = lengths[bone], c = Math.cos(angles[bone]), s = Math.sin(angles[bone]);
      points.push({ x: previous.x + length * (axis.x * c + normal.x * s),
        y: previous.y + length * (axis.y * c + normal.y * s),
        z: previous.z + length * (axis.z * c + normal.z * s) });
    }
    // The scalar closure solve makes this exact to subpixel precision. Keep
    // the planted contact coordinates exact for scrolling and hit detection.
    points[4] = toe;
    foot.joints3D = points; foot.joints = points.map(project);
    return foot.joints;
  }
  function line(ax, ay, bx, by, color, lineWidth = 1.8) {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke();
  }
  function joint(x, y, radius, color) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }
  function draw(dt) {
    ctx.clearRect(0, 0, width, height);
    if (hunt.target && ['crouch', 'airborne', 'landing', 'feeding'].includes(hunt.stage)) {
      ctx.save();
      const feeding = hunt.stage === 'feeding', pulse = feeding ? .5 + .5 * Math.sin(hunt.time * 28) : 0;
      ctx.strokeStyle = config.neon ? '#fa62da' : '#bb705e'; ctx.fillStyle = ctx.strokeStyle;
      ctx.globalAlpha = feeding ? .7 * (1 - hunt.time / .75) : .45;
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hunt.target.x, hunt.target.y, feeding ? 8 + pulse * 4 : 12, 0, Math.PI * 2); ctx.stroke();
      if (feeding) { ctx.beginPath(); ctx.ellipse(hunt.target.x, hunt.target.y, 3, 2, body.angle, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    for (let i = marks.length - 1; i >= 0; i--) {
      const mark = marks[i]; mark.life -= dt;
      if (mark.life <= 0) { marks.splice(i, 1); continue; }
      ctx.globalAlpha = mark.life / mark.maxLife * .7;
      ctx.strokeStyle = mark.color; ctx.lineWidth = 1;
      ctx.strokeRect(mark.x - 2, mark.y - 2, mark.w + 4, mark.h + 4);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; p.angle += p.spin * dt;
      ctx.save(); ctx.globalAlpha = Math.min(1, p.life * 1.6); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.word) { ctx.font = p.font; ctx.scale(1.15, 1.15); ctx.fillText(p.text, 0, 0); }
      else ctx.fillRect(-2, -1, random(2, 4), 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const legColor = config.neon ? '#ff8b78' : '#33443a';
    const jointColor = config.neon ? '#73ffbf' : '#689577';
    // Project the light rays onto the page before drawing the elevated limbs.
    for (let i = 0; i < 8; i++) solveLeg(i);
    ctx.save();
    for (const foot of legs) {
      ctx.globalAlpha = foot.state === 'search' ? .12 : .26;
      for (let j = 0; j < skeleton.boneLengths.length; j++) {
        const a = foot.joints3D[j], b = foot.joints3D[j + 1];
        ctx.filter = `blur(${1 + (a.z + b.z) * .018}px)`;
        line(a.x + a.z * .24, a.y + a.z * .38, b.x + b.z * .24, b.y + b.z * .38, '#000', 3);
      }
    }
    ctx.filter = `blur(${5 + body.z * .1}px)`; ctx.globalAlpha = .28 * clamp(1 - body.z / 160, .25, 1);
    ctx.translate(body.x + body.z * .24, body.y + body.z * .38); ctx.rotate(body.angle);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(-12, 0, 32, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // Farther segments first: crossings and thickness also convey depth.
    const segments = legs.flatMap(foot => skeleton.boneLengths.map((_, j) => ({ foot, j,
      depth: (foot.joints3D[j].z + foot.joints3D[j + 1].z) / 2 })));
    segments.sort((a, b) => a.depth - b.depth);
    for (const { foot, j, depth } of segments) {
      ctx.globalAlpha = foot.state === 'search' ? .45 : 1;
      const a = foot.joints[j], b = foot.joints[j + 1];
      const thickness = [1.25, 1.1, .8, .55][j] * skeleton.cameraDistance / (skeleton.cameraDistance - depth);
      line(a.x, a.y, b.x, b.y, '#101918', thickness + .8);
      line(a.x, a.y, b.x, b.y, legColor, thickness);
    }
    for (let i = 0; i < 8; i++) {
      const foot = legs[i], points = foot.joints;
      ctx.globalAlpha = foot.state === 'search' ? .45 : 1;
      for (let j = 1; j < 4; j++) joint(points[j].x, points[j].y,
        [0, 1.7, 1.25, .9][j] * skeleton.cameraDistance / (skeleton.cameraDistance - foot.joints3D[j].z), jointColor);
      joint(points[4].x, points[4].y, foot.state === 'planted' ? 1.8 : 1.2, jointColor);
    }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(body.x, body.y); ctx.rotate(body.angle);
    const bodyScale = skeleton.cameraDistance / (skeleton.cameraDistance - body.z);
    ctx.scale(bodyScale, bodyScale);
    ctx.shadowColor = '#0008'; ctx.shadowBlur = 5;
    ctx.fillStyle = '#101918'; ctx.strokeStyle = config.neon ? '#76a0ff' : '#85b99c'; ctx.lineWidth = 1.6;
    const abdomenX = -21 + 6 * body.coil;
    ctx.beginPath(); ctx.ellipse(abdomenX, 0, 18 * (1 - .08 * body.coil), 8 * (1 + .06 * body.coil), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(5, 0, 13, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    joint(12, -3, 2, config.neon ? '#fa62da' : '#b5e1bd'); joint(12, 3, 2, config.neon ? '#fa62da' : '#b5e1bd');
    const bite = hunt.stage === 'feeding' ? Math.sin(hunt.time * 30) * 3 : 0;
    line(17, -4, 24, -7 + bite, legColor, 1.3); line(17, 4, 24, 7 - bite, legColor, 1.3);
    line(abdomenX - 9, 0, abdomenX + 8, 0, '#73ffbf66', 1); ctx.restore();
  }
  function tick(time) {
    frame = 0;
    if (!running || destroyed) return;
    if (!host.isConnected) { destroy(); return; }
    const dt = Math.min((time - (lastTime || time)) / 1000, .04); lastTime = time;
    elapsed += dt;
    if (config.follow && pointer.active) {
      if (goalMode !== 'mouse' || !goalSet || Math.hypot(pointer.x - destination.x, pointer.y - destination.y) > .5) {
        destination = { x: pointer.x, y: pointer.y }; goalSet = true; goalMode = 'mouse';
      }
    } else {
      if (goalMode === 'mouse') goalSet = false;
      if ((!goalSet && elapsed >= nextTarget) || (navState === 'arrived' && elapsed - arrivedAt > 1.4)) {
        destination = { x: random(35, Math.max(36, width - 35)), y: random(35, Math.max(36, height - 35)) };
        goalSet = true; goalMode = 'wander';
      }
    }
    if (updateHunt(dt)) {
      const labels = { gather: '准备扑跳 · 收稳支撑', crouch: '向后蜷身 · 蓄力', airborne: '向前扑向鼠标', landing: hunt.caught ? '落地 · 抓住目标' : '扑空 · 收稳', feeding: '捕食 · 前腿抓握', recover: '恢复站姿' };
      $('#navigation').textContent = labels[hunt.stage] || '收稳站姿';
      for (const [element] of effects) if (!element.isConnected) release(element);
      draw(dt); frame = requestAnimationFrame(tick); return;
    }
    const goalDistance = Math.hypot(destination.x - body.x, destination.y - body.y);
    if (goalDistance <= 15) {
      if (navState !== 'arrived') arrivedAt = elapsed;
      navState = 'arrived'; navigationPoint = null; route = [];
    } else {
      navState = 'walking'; navigationPoint = destination; route = [{ ...destination }];
    }
    const dx = navigationPoint ? navigationPoint.x - body.x : 0, dy = navigationPoint ? navigationPoint.y - body.y : 0;
    const desired = Math.atan2(dy, dx);
    let delta = angleDifference(desired, body.angle);
    if (Math.abs(delta) > 3.05) delta = Math.abs(delta) * body.turnSign;
    turnDemand = navState === 'walking' ? delta : 0;
    if (Math.abs(delta) > .1 && Math.abs(delta) < 3.05) body.turnSign = Math.sign(delta);
    const poseAllowed = () => supportMargin() >= 3 && legs.every((leg, index) => {
      const hip = hipFor(index), scale = skeleton.pairScales[index % 4];
      const reach = Math.hypot(leg.x - hip.x, leg.y - hip.y, leg.lift - skeleton.bodyHeight);
      if (reach < 100 * scale || reach > lengthsFor(index).reduce((a, b) => a + b) - 8 * scale) return false;
      if (leg.state === 'swing') return true;
      const center = restAngles[index % 4];
      return Math.abs(angleDifference(footAngle(index, leg), center)) < 1.04;
    });
    blockedTurn = false;
    const angularTarget = navState === 'walking' ? clamp(delta * 9, -4.2 * config.speed, 4.2 * config.speed) : 0;
    body.angularVelocity += (angularTarget - body.angularVelocity) * Math.min(1, dt * 18);
    const oldAngle = body.angle;
    const rotation = Math.abs(delta) < Math.abs(body.angularVelocity * dt) ? delta : body.angularVelocity * dt;
    if (navState === 'walking') {
      let fraction = 1;
      for (let attempt = 0; attempt < 8; attempt++) {
        body.angle = oldAngle + rotation * fraction;
        if (poseAllowed()) break;
        body.angle = oldAngle; fraction *= .5;
      }
      if (fraction < .9) { blockedTurn = true; avoidanceStops++; }
    }
    const planted = legs.filter(leg => leg.state === 'planted');
    const support = planted.length < 4 ? 0 : Math.min(1, ...planted.map(leg => {
      const index = legs.indexOf(leg), hip = hipFor(index);
      const maximum = lengthsFor(index).reduce((a, b) => a + b) - 8 * skeleton.pairScales[index % 4];
      return clamp((maximum - Math.hypot(leg.x - hip.x, leg.y - hip.y, skeleton.bodyHeight)) / 16, 0, 1);
    }));
    const alignment = .2 + .8 * Math.max(0, Math.cos(delta));
    const desiredSpeed = navState !== 'walking' ? 0 : Math.min(58 * config.speed, goalDistance * 3) * support * alignment;
    body.velocity += (desiredSpeed - body.velocity) * Math.min(1, dt * 9);
    const speed = support > 0 && navState === 'walking' ? body.velocity : 0;
    const oldX = body.x, oldY = body.y;
    const travelLength = Math.hypot(dx, dy) || 1;
    body.x += dx / travelLength * speed * dt;
    body.y += dy / travelLength * speed * dt;
    if (!poseAllowed()) { body.x = oldX; body.y = oldY; avoidanceStops++; }
    body.distance += Math.hypot(body.x - oldX, body.y - oldY); updateLegs(dt);
    for (const [element] of effects) if (!element.isConnected) release(element);
    $('#navigation').textContent = navState === 'arrived' ? '已到达目标，停步观察' : goalMode === 'mouse' ? '朝鼠标前进' : '自由漫步';
    draw(dt); frame = requestAnimationFrame(tick);
  }
  function synchronize() {
    if (destroyed) return;
    const visible = config.enabled && !excluded;
    const shouldRun = visible && !paused && !document.hidden;
    host.style.setProperty('display', visible ? 'block' : 'none', 'important');
    if (shouldRun && !running) {
      running = true; lastTime = 0;
      for (const { animation } of effects.values()) if (animation.playState === 'paused') animation.play();
      frame = requestAnimationFrame(tick);
    } else if (!shouldRun) {
      running = false; cancelAnimationFrame(frame); frame = 0;
      for (const { animation } of effects.values()) if (animation.playState === 'running') animation.pause();
    }
    $('#pause').textContent = paused ? '继续' : '暂停';
    $('.dot').style.background = paused ? '#e2b66c' : '#79efb4';
  }
  function toggle() {
    config.enabled = !config.enabled;
    if (!config.enabled) restore();
    save(); synchronize();
  }
  function setPaused(value) { paused = value; synchronize(); }
  function destroy() {
    if (destroyed) return;
    running = false; destroyed = true; cancelAnimationFrame(frame); restore();
    listeners.forEach(remove => remove()); host.remove();
    document.removeEventListener('pagecrawler:command', command);
  }
  function fold(value) { $('.dock').hidden = value; $('.tab').hidden = !value; }
  for (const key of ['speed', 'strength']) {
    $(`#${key}`).value = config[key]; $(`#${key}Value`).textContent = `${config[key].toFixed(1)}×`;
    listen($(`#${key}`), 'input', (event) => {
      config[key] = Number(event.target.value); $(`#${key}Value`).textContent = `${config[key].toFixed(1)}×`; save();
    });
  }
  $('#mode').value = config.mode; $('#neon').checked = config.neon; $('#follow').checked = config.follow; $('#hunt').checked = config.hunt;
  listen($('#mode'), 'change', (event) => { restore(); config.mode = event.target.value; save(); });
  listen($('#neon'), 'change', (event) => { config.neon = event.target.checked; save(); });
  listen($('#follow'), 'change', (event) => { config.follow = event.target.checked; goalSet = false; nextTarget = 0; save(); });
  listen($('#hunt'), 'change', (event) => { config.hunt = event.target.checked; save(); });
  listen($('#pause'), 'click', () => setPaused(!paused)); listen($('#restore'), 'click', restore);
  listen($('#close'), 'click', toggle); listen($('#fold'), 'click', () => fold(true)); listen($('.tab'), 'click', () => fold(false));
  listen(window, 'resize', resize, { passive: true });
  listen(window, 'pointermove', (event) => {
    if (event.pointerType === 'touch' || event.composedPath().includes(host)) return;
    pointer.x = event.clientX; pointer.y = event.clientY; pointer.active = true;
  }, { passive: true });
  listen(document, 'pointerleave', () => { pointer.active = false; nextTarget = 0; });
  listen(window, 'blur', () => { pointer.active = false; nextTarget = 0; });
  function scrollCreature(dx, dy) {
    if (!dx && !dy) return;
    body.x -= dx; body.y -= dy; destination.x -= dx; destination.y -= dy;
    for (const point of [hunt.target, hunt.lastTarget, hunt.origin, hunt.landing, hunt.windup]) if (point) { point.x -= dx; point.y -= dy; }
    if (['landing', 'feeding', 'recover'].includes(hunt.stage)) for (const point of hunt.feet) { point.x -= dx; point.y -= dy; }
    for (const leg of legs) {
      leg.x -= dx; leg.y -= dy; leg.from.x -= dx; leg.from.y -= dy;
      if (leg.target) { leg.target.x -= dx; leg.target.y -= dy; }
    }
    for (const particle of particles) { particle.x -= dx; particle.y -= dy; }
    for (const mark of marks) { mark.x -= dx; mark.y -= dy; }
    for (const waypoint of route) { waypoint.x -= dx; waypoint.y -= dy; }
    if (navigationPoint && navigationPoint !== destination) { navigationPoint.x -= dx; navigationPoint.y -= dy; }
    // Even while paused, the creature is carried by the page it is standing on.
    draw(0);
  }
  listen(window, 'wheel', (event) => {
    for (let element = event.target instanceof Element ? event.target : null; element && element !== document.body; element = element.parentElement) {
      if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
        nestedScrolls.set(element, { x: element.scrollLeft, y: element.scrollTop });
      }
    }
  }, { passive: true, capture: true });
  listen(window, 'scroll', (event) => {
    const dx = scrollX - pageScrollX, dy = scrollY - pageScrollY;
    pageScrollX = scrollX; pageScrollY = scrollY;
    if (dx || dy) scrollCreature(dx, dy);
    else if (event.target instanceof Element) {
      const element = event.target, previous = nestedScrolls.get(element);
      if (previous && legs.filter(leg => leg.state === 'planted' && element.contains(leg.anchor?.element)).length >= 3) {
        scrollCreature(element.scrollLeft - previous.x, element.scrollTop - previous.y);
      }
      nestedScrolls.set(element, { x: element.scrollLeft, y: element.scrollTop });
    }
  }, { passive: true, capture: true });
  listen(document, 'visibilitychange', synchronize);
  listen(window, 'keydown', (event) => {
    if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.repeat || event.isComposing) return;
    if (event.composedPath().some(node => node instanceof Element && node.matches(forbidden))) return;
    if (event.code === 'KeyC') { event.preventDefault(); toggle(); }
    if (event.code === 'KeyR') { event.preventDefault(); restore(); }
    if (event.code === 'KeyP') { event.preventDefault(); setPaused(!paused); }
  });
  const command = (event) => {
    switch (event.detail) {
      case 'toggle': toggle(); break;
      case 'restore': restore(); break;
      case 'pause': setPaused(!paused); break;
      case 'destroy': destroy(); break;
    }
  };
  document.addEventListener('pagecrawler:command', command);
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('开关网页爬行者', toggle);
    GM_registerMenuCommand('恢复网页', restore);
    GM_registerMenuCommand('暂停 / 继续', () => setPaused(!paused));
    GM_registerMenuCommand('当前网站：排除 / 重新启用', () => {
      if (!hasGM) return;
      const list = GM_getValue('page-crawler-excluded-hosts', []);
      excluded = !excluded;
      GM_setValue('page-crawler-excluded-hosts', excluded ? [...new Set([...list, location.hostname])] : list.filter(item => item !== location.hostname));
      if (excluded) restore(); synchronize();
    });
  }
  // Read-only diagnostics used by the local demo and browser checks.
  host.crawlerStatus = () => ({ running, paused, enabled: config.enabled, excluded, steps, hits,
    effects: effects.size, particles: particles.length, x: body.x, y: body.y,
    bodyHeight: body.z, bodyCoil: body.coil, hunting: config.hunt, hunt: { stage: hunt.stage, time: hunt.time, range: hunt.range,
      armed: hunt.armed, cooldownRemaining: Math.max(0, hunt.cooldownUntil - elapsed),
      jumps: hunt.jumps, catches: hunt.catches, misses: hunt.misses, target: hunt.target && { ...hunt.target }, caught: hunt.caught },
    worldX: body.x + scrollX, worldY: body.y + scrollY, follow: config.follow, following: config.follow && pointer.active,
    destination: { ...destination }, pointer: { ...pointer }, skeleton: { ...skeleton, boneLengths: [...skeleton.boneLengths], pairScales: [...skeleton.pairScales] },
    avoidanceStops, blockedTurn, angle: body.angle, angularVelocity: body.angularVelocity, supportMargin: supportMargin(),
    navigation: navState, goalMode, routeCursor, route: route.map(point => ({ x: point.x, y: point.y })),
    distance: body.distance, landedOnPage, rejectedLandings, ground: 'page-plane',
    legs: legs.map((leg, index) => ({ index, state: leg.state, x: leg.x, y: leg.y, lift: leg.lift,
      progress: leg.progress, lastStep: leg.lastStep, grounded: leg.state === 'planted', onElement: Boolean(targetAt(leg.x, leg.y)),
      segments: leg.joints.length - 1, boneLengths: lengthsFor(index), joints: leg.joints.map(point => ({ ...point })),
      joints3D: leg.joints3D.map(point => ({ ...point })) })),
    landings: landingHistory.map(landing => ({ ...landing })),
    finite: [body.x, body.y, body.z, body.coil, body.angle, ...legs.flatMap(leg => [leg.x, leg.y,
      ...leg.joints.flatMap(point => [point.x, point.y]), ...leg.joints3D.flatMap(point => [point.x, point.y, point.z])])].every(Number.isFinite) });
  resize(); synchronize();
})();
