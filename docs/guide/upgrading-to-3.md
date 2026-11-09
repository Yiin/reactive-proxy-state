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
- **A write made during a compare is sent once.** When the listener, or a sync watcher it sets off, writes to an entry of the object whose event it received, the tracker compares that object once more and sends the write. 2.x dropped it until the next `resume()`. The second compare runs once: a write made during it changes the state, but the tracker sends it only with the next change to that object, and with a wrong `oldValue`. Any other write, for example into a child or a sibling object, must leave the listener through a microtask (`queueMicrotask`). Made inside the listener, it can send an event twice, the first one with a wrong `oldValue`.
- **`NaN` is sent once.** 2.x sent every `NaN` value again on every write under its root key and at every `resume()`.
- **A Map value that changes between a Map, a Set, a `Date` and a plain object is sent.** 2.x took them for equal when they had no own keys and missed the change.
- **Some writes are seen later.** A write to a raw object, to the inside of a `markRaw` or frozen object, or a `Date` changed in place triggers nothing in Vue. The tracker now sees it the next time the object that holds it changes. 2.x saw it at the next write anywhere under the same root key, and at every `resume()`.
- **`onDiffError` names the event.** For a listener error, `path` is the event's path, as in 2.x. `key` is `''` when the failure is in the root object itself.
- **Event objects are plain.** Objects in `set` and `delete` events have no class prototype and no symbol keys. 2.x copied both into added values. Map and Set events are as before.
- **No bundled Vue.** 2.x bundled a second copy of `@vue/reactivity`, so its `pauseTracking()` calls did nothing.

## 3.0.1: array iteration gives proxies

In 3.0.0 and earlier, iterating an array proxy gave its raw items. A write through an item taken by `for...of`, spread, `Array.from`, destructuring, `values()` or `entries()` changed the object and sent no event, so replicas missed it. From 3.0.1, iteration gives what an index read gives: the item's proxy, which emits at the index the item holds when you write, also after a `splice` moved it.

- **`findLast` gives a proxy**, like `find` and `at`.
- **`indexOf`, `lastIndexOf` and `includes` find a proxy** where its raw object is. In 3.0.0, `list.indexOf(list[1])` was `-1`.
- **Effects that use `find`, `findLast`, `at`, `indexOf`, `lastIndexOf` or `includes` rerun on a push, a splice or a reorder.** 3.0.0 tracked these only on the first read of the method from the proxy. An effect that iterates also reruns when an item's property or an index it read changes.
- **Callbacks and copies still give raw items.** `forEach`, `map`, `filter`, `flatMap`, `reduce`, `some`, `every` and the `find` predicate receive raw items, and `slice`, `concat`, `filter` and `toSorted` return them. A write through those still sends nothing. Take the item by an index read, `find` or iteration before you write.

What to check when you upgrade:

- **Iterated objects, and the objects you read from them, are now proxies.** `structuredClone` throws on a proxy: pass it through `deepToRaw` first, as you would for an index read. A raw item from a callback or `slice` is not `===` to the proxy of the same object: `job.history[0]` of an iterated `job` is not one of the entries that `jobs.flatMap((job) => job.history)` gives. Compare `toRaw()` of both, or compare by a field such as an id.
- **Iteration costs what an index read costs.** Measured on an idle arm64 host with Node 26, 400 objects: a `for...of` that reads one property of each item takes 18.4 µs (2.6 µs in 3.0.0, which skipped the proxies); an index loop over the same proxy takes 81 µs. A first loop makes each item's proxy, as a first index read does, and keeps about 800 bytes per item while the item stays in the state. A loop that only reads a long list can iterate `toRaw(list)` to skip the proxies; writes through those items send nothing.

## 3.0.2: effects rerun after every array, Map and Set write

In 3.0.1 and earlier, many writes did not rerun the effects that read what they changed. From 3.0.2 an effect reruns once after each write that changes what it read:

- **Readers of all items of an array rerun after an index write, an index delete and a length change.** That covers `map`, `filter`, `forEach`, `some`, `every`, `reduce`, `join`, `indexOf`, `includes`, `find`, `at` and loops. In 3.0.1, `watchEffect(() => ids = state.list.map((item) => item.id))` stayed stale after `state.list[0] = { id: 9 }`.
- **`slice`, `concat`, `flat`, `flatMap`, `findLastIndex`, `toReversed`, `toSorted`, `toSpliced`, `with`, `keys()` and `toString` are tracked.** In 3.0.1 an effect that used them never reran.
- **Index reads rerun when a method moves their index.** `shift`, `unshift`, `splice`, `pop`, `sort`, `reverse`, `fill` and `copyWithin` rerun an effect that read `list[0]` when they change what `list[0]` holds, and only then. A shorter `length` reruns readers of the indexes it removed. A write past the end reruns readers of `length`.
- **An effect that reads an array's items and its length runs once per write.** In 3.0.1, `push`, `pop`, `shift`, `unshift` and `splice` ran it twice. The same goes for a Map or Set effect that reads entries and `size`.
- **Map and Set readers rerun on every entry write.** A `set` of a key the map holds reruns `values()`, `entries()`, `forEach` and loops. A `set` of a new key reruns `get` and `has` of that key. `clear()` reruns `get` and `has`. `has` tracks its entry on every call; in 3.0.1 only the first read of `has` from the proxy tracked anything.
- **`map.set(key, undefined)` of a new key adds the key and sends a `map-set` event.** 3.0.1 took it for a no-op.
- **Array, Map and Set proxies answer like their targets.** `` `${list}` `` and `list.toString()` give the items (3.0.1 gave `"[object Array]"`), `list.constructor` is `Array`, and `map.constructor` is `Map`. 3.0.1 found these names on `Object.prototype`.

