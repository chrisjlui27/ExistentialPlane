// Headless handover check for book-of-sheets.html.
// Opens the app in Chromium at a 1340 × 800 touch viewport, runs the #test
// suite, drives the four v0.1 flows with real touch events, checks T13 by
// reload and by JSON export then import, and saves screenshots.
//
//   node tools/headless.cjs            (uses a local or global Playwright)
//
// Screenshots land in docs/screenshots/.
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* fall through */ }
  const g = execSync('npm root -g').toString().trim();
  return require(path.join(g, 'playwright'));
}
const { chromium } = loadPlaywright();

const ROOT = path.join(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'book-of-sheets.html');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? undefined : undefined });
  const context = await browser.newContext({
    viewport: { width: 1340, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1.5,
    acceptDownloads: true, colorScheme: 'light',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const cdp = await context.newCDPSession(page);

  async function touchPath(pts, holdMs = 0) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
    if (holdMs) await sleep(holdMs);
    for (const p of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p[0], y: p[1] }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(120);
  }
  async function pinch(c, d0, d1) {
    const pts = d => [{ x: c[0] - d, y: c[1] }, { x: c[0] + d, y: c[1] }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(d0) });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d0 + (d1 - d0) * i / 10) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(120);
  }
  const ring = (c, r, n = 48, extra = 1.04) => Array.from({ length: Math.round(n * extra) + 1 }, (_, i) => { const t = 2 * Math.PI * i / n; return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]; });
  async function tap(x, y) { await page.touchscreen.tap(x, y); await sleep(420); }
  async function center(sel) { const b = await page.locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; }
  const panelText = () => page.locator('#panel').innerText();
  const state = () => page.evaluate(() => JSON.stringify(window.BookOfSheets.state()));

  // ---- 1. The in-browser acceptance suite (#test) ----
  await page.goto(URL + '#test');
  await page.waitForFunction(() => Array.isArray(window.__bosTests));
  const suite = await page.evaluate(() => window.__bosTests);
  for (const r of suite) check(`${r.id} ${r.name}`, r.manual || r.pass, r.detail);
  await page.screenshot({ path: path.join(SHOTS, '00-test-suite.png') });

  // ---- 2. First run: About shows viewport and pixel ratio ----
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(URL);
  await page.waitForSelector('#dialog h2');
  const about = await page.locator('#dialog').innerText();
  check('About on first run shows viewport and devicePixelRatio', /1340 × 800/.test(about) && /devicePixelRatio\s*1\.5/.test(about), about.split('\n').slice(2, 6).join(' | '));
  await page.screenshot({ path: path.join(SHOTS, '01-first-run-about.png') });
  await page.tap('text=Start drawing');
  await sleep(200);
  await page.screenshot({ path: path.join(SHOTS, '02-example-page.png') });

  // ---- Flow 1: watch a cut lift (square torus, loop around 1) ----
  await page.tap('#menuBtn');
  await page.tap('[data-menu="clearPage"]');
  await sleep(150);
  const m1 = await center('#base .mk1');
  await touchPath(ring(m1, 64));
  await page.tap('#tabs [data-tab="sheets"]');
  await sleep(150);
  let txt = await panelText();
  check('Flow 1: loop around 1 lifts to 2 components across 4 sheets', /end-cut around 1: 2 components; c\(σ₁\) = 2/.test(txt) && /sheets 1, 3/.test(txt) && /sheets 2, 4/.test(txt));
  await page.screenshot({ path: path.join(SHOTS, '03-flow1-lift.png') });
  // long-press the cut: class, crossing word, highlighted lift
  await touchPath([[m1[0] + 64, m1[1]], [m1[0] + 64, m1[1]]], 650);
  txt = await page.locator('#cards').innerText();
  check('Long-press a cut shows its class and crossing word', /end-cut around 1/.test(txt) && /out \(0,1\)|in \(0,1\)/.test(txt), txt.replace(/\n/g, ' | '));
  await page.screenshot({ path: path.join(SHOTS, '04-long-press.png') });
  // tap a sheet thumbnail to enlarge, then a component in the legend
  await page.tap('.thumb[data-e="0"]');
  await sleep(120);
  check('Tap a sheet thumbnail enlarges it', await page.locator('.bigsheet svg').count() === 1);
  await page.tap('.legend button >> nth=0');   // sheets 1, 3: on the enlarged sheet 1
  await sleep(120);
  check('Tap a lifted component highlights it and its source cut', await page.locator('#base .cut.hl').count() === 1 && await page.locator('.bigsheet .lift.on').count() >= 1);
  await page.screenshot({ path: path.join(SHOTS, '05-sheet-enlarged.png') });
  await page.tap('[data-act="grid"]');

  // ---- Stroke validation on the real canvas (T11) ----
  const open = Array.from({ length: 30 }, (_, i) => { const t = 1.4 * Math.PI * i / 29; return [m1[0] + 300 + 60 * Math.cos(t), m1[1] + 280 + 60 * Math.sin(t)]; });
  await touchPath(open);
  const hint1 = await page.locator('#hint').innerText();
  check('Unclosed stroke is refused with a reason', /did not close/.test(hint1), hint1);
  await page.screenshot({ path: path.join(SHOTS, '06-refused-stroke.png') });
  const m0 = await center('#base .mk0');
  await touchPath(ring([m0[0] - 30, m0[1]], 30));
  const hint2 = await page.locator('#hint').innerText();
  check('Stroke through a marked point is refused with a reason', /within 12 px of the marked point 0/.test(hint2), hint2);

  // ---- Pinch zoom and double-tap reset ----
  const st = await page.locator('#base').boundingBox();
  const sc = [st.x + st.width * 0.5, st.y + st.height * 0.5];
  const z0 = await page.evaluate(() => window.BookOfSheets.ui.view.z);
  await pinch(sc, 60, 140);
  const z1 = await page.evaluate(() => window.BookOfSheets.ui.view.z);
  check('Pinch zooms the base page', z1 > z0 * 1.8, `zoom ${z0} → ${z1.toFixed(2)}`);
  await page.touchscreen.tap(st.x + 40, st.y + st.height - 40);
  await sleep(90);
  await page.touchscreen.tap(st.x + 40, st.y + st.height - 40);
  await sleep(450);
  check('Double-tap on empty space resets the view', await page.evaluate(() => window.BookOfSheets.ui.view.z) === 1);

  // ---- Flow 2: check an entailment ----
  await page.tap('#menuBtn');
  await page.tap('[data-menu="clearPage"]');
  await sleep(120);
  const disk = await page.locator('#base .bp-disk').boundingBox();
  const dc = [disk.x + disk.width / 2, disk.y + disk.height / 2];
  await touchPath(ring(dc, 92, 56));
  await touchPath(ring(dc, 38, 40));
  await page.tap('#modes [data-mode="letter"]');
  await tap(dc[0], dc[1] - 140);               // A outside both cuts
  await tap(dc[0], dc[1] - 65);                // A between the cuts
  await page.tap('#letters [data-letter="B"]');
  await tap(dc[0], dc[1]);                     // B inside the inner cut
  await page.tap('#pageSel [data-page="Q"]');
  await tap(dc[0], dc[1]);                     // Q: B
  await page.tap('#tabs [data-tab="readings"]');
  await sleep(150);
  txt = await page.locator('#tab-readings').innerText();
  check('Flow 2: modus ponens A(A(B)) ⊨ B at 0, 1 and ∞', /A\(A\(B\)\)/.test(txt) && /P entails Q at all three points/.test(txt));
  await page.screenshot({ path: path.join(SHOTS, '07-flow2-entails.png') });
  await page.tap('#letters [data-letter="C"]');
  await tap(dc[0] + 120, dc[1] + 60);          // Q: B and C — no longer follows
  await sleep(150);
  txt = await page.locator('#tab-readings').innerText();
  check('Flow 2: a failing entailment shows ✗ and a counter-valuation', /does not entail Q at 0, 1, ∞/.test(txt) && /C false makes P true and Q false/.test(txt));
  await page.screenshot({ path: path.join(SHOTS, '08-flow2-counter.png') });
  // tap a marked point to pin its reading
  await tap(...(await center('#base .mk1')));
  txt = await page.locator('#cards').innerText();
  check('Tap a marked point pins its reading', /reading at 1/i.test(txt), txt.replace(/\n/g, ' | '));

  // ---- Flow 3: relabel ----
  await page.tap('#pageSel [data-page="P"]');
  await page.tap('#modes [data-mode="cut"]');
  await page.tap('#tabs [data-tab="dessin"]');
  const before = await page.evaluate(() => ({ lab: window.BookOfSheets.state().lab.join(), pass: document.querySelector('#dessinInfo').innerText }));
  const drawBefore = await page.evaluate(() => JSON.stringify(window.BookOfSheets.state().pages));
  await page.tap('#relabel [data-pi="1,0,2"]');
  await sleep(150);
  const after = await page.evaluate(() => ({ lab: window.BookOfSheets.state().lab.join(), pass: document.querySelector('#dessinInfo').innerText }));
  const drawAfter = await page.evaluate(() => JSON.stringify(window.BookOfSheets.state().pages));
  const label0 = await page.locator('#base .mk-label').first().textContent();
  check('Flow 3: swap 0↔1 moves the badges, updates passport, leaves the drawing', after.lab === '1,0,2' && label0 === '1' && /\[2,2\] \/ \[4\] \/ \[4\]/.test(after.pass) && drawAfter === drawBefore, `labels ${before.lab} → ${after.lab}`);
  await page.screenshot({ path: path.join(SHOTS, '09-flow3-relabel.png') });
  await page.tap('#relabel [data-pi="1,0,2"]');

  // ---- Flow 4: type a dessin ----
  await page.fill('#in0', '(1 2 3)(4 5)');
  await page.fill('#in1', '(1 4)(2 5 3)');
  await page.tap('#tripleForm button[type="submit"]');
  await sleep(150);
  txt = await page.locator('#dessinInfo').innerText();
  check('Flow 4: a typed triple loads', /N = 5/.test(txt) && /typed dessin/i.test(txt), txt.split('\n').slice(0, 4).join(' | '));
  await page.fill('#in0', '(1 2)');
  await page.fill('#in1', '(3 4)');
  await page.tap('#tripleForm button[type="submit"]');
  await sleep(100);
  const err = await page.locator('#tripleErr').innerText();
  check('Flow 4: an intransitive pair is refused', /disconnected/.test(err), err);
  await page.screenshot({ path: path.join(SHOTS, '10-flow4-typed.png') });

  // ---- T13: reload restores; export then import is identical ----
  const s1 = await state();
  await page.reload();
  await page.waitForSelector('#base .mk0');
  const s2 = await state();
  check('T13: reload restores the session', s1 === s2);
  const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.tap('#menuBtn'); await page.tap('[data-menu="saveJson"]'); })()]);
  const file = path.join(SHOTS, '..', 'session-export.json');
  await dl.saveAs(file);
  await page.tap('#menuBtn');
  await page.tap('[data-menu="clearPage"]');
  await page.locator('#fileIn').setInputFiles(file);
  await sleep(300);
  const s3 = await state();
  check('T13: JSON export then import gives an identical session', s3 === s2);
  fs.unlinkSync(file);
  const [png] = await Promise.all([page.waitForEvent('download'), (async () => { await page.tap('#menuBtn'); await page.tap('[data-menu="savePng"]'); })()]);
  const pngPath = path.join(SHOTS, '11-export.png');
  await png.saveAs(pngPath);
  check('PNG export produces an image', fs.statSync(pngPath).size > 5000, `${fs.statSync(pngPath).size} bytes`);

  // ---- Grid timing at N = 24 ----
  await page.tap('#tabs [data-tab="dessin"]');
  await page.fill('#in0', '(1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24)');
  await page.fill('#in1', '(1 13)(2 14)(3 15)(4 16)(5 17)(6 18)(7 19)(8 20)(9 21)(10 22)(11 23)(12 24)');
  await page.tap('#tripleForm button[type="submit"]');
  await page.tap('#tabs [data-tab="sheets"]');
  await sleep(200);
  const gridMs = await page.evaluate(() => window.BookOfSheets.ui.timing.grid);
  check('24-sheet grid draws (target under 50 ms on the tablet)', gridMs < 50, `${gridMs.toFixed(1)} ms here`);
  await page.screenshot({ path: path.join(SHOTS, '12-sheets-24.png') });

  // ---- Dark theme and a narrow phone width ----
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.tap('#tabs [data-tab="readings"]');
  await sleep(150);
  await page.screenshot({ path: path.join(SHOTS, '13-dark.png') });
  await page.setViewportSize({ width: 400, height: 860 });
  await sleep(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('No horizontal scroll at 400 px', overflow <= 0, `overflow ${overflow}px`);
  await page.screenshot({ path: path.join(SHOTS, '14-phone.png'), fullPage: true });

  check('No console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} headless checks pass`);
  process.exit(failed.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
