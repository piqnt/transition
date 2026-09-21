/*
 * Copyright (c) Ali Shakiba
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Minimal transition (tween) library, with no dependencies.
 *
 * - Transitions numeric properties of any object, including nested objects
 *   (e.g. `{ alpha: 1, scale: { x: 2, y: 2 } }`).
 * - Start values are read from the target when the transition starts, after delay.
 * - Transitions are stepped with a time delta, there is no internal clock.
 * - Transitions on the same target run concurrently. When a transition starts, it takes
 *   over the properties it changes from other running transitions on the same target.
 * - Chain sequential transitions with `.tween()` on a transition.
 *
 * Usage:
 * ```
 * // create once
 * const manager = new TransitionManager();
 * 
 * // each frame
 * manager.update(dt);
 * 
 * // apply transition
 * manager
 *   .select(sprite)
 *   .tween(200)
 *   .to({ alpha: 1, scale: { x: 1.2, y: 1.2 } })
 *   .ease(Easing.quadOut)
 *   .tween(300).to({ alpha: 0 })
 *   .done(() => sprite.destroy());
 * ```
 */

export type EasingFunction = (t: number) => number;

export interface TransitionOptions {
  duration?: number;
  delay?: number;
  easing?: EasingFunction;
}

export type TransitionValues<T> = {
  [K in keyof T]?: T[K] extends number ? number : T[K] extends object ? TransitionValues<T[K]> : never;
};

export type TransitionCallback<T> = (target: T) => void;

const DEFAULT_DURATION = 400;

/** A property of the target that is transitioned, identified by its path. */
interface Key {
  name: string;
  path: string[];
  start: number;
  end: number;
}

export class Transition<T extends object = any> {
  /** @internal */ _target: T;
  /** @internal */ _keys: Key[] = [];
  /** @internal */ _duration: number;
  /** @internal */ _delay: number;
  /** @internal */ _easing: EasingFunction | null;
  /** @internal */ _ending: TransitionCallback<T>[] = [];
  /** @internal */ _next: Transition<T> | null = null;

  /** @internal */ _time = 0;
  /** @internal */ _started = false;
  /** @internal */ _stopped = false;

  constructor(target: T, options: TransitionOptions = {}) {
    this._target = target;
    this._duration = options.duration ?? DEFAULT_DURATION;
    this._delay = options.delay ?? 0;
    this._easing = options.easing ?? null;
  }

  /** Set end values, start values are read from target when transition starts. */
  to(values: TransitionValues<T>): this {
    collectKeys(values, [], this._keys);
    return this;
  }

  duration(duration: number): this {
    this._duration = duration;
    return this;
  }

  delay(delay: number): this {
    this._delay = delay;
    return this;
  }

  ease(easing: EasingFunction): this {
    this._easing = easing;
    return this;
  }

  /** Register a callback to be called when the transition ends. Not called when stopped or taken over. */
  done(callback: TransitionCallback<T>): this {
    this._ending.push(callback);
    return this;
  }

  /** Create a transition on the same target, which starts when this one ends. */
  tween(options?: TransitionOptions): Transition<T>;
  tween(duration?: number, delay?: number): Transition<T>;
  tween(a?: TransitionOptions | number, b?: number) {
    return (this._next = new Transition(this._target, toOptions(a, b)));
  }

  /** Stop this transition and the ones chained after it, without calling done callbacks. */
  stop() {
    this._stopped = true;
  }

  /** @internal */
  _start() {
    this._started = true;
    for (let i = this._keys.length - 1; i >= 0; i--) {
      const key = this._keys[i];
      const value = getPath(this._target, key.path);
      if (typeof value === "number") {
        key.start = value;
      } else {
        console.warn("Cannot transition non-numeric property: " + key.name);
        this._keys.splice(i, 1);
      }
    }
  }

  /** @internal Apply values for current time, returns true when ended. */
  _apply() {
    const time = this._time - this._delay;
    let p = this._duration > 0 ? Math.min(time / this._duration, 1) : 1;
    const ended = p >= 1;
    if (this._easing) {
      p = this._easing(p);
    }
    for (let i = 0; i < this._keys.length; i++) {
      const key = this._keys[i];
      setPath(this._target, key.path, key.start + (key.end - key.start) * p);
    }
    return ended;
  }

