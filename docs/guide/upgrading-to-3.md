# Upgrading to 3.0.0

3.0.0 changes one function: `trackVueReactiveEvents`, the Vue 3 tracker. It now gives every object in the state its own small Vue effect, so a write costs what it changed. In 2.x one effect walked everything under a root key on every write, and every `resume()` copied and walked the whole state again. The events stay the same as 2.0.0's: a fuzz of 300,000 random edits compares the two trackers. The core (`reactive`, `updateState`, `watch` and the rest) did not change.

## Migrating from 2.x

1. **Use Vue 3.5.** The peers are now `vue ^3.5.0` and `@vue/reactivity ^3.5.0`. The tracker builds on Vue 3.5's effects.

2. **Have one copy of `@vue/reactivity`.** The library imports `@vue/reactivity` and no longer bundles its own copy. The peer is optional, so the library uses the copy `vue` installs. With an isolated layout (pnpm, `bun install --linker isolated`) add it as a direct dependency at the version `vue` uses. With Vite, set `resolve.dedupe: ['vue', '@vue/reactivity']`.

3. **Pass the object `reactive()` returned.** Creation now throws a `TypeError` for a plain object, and for a proxy made by another copy of `@vue/reactivity`. 2.x accepted both and sent nothing.

4. **Do not restart a stopped tracker.** `stop()` is final. In 2.x, `resume()` after `stop()` started tracking again. Now `pause()` and `resume()` after `stop()` print a warning and do nothing. Make a new tracker instead.

## What else changed

- **`pause()` and `resume()` are free.** Writes made while paused still update the tracker's copy, so they are never sent, as before. `resume()` no longer copies the state.
- **A listener that throws no longer cuts the change short.** The tracker reports the error to `onDiffError` and sends the rest of that write's events. 2.x dropped them and rebuilt its copy. A getter that throws while the tracker reads the state still rebuilds that one object's copy without events, then reports.
- **A write made during a compare is sent.** When the listener, or a sync watcher it sets off, writes to the object being compared, the tracker compares that object once more and sends the write. 2.x dropped it until the next `resume()`.
- **`NaN` is sent once.** 2.x sent every `NaN` value again on every write under its root key and at every `resume()`.
- **A Map value that changes between a Map, a Set, a `Date` and a plain object is sent.** 2.x took them for equal when they had no own keys and missed the change.
- **Some writes are seen later.** A write to a raw object, to the inside of a `markRaw` or frozen object, or a `Date` changed in place triggers nothing in Vue. The tracker now sees it the next time the object that holds it changes. 2.x saw it at the next write anywhere under the same root key, and at every `resume()`.
- **`onDiffError` names the event.** For a listener error, `path` is the event's path, as in 2.x. `key` is `''` when the failure is in the root object itself.
- **Event objects are plain.** Objects in `set` and `delete` events have no class prototype and no symbol keys. 2.x copied both into added values. Map and Set events are as before.
- **No bundled Vue.** 2.x bundled a second copy of `@vue/reactivity`, so its `pauseTracking()` calls did nothing.
