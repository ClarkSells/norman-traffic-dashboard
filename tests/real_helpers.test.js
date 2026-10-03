// Pure checks for the real-renderer harness helpers: node tests/real_helpers.test.js
// No browser, no network: frame stats, the viewport table, context options and the report shape.
import assert from "node:assert/strict";
import { LONG_FRAME_MS, VIEWPORTS, buildReport, contextOptions, emptyViewportReport, frameStats, median, transitionRecord } from "./e2e/real_helpers.mjs";

// median
assert.equal(median([]), 0, "empty probe has median 0");
assert.equal(median([10]), 10);
assert.equal(median([16, 20, 100]), 20, "odd count takes the middle value");
assert.equal(median([8, 16, 20, 100]), 18, "even count averages the middle pair");

// frameStats
assert.deepEqual(frameStats([]), { frames: 0, maxFrameMs: 0, medianFrameMs: 0, longFrames: 0 }, "an empty probe reads as zeros, not NaN");
const stats = frameStats([16, 16, 33, 120]);
assert.equal(stats.frames, 4);
assert.equal(stats.maxFrameMs, 120);
assert.equal(stats.medianFrameMs, 24.5, "median of 16,16,33,120 is (16+33)/2");
assert.equal(stats.longFrames, 1, `only frames over ${LONG_FRAME_MS} ms count as long`);
assert.equal(frameStats([LONG_FRAME_MS]).longFrames, 0, "a frame exactly at the threshold is not long");
assert.equal(frameStats([LONG_FRAME_MS + 1]).longFrames, 1);
assert.equal(frameStats([10, 20], { longFrameMs: 15 }).longFrames, 1, "the threshold is injectable");
assert.deepEqual(frameStats([Number.NaN, -5, 16]), { frames: 1, maxFrameMs: 16, medianFrameMs: 16, longFrames: 0 }, "garbage samples are dropped");
assert.equal(frameStats([16.678]).maxFrameMs, 16.7, "stats round to one decimal");

// transitionRecord: exactly the contract shape { scene, maxFrameMs, medianFrameMs, longFrames }
const rec = transitionRecord(3, [16, 16, 90]);
assert.deepEqual(Object.keys(rec).sort(), ["longFrames", "maxFrameMs", "medianFrameMs", "scene"], "no extra keys on a transition record");
assert.deepEqual(rec, { scene: 3, maxFrameMs: 90, medianFrameMs: 16, longFrames: 1 });

// viewport table: the three contracted viewports, names match WxH, only the last is mobile
assert.equal(VIEWPORTS.length, 3);
assert.deepEqual(VIEWPORTS.map((v) => v.name), ["1440x900", "1920x1080", "390x844"]);
for (const v of VIEWPORTS) assert.equal(v.name, `${v.width}x${v.height}`, "the name is the screenshot folder name");
assert.deepEqual(VIEWPORTS.map((v) => !!v.mobile), [false, false, true]);

// contextOptions: desktop is a plain viewport; mobile emulates a phone
assert.deepEqual(contextOptions(VIEWPORTS[0]), { viewport: { width: 1440, height: 900 } }, "desktop needs no emulation flags");
const mob = contextOptions(VIEWPORTS[2]);
assert.equal(mob.isMobile, true);
assert.equal(mob.hasTouch, true);
assert.ok(mob.deviceScaleFactor >= 2, "mobile keeps a retina scale factor");
assert.match(mob.userAgent, /Mobile/, "mobile sends a mobile user agent");
assert.deepEqual(mob.viewport, { width: 390, height: 844 });

// report shape
const report = buildReport({ mode: "smoke", sceneCount: 12, nextSceneSelector: "#tour-next" });
assert.equal(report.version, 1);
assert.equal(report.mode, "smoke");
assert.equal(report.sceneCount, 12);
assert.equal(report.nextSceneSelector, "#tour-next");
assert.ok(!Number.isNaN(Date.parse(report.generatedAt)), "generatedAt is an ISO timestamp");
assert.deepEqual(report.viewports, {}, "viewports fill in as the run progresses");
const vp = emptyViewportReport("1440x900");
assert.equal(vp.viewport, "1440x900");
assert.equal(vp.load, null, "load timings land once measured");
assert.deepEqual(vp.transitions, []);
assert.deepEqual(vp.explore, []);
assert.deepEqual(vp.consoleErrors, []);
assert.deepEqual(vp.screenshots, []);
assert.equal(vp.bytesTransferred, 0);
vp.transitions.push(rec);
report.viewports[vp.viewport] = vp;
const round = JSON.parse(JSON.stringify(report));
assert.deepEqual(round.viewports["1440x900"].transitions[0], rec, "the report survives a JSON round trip");

console.log("real_helpers checks passed");
