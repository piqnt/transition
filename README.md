# Transition.js

Minimal transition (tween) library, with no dependencies.

- Transitions numeric properties of any object, including nested objects (e.g. `{ alpha: 1, scale: { x: 2, y: 2 } }`).
- Start values are read from the target when the transition starts, after delay.
- Transitions are stepped with a time delta, there is no internal clock, so it fits any game loop.
- Transitions on the same target run concurrently. When a transition starts, it takes over the properties it changes from other running transitions on the same target.
- Chain sequential transitions with `.tween()` on a transition.

```sh
npm install @piqnt/transition
```

```ts
import { TransitionManager, Easing } from "@piqnt/transition";

const manager = new TransitionManager();

manager
  .select(sprite)
  .tween(200)
  .to({ alpha: 1, scale: { x: 1.2, y: 1.2 } })
  .ease(Easing.quadOut)
  .tween(300)
  .to({ alpha: 0 })
  .done(() => sprite.destroy());

// in your game loop, dt in milliseconds
manager.update(dt);
```

### API

- `new TransitionManager()` — creates, manages and steps transitions.
- `manager.select(target)` — select a target to create or stop transitions on it.
- `manager.update(dt)` — step all transitions.
- `manager.stop()` — stop all transitions.
- `selection.tween(duration?, delay?)` / `selection.tween({ duration, delay, easing })` — create and start a transition on the selected target.
- `selection.stop()` — stop all transitions on the selected target.
- `transition.to(values)` — set end values.
- `transition.duration(ms)`, `.delay(ms)`, `.ease(fn)` — options.
- `transition.done(fn)` — called when the transition ends (not when stopped or taken over).
- `transition.tween(duration?, delay?)` — create a transition on the same target which starts when this one ends.
- `transition.stop()` — stop this transition and the ones chained after it.
- `Easing` — `linear`, `quadIn/Out/InOut`, `cubicIn/Out/InOut`, `expIn/Out`, `backOut`; any `(t: number) => number` works.

### Development

```sh
npm install
npm test
npm run build
```
