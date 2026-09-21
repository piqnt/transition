import { test } from "node:test";
import assert from "node:assert/strict";

import { TransitionManager, Easing } from "../src/Transition.ts";

const near = (actual: number, expected: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ""} expected ${expected} got ${actual}`);

test("interpolates numeric and nested properties, start values read on first update", () => {
  const tr = new TransitionManager();
  const s = { alpha: 0, scale: { x: 1, y: 1 } };
  tr.select(s).tween(100).to({ alpha: 1, scale: { x: 2, y: 2 } });
  s.alpha = 0.5;
  tr.update(50);
  near(s.alpha, 0.75);
  near(s.scale.x, 1.5);
  tr.update(50);
  near(s.alpha, 1);
  near(s.scale.y, 2);
  assert.equal(tr._list.length, 0, "removed when ended");
});

test("delay, start values are read after delay", () => {
  const tr = new TransitionManager();
  const s = { x: 0 };
  tr.select(s).tween(100, 50).to({ x: 10 });
  tr.update(25);
  near(s.x, 0);
  s.x = 4;
  tr.update(25);
  near(s.x, 4);
  tr.update(50);
  near(s.x, 7);
  tr.update(50);
  near(s.x, 10);
});

test("easing", () => {
  const tr = new TransitionManager();
  const s = { x: 0 };
  tr.select(s).tween(100).to({ x: 1 }).ease(Easing.quadIn);
  tr.update(50);
  near(s.x, 0.25);
});

test("chained transitions carry over extra time and apply in the same update", () => {
  const tr = new TransitionManager();
  const s = { x: 0 };
  const log: string[] = [];
  tr.select(s).tween(100)
    .to({ x: 10 })
    .done(() => log.push("a"))
    .tween(100)
    .to({ x: 20 })
    .done(() => log.push("b"));
  tr.update(130);
  near(s.x, 13);
  assert.deepEqual(log, ["a"]);
  tr.update(20);
  near(s.x, 15);
  tr.update(50);
  near(s.x, 20);
  assert.deepEqual(log, ["a", "b"]);
});

test("concurrent transitions on the same target with different properties", () => {
  const tr = new TransitionManager();
  const s = { x: 0, y: 0 };
  tr.select(s).tween(100).to({ x: 10 });
  tr.select(s).tween(200).to({ y: 10 });
  tr.update(100);
  near(s.x, 10);
  near(s.y, 5);
  assert.equal(tr._list.length, 1);
});

test("a starting transition takes over conflicting properties from current value", () => {
  const tr = new TransitionManager();
  const s = { x: 0, y: 0 };
  let doneA = false;
  tr.select(s).tween(100)
    .to({ x: 10, y: 10 })
    .done(() => (doneA = true));
  tr.update(50);
  tr.select(s).tween(100).to({ x: 0 });
  tr.update(50);
  near(s.x, 2.5, "x taken over from 5");
  near(s.y, 10, "y continues");
  assert.equal(doneA, true, "first still completes for y");
  tr.update(50);
  near(s.x, 0);
});

test("a fully taken over transition is dropped with its chain, without done", () => {
  const tr = new TransitionManager();
  const s = { x: 0 };
  const log: string[] = [];
  tr.select(s).tween(100)
    .to({ x: 10 })
    .done(() => log.push("a"))
    .tween(100)
    .to({ x: 20 })
    .done(() => log.push("a2"));
  tr.update(50);
  tr.select(s).tween(100)
    .to({ x: 0 })
    .done(() => log.push("b"));
  tr.update(100);
  near(s.x, 0);
  assert.deepEqual(log, ["b"]);
  assert.equal(tr._list.length, 0);
});

test("stop transition, stop by target, stop all", () => {
  const tr = new TransitionManager();
  const s = { x: 0 };
  const u = { x: 0 };
  let done = 0;
  const t = tr.select(s).tween(100).to({ x: 10 }).done(() => done++);
  tr.select(u).tween(100).to({ x: 10 }).done(() => done++);
  tr.update(50);
  t.stop();
  tr.update(50);
  near(s.x, 5);
  near(u.x, 10);
  assert.equal(done, 1);

  tr.select(s).tween(100).to({ x: 10 });
  tr.select(u).tween(100).to({ x: 20 });
  tr.select(s).stop();
  tr.update(100);
  near(s.x, 5);
  near(u.x, 20);

  tr.select(u).tween(100).to({ x: 0 });
  tr.stop();
  tr.update(100);
  near(u.x, 20);
});

test("non-numeric property is dropped with a warning, zero duration ends immediately, done errors are caught", () => {
  const tr = new TransitionManager();
  const s = { x: 0, name: "a" as any };
  const warn = console.warn;
  const error = console.error;
  let warned = 0;
  let errored = 0;
  console.warn = () => warned++;
  console.error = () => errored++;
  try {
    tr.select(s).tween(0)
      .to({ x: 1, name: 2 })
      .done(() => {
        throw new Error("boom");
      })
      .tween(10)
      .to({ x: 5 });
    tr.update(0);
    near(s.x, 1);
    assert.equal(warned, 1);
    assert.equal(errored, 1);
    tr.update(10);
    near(s.x, 5);
  } finally {
    console.warn = warn;
    console.error = error;
  }
});

test("calling to() again replaces the same property", () => {
  const tr = new TransitionManager();
  const s = { x: 0 };
  tr.select(s).tween(100).to({ x: 10 }).to({ x: 20 });
  tr.update(100);
  near(s.x, 20);
});