  /** @internal */
  _finish() {
    for (let i = 0; i < this._ending.length; i++) {
      try {
        this._ending[i](this._target);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

/**
 * Selects a target to create or stop transitions on it.
 */
export class TransitionSelection<T extends object> {
  /** @internal */ _manager: TransitionManager;
  /** @internal */ _target: T;

  constructor(manager: TransitionManager, target: T) {
    this._manager = manager;
    this._target = target;
  }

  /** Create and start a transition on the selected target. */
  tween(options?: TransitionOptions): Transition<T>;
  tween(duration?: number, delay?: number): Transition<T>;
  tween(a?: TransitionOptions | number, b?: number) {
    const transition = new Transition<T>(this._target, toOptions(a, b));
    this._manager._list.push(transition);
    return transition;
  }

  /** Stop all transitions on the selected target. */
  stop() {
    this._manager._stop(this._target);
  }
}

/**
 * Creates, manages and steps transitions.
 */
export class TransitionManager {
  /** @internal */ _list: Transition[] = [];

  /** Select a target to create or stop transitions on it. */
  select<T extends object>(target: T) {
    return new TransitionSelection<T>(this, target);
  }

  /** Stop all transitions. */
  stop() {
    this._stop();
  }

  /** @internal Stop all transitions on the target, or all transitions if no target is given. */
  _stop(target?: object) {
    for (let i = this._list.length - 1; i >= 0; i--) {
      const transition = this._list[i];
      if (target === undefined || transition._target === target) {
        transition.stop();
        this._list.splice(i, 1);
      }
    }
  }

  /** Step all transitions by the elapsed time in milliseconds. */
  update(dt: number) {
    const list = this._list;

    // advance time and start transitions which are past their delay, before applying any of them,
    // so that a starting transition reads start values before other transitions change them
    for (let i = 0; i < list.length; i++) {
      const transition = list[i];
      if (transition._stopped) {
        list.splice(i--, 1);
        continue;
      }
      transition._time += dt;
      this._maybeStart(transition);
    }

    for (let i = 0; i < list.length; i++) {
      const transition = list[i];
      if (!transition._started) continue;

      const ended = transition._apply();
      if (!ended) continue;

      list.splice(i--, 1);
      transition._finish();

      const next = transition._next;
      if (next && !transition._stopped) {
        // carry over extra time to the next transition, it is visited later in this loop
        next._time = transition._time - transition._delay - transition._duration;
        list.push(next);
        this._maybeStart(next);
      }
    }
  }

  /** @internal */
  _maybeStart(transition: Transition) {
    if (transition._started || transition._time < transition._delay) return;
    transition._start();
    this._takeover(transition);
  }

  /**
   * Remove properties of the started transition from other running transitions on the same target.
   * TransitionManager left with no properties are dropped without calling done callbacks.
   */
  /** @internal */
  _takeover(transition: Transition) {
    const list = this._list;
    for (let i = list.length - 1; i >= 0; i--) {
      const other = list[i];
      if (other === transition || other._target !== transition._target || !other._started) continue;
      for (let j = other._keys.length - 1; j >= 0; j--) {
        if (transition._keys.some((key) => key.name === other._keys[j].name)) {
          other._keys.splice(j, 1);
        }
      }
      if (other._keys.length === 0) {
        other.stop();
        list.splice(i, 1);
      }
    }
  }
}

function toOptions(a?: TransitionOptions | number, b?: number): TransitionOptions {
  if (typeof a === "object" && a !== null) return a;
  return { duration: typeof a === "number" ? a : undefined, delay: b };
}

/** Flatten nested values into keys, replacing existing keys with the same name. */
function collectKeys(values: object, path: string[], keys: Key[]) {
  for (const name in values) {
    const value = values[name];
    const keyPath = [...path, name];
    if (typeof value === "number") {
      const keyName = keyPath.join(".");
      const index = keys.findIndex((key) => key.name === keyName);
      const key = { name: keyName, path: keyPath, start: 0, end: value };
      if (index >= 0) {
        keys[index] = key;
      } else {
        keys.push(key);
      }
    } else if (typeof value === "object" && value !== null) {
      collectKeys(value, keyPath, keys);
    }
  }
}

function getPath(target: object, path: string[]) {
  let value: any = target;
  for (let i = 0; i < path.length && value != null; i++) {
    value = value[path[i]];
  }
  return value;
}

function setPath(target: object, path: string[], value: number) {
  let object: any = target;
  for (let i = 0; i < path.length - 1; i++) {
    object = object[path[i]];
    if (object == null) return;
  }
  object[path[path.length - 1]] = value;
}

export const Easing = {
  linear: (t: number) => t,
  quadIn: (t: number) => t * t,
  quadOut: (t: number) => t * (2 - t),
  quadInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  cubicIn: (t: number) => t * t * t,
  cubicOut: (t: number) => --t * t * t + 1,
  cubicInOut: (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  backOut: (t: number) => --t * t * (2.70158 * t + 1.70158) + 1,
  expIn: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  expOut: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};