What to check when you upgrade:

- **Effects over arrays, Maps and Sets rerun more often**, each time what they read changed.
- **`onTrigger` fires once per key that changed.** An effect that read both `list[0]` and `list.map(...)` gets two `onTrigger` calls for `list[0] = x`, and runs once.
- **Still not tracked:** `in`, `Object.keys`, `Object.entries` and `for...in` on arrays and plain objects, and reads inside array callbacks of the raw items they receive. See the README section "Collections".

## 3.0.3: computed values are fresh, and effects run once per write

- **A write marks every computed value it changes as stale before any effect runs.** In 3.0.2, an effect that read `a[0]` and a computed of a computed of `a` saw `[2, 4]`, then `[2, 8]`, after `a[0] = 2`, and an effect that wrote their sum to the state sent the stale sum to replicas first.
- **An effect that waits to run is not queued again.** Two writes in one flush run it once, after both. In 3.0.2, an effect triggered by a write and then by an effect that wrote ran twice.
- **An effect that throws no longer stops the effects after it.** They all run, then the write throws the first error. A listener that throws while it receives an event no longer stops the effects of that write either.
- **A method tracks when it runs.** `const slice = list.slice` or `const values = map.values` taken before an effect tracks inside it. Mutators no longer track the length the first time they are read.
- **Map and Set entries are tracked by the entry itself.** `m.set("get", 1)` no longer reruns an effect that read only `m.get("a")`, and `1` and `"1"` are two entries.
- **`shift`, `unshift` and `splice` rerun an index read only when that index holds another value.** `[1, 1, 2].shift()` no longer reruns an effect that read `a[0]`. A splice that puts back what it took reruns nothing.
- **A key added to or deleted from a plain object reruns every effect that read a key of it.** `JSON.stringify(state.obj)`, spread, `Object.entries` and a deep `watch` follow added keys, also of an empty object.
- **Set methods are tracked:** `union`, `intersection`, `difference`, `symmetricDifference`, `isSubsetOf`, `isSupersetOf` and `isDisjointFrom`.
- **Dependency sets go when their last effect stops.** An effect that read 10,000 changing Map keys and stopped kept 10,000 empty sets in 3.0.2.

Replicas receive the same events as in 3.0.2 for every write.

What to check when you upgrade:

- **Effects that read one key of an object also rerun when a key is added to or deleted from it.**
- **A loop of effects that each write a new value throws a `RangeError` after 100,000 runs of one effect in one write.** 3.0.2 ran out of stack after about 7,000 rounds under Node.
- **`onTrack` and `onTrigger` give the entry itself as `key`** for `get` and `has` of a Map or Set (3.0.2 gave a string). Their `key` type is `unknown`.

## 3.0.4: listeners see fresh state and insertions send events

Each write now invalidates computed values and cached array methods before it calls listeners.
A listener can write again. That nested write delivers its events, then runs waiting effects in source order.
An effect already waiting runs once. A later write can queue it again after it runs.
Array moves determine changed indexes before listeners can change the array again.
Debug `onTrigger` hooks run after event delivery and before effects.
A hook that throws cannot prevent event delivery or stop the remaining effects.

Saved array, Map, and Set iterators track each step inside an effect.
This includes array `keys()` and the first step that reaches the end.
An exhausted iterator stays exhausted. Its next run removes its dependencies.

Dependency cleanup uses weak owner links.
Keeping one effect handle no longer keeps discarded state alive through other effects on that state.

Two writes now send events that older versions dropped:

- Assigning `undefined` to a missing object key creates that key and sends a `set` event.
- Map `getOrInsert` and `getOrInsertComputed` send `map-set` when they insert a key.
  Existing keys keep their values. Returned objects are reactive.

These events are intended changes for replicas. Other recorded write events match 3.0.3.

## 3.0.5: replicas stay equal when a listener writes

A listener that writes state while it receives an event, for example a version stamp before it forwards the event, now keeps its replica equal to the source:

- **Effects run when the outermost write ends.** A write that a listener makes belongs to the write whose event it receives. In 3.0.4 that nested write ran every waiting effect before it returned, including the effects of the outer write, so their events reached the replica before the event that set them off, and an effect error threw out of the listener before it forwarded. Computed values are still marked stale before listeners run.
- **A listener's write waits for the events still being delivered.** While a write delivers several events (the other places of an alias, the new indexes of a longer `length`), a write a listener makes goes after them, and the delivery sends it after the listener returns. 3.0.4 and earlier sent the waiting events from inside the listener's write, so a listener that had not forwarded its event yet sent later writes to its replica first.
- **Writing an inherited object value adds the key.** `state.o.obj = { k: 1 }`, where `o` inherits an equal `obj`, sends a `set` event and makes `obj` an own key, as an inherited primitive did in 3.0.4.
- **Map proxies have `getOrInsert` and `getOrInsertComputed` only where the Map has them.**

Events of single writes are the same as in 3.0.4. A listener that writes gets the events 3.0.3 sent, except in the two cases above where 3.0.3 sent the effect's or the later write's event first.

What to check when you upgrade:

- **A listener no longer sees an effect's result right after its own write.** It sees it after the write it received returns. 3.0.3 ran the effects of the listener's write inside the listener.
- **A listener that catches errors of its own writes.** A listener's write no longer throws an effect's error: the outer write throws it after its effects ran. While several events are delivered, the listener's write throws no listener's error either; the outer write throws the first one after every event was delivered.
- **A mute scope around a listener's write** drops that write's events only when nothing waits. Move the write out of the listener (`queueMicrotask`) to mute it every time.

