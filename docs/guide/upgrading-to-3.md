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

## 3.0.6: replicas stay equal when a listener writes

3.0.5 was tagged, but its release stopped before it published anything. 3.0.6 is the same code with that release check fixed.

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



## 3.0.7: listener loops stop and queued old values stay stable

3.0.7 bounds listener writes, so a listener that writes for each event it receives stops.
Its bound counted every listener write of a caller write, and threw on finite fan-out.
3.0.8 counts how deep listener writes nest instead (see below).
A refused write throws before mutation.
The library drains committed events and waiting effects, then throws a `RangeError`.
Catching the refused write inside the listener does not hide the final error.

Replace temporary reentry guards with event-path filters.
A queued event can arrive after a temporary guard has cleared.
Filter every path that the listener itself writes:

```ts
const state = reactive({ count: 0, version: 0 }, event => {
	forward(event);
	if (event.path.length === 0 || event.path[0] === "version") return;
	state.version++;
});
```

If the listener must write before forwarding, forward from a `finally` block.
A refused write throws inside the callback, like other invalid writes.

Queued events snapshot removed payloads before mutation.
This covers `oldValue`, `oldValues`, and the removed `value` of `set-delete`.
A retained object changed before delivery no longer changes these payloads.
Snapshots obey the existing copy limit, so an oversized queued removal can fail before mutation.
Immediate single-path removals keep their existing behavior.

Listener reads no longer become dependencies of the effect whose write called the listener.
This includes initial events, queued events, and listener errors.
Effects and computed values created or evaluated inside listeners still track their own reads.


## 3.0.8: the listener bound counts depth

3.0.7 has a regression, and 3.0.8 fixes it. Upgrade from 3.0.7 directly.
The 3.0.7 bound counted every listener write of one caller write, not how deep they nested.
Finite writes that 3.0.6 handled threw a `RangeError` in 3.0.7:

- a `length` grow past 100 indexes, with a listener that stamps every event,
- a write into an object aliased at more than 100 places,
- one effect that writes more than 100 items, or more than 100 effects that each write once in one flush,
- the same writes on an `{ async: true }` root, where the error left the delivery microtask uncaught and ended a Node process.

3.0.7 also kept the count of a `ref` or `computed` write that ran effects.
After 100 such writes, every later write threw, also a write no listener reacts to.

In 3.0.8 the bound counts generations.
A write made outside a listener sends events of generation 0.
A write a listener makes while it receives an event of generation `g` sends events of generation `g + 1`.
A queued event keeps its generation, also across roots and async microtasks.
A listener write of generation 101 is refused before mutation.
Rounds of generation 2 and deeper also count toward a total of 100,000 per operation.
That total stops loops that branch, where every event makes two listener writes.
An operation is one write, ref write or trigger made outside listeners, with its delivery and its effects.
On an async root, an operation is one delivery microtask.
Every operation starts fresh, so an error never carries over to a later write.
Loops through effects stay bounded by the effect loop limit of 100,000 runs.
The events of every write that 3.0.6 handled without a loop are byte-equal to 3.0.6, apart from the 3.0.7 changes above.

What to check when you upgrade:

- **The error message changed.** The `RangeError` says `refused a listener write nested 101 deep`, or `refused a listener write after 100000 nested rounds`. 3.0.7 said `listeners exceeded 100 nested write rounds`.
- **An async root logs the bound's error.** It calls `console.error` with the `RangeError` after the microtask delivered every queued event, and does not throw. A listener's own error is still thrown from the microtask, as in 3.0.6.
- **The bound's error wins.** When an effect or a listener also threw in the same operation, the caller gets the `RangeError`.
- **A temporary reentry guard around a listener write** stops at a depth of 100 per queued chain, not after 100 writes in total. Use event-path filters, as shown above.
- **Removed values on async roots show the state before the write.** Since 3.0.7, a queued event copies its `oldValue` and `oldValues` before the write. A removed object that reaches the written container, through a cycle, holds that container as it was before the write. 3.0.6 copied it with the write applied on async roots. A synchronous root that queues the event (an alias, a write during a delivery) copies it the same way. An immediate synchronous event still sends the removed object itself.

## 3.0.9: refused writes stay refused, and Map effects track their reads

After the listener bound refuses a write, every later listener write in that operation is refused.
This includes every listener still running, even one that did not see the error.
An inner listener can catch the error before a parent receives it.
That parent still loses its later writes.
In 3.0.8, active parents could still write while the nested calls returned.
The next operation starts with a fresh bound.

Map `has(key)` tracks membership only, and `keys()` tracks the ordered keys.
Changing the value at an existing key reruns neither reader.
Map `get(key)`, `values()`, `entries()`, `forEach` and default iteration still track values.
Adding or deleting a key, or clearing a nonempty Map, reruns the affected readers once.
In 3.0.8, value updates also reran `has` and `keys()` readers.
Value updates also leave their `onTrigger` hooks idle.
Reader order follows trigger order in nested writes.
A value update followed by a key deletion queues value readers before membership and keys readers.

## 3.0.12: methods follow defineProperty

An array proxy now handles `Object.defineProperty`.
A define with a value works like the same write with `=`: it sends the same event and reruns the same effects.
In 3.0.11 it sent nothing, and a method read before the define hid the defined one: `list.map()` still ran `Array.prototype.map`.
A define of an accessor reruns the effects that read the key, and sends no event.
A define of flags alone on a key the array has, as `Object.freeze` makes for each key, changes no value: it reruns nothing and sends nothing.
3.0.13 corrects two cases of this release, see below.

A Map or Set proxy reads a property defined through it, with `Object.defineProperty` or `=`, in place of its method, also after the proxy read the method.
In 3.0.11, `set.add = fn` left `set.add()` adding values.

The proxies cache only the methods of `Array.prototype`, `Map.prototype` and `Set.prototype`.
A function added to `Object.prototype` is read again each time, so its removal is seen.
A proxy that read a built-in method keeps it: a later replacement on the prototype does not change what that proxy gives.

Every other write made on the proxy itself sends the same events as in 3.0.11.
Writes through another receiver do not: 3.0.13 fixes them.

## 3.0.13: writes through another receiver send each event once

3.0.12 sends every event twice for a write to an array that reaches the proxy through another receiver.
Such a write also reruns each effect twice.
Examples are an outer proxy (`new Proxy(state.list, {})[0] = 9`) and `Reflect.set(state.list, 0, 9, outer)`.
3.0.13 sends each event once and reruns each effect once, as for the same write on the proxy.
If you use 3.0.12 with a logging or read-only wrapper around state arrays, upgrade.

A write with a receiver that does not forward to the array, such as a plain object or an object made with `Object.create(state.list)`, lands on that receiver, as on a plain array.
The array does not change, so 3.0.13 sends nothing and reruns nothing.
3.0.11 and 3.0.12 sent an event for that write, and a replica then held a value the array did not hold.
An outer proxy's own `defineProperty` trap decides the write: one that refuses it leaves the array as it was.

`Object.defineProperty` with flags alone on a key the array does not have creates the key with the value `undefined`.
3.0.13 handles it as the write of `undefined`: it sends that event and reruns the effects that read the key, and the length for a new index.
3.0.12 sent nothing, so a replica stayed shorter than the array.
The same holds when `writable` alone makes an own accessor a data property.

A setter on the array's prototype chain, such as a setter of an `Array` subclass, now runs with the proxy as `this`, as an own setter does.
Its writes send their events, and the write of the setter's own key sends none.
3.0.12 ran it on the raw array, so its writes sent nothing.
3.0.11 also sent the setter's key as a value.

A getter defined through the proxy over a function the proxy read before runs once per read, not twice.

## 3.0.14: a write through an inherited setter reruns the readers of its key

A setter on the array's prototype chain, such as a setter of an `Array` subclass, can keep its value where no proxy sees it, such as a closure.
3.0.13 did not rerun the effects that read the key through its getter, unless the setter wrote through the proxy.
3.0.14 reruns them after the setter runs, as 3.0.11 and 3.0.12 did.
It still sends no event for the key.
The setter's own writes and the rerun make one batch: an effect that reads the key and what the setter writes runs once per write.
In 3.0.13, a setter that wrote two keys reran a reader of both twice.

A write through another receiver, such as an outer proxy, that calls a setter of the array now acts as the same write on the proxy.
When the getter already gives the value, the setter does not run.
3.0.13 ran the setter, own or inherited, for such a write, so it could send events that the direct write did not send.
For example, a setter that also writes a key its getter does not read sent that write.

`list.__proto__ = proto` runs the `__proto__` setter of `Object.prototype`.
Since 3.0.13 it changes the array's prototype and sends no event, because a replica cannot apply a prototype.
3.0.11 and 3.0.12 sent `set list.__proto__`, and a replica that applied it replaced the prototype of its array with a plain object.
The effects that read `list.__proto__` rerun.

A write with the raw array as receiver, `Reflect.set(state.list, 0, 9, toRaw(state.list))`, is a raw write.
Since 3.0.13 it changes the array and sends nothing, as a write through `toRaw()` does.
3.0.11 sent an event for it.

A value written through an outer proxy is unwrapped once, where the write lands.
3.0.13 unwrapped it twice, which walked an array value's items twice.

## 3.0.15: one rule for every setter

A setter now acts the same wherever it is: on the array or object itself, or on its prototype chain, such as a class setter.
A write through it runs the setter with the proxy as `this`, and the setter's writes send their events.
The write of the setter's key sends no event.
The setter's writes and the rerun of the effects that read its key make one batch.

An own setter now reruns the effects that read its key.
3.0.14 did not, so an effect that read an own accessor backed by a closure kept the old value.
An effect that read two keys an own setter wrote ran twice per write in 3.0.14; it now runs once.

A setter on an object's prototype chain no longer sends `set` of its key.
3.0.14 sent it after the setter's own events, and a replica stored the value as a data key that the object does not have.
3.0.14 also ran such a setter outside a batch, so an effect that read the key and a key the setter wrote ran twice per write.
If your state holds class instances with setters, their replicas now hold only the keys the setters write.

A write whose value the getter already gives runs no setter, on arrays and objects.
3.0.14 ran a setter on an object's prototype chain for such a write.
A setter with no getter runs on every write.
3.0.14 skipped a write of `undefined` to it.

`obj.__proto__ = proto` changes the object's prototype and sends nothing, as on arrays since 3.0.13.
3.0.14 sent `set obj.__proto__`.

A write to an object through a receiver that does not forward to the proxy now lands on that receiver, as on arrays since 3.0.13.
A write to `Object.create(state.obj)` changes that new object and sends nothing.
3.0.14 sent an event for it, and a replica got a key the object did not have.
The raw object as receiver, `Reflect.set(state.obj, "a", 1, toRaw(state.obj))`, is a raw write: it changes the object and sends nothing.
3.0.14 sent an event for it.

A setter reached through such a receiver, on an array or an object, runs with that receiver as `this`, as on a plain array or object.
It runs also when its getter already gives the value, and its writes land on that receiver.
The effects that read its key rerun when the getter gives another value afterwards, for example when the setter changes a closure.
3.0.14 skipped the setter when the getter gave the value, and reran those effects after every such write to an array.

## 3.0.16: object writes from any receiver

An object proxy now has a `defineProperty` trap, as array proxies have since 3.0.13.
`Object.defineProperty(state.obj, "a", { value: 1 })` is sent like `state.obj.a = 1`, and the effects that read `a` rerun.
Flags alone on a key the object does not have are sent like a write of `undefined`.
3.0.15 and earlier changed the object and sent nothing, so a replica missed the value.
An accessor defined through the proxy still sends nothing; the effects that read its key now rerun.

A write through an outer proxy whose traps answer for the proxy, such as a membrane's `getPrototypeOf` or `getOwnPropertyDescriptor`, is now sent once, like the same write on the proxy.
3.0.15 changed the object and sent nothing when the outer proxy had a `getPrototypeOf` trap.
A setter reached through such an outer proxy follows the rule for the proxy itself: it skips a value its getter already gives.

Another proxy of the state as receiver, `Reflect.set(state.a, "x", 1, state.b)`, now gets the write and sends `set b.x`.
3.0.15 put `x` on the raw `b` and sent nothing; 3.0.14 sent `set a.x`.

An object proxy remembers an outer proxy for each own key whose write through it landed, and writes that key directly from then on.
Such a write costs less than in 3.0.14.
An outer proxy whose `defineProperty` or `getOwnPropertyDescriptor` trap later answers differently for that key is outside the supported input; its `set` trap still runs on every write.

## 3.0.17: hidden keys stay hidden

A replica holds the enumerable keys alone, as JSON and spread do.
A define that keeps or makes a key hidden now writes it and reruns the effects that read it, and sends nothing.
3.0.16 sent `set` for it, so the replica got a key the state hides.
`markRaw(state.obj)` sent `set obj.__v_skip true`; now it sends nothing.
`Object.defineProperty(state.obj, "a", { value: 1 })` on a new key makes a hidden key, as natively, and sends nothing; add `enumerable: true` to send it.
A define that hides an enumerable key sends `delete`, and one that shows a hidden key sends `set`, also with flags alone.
A write by `=` and a `delete` of a hidden key send nothing; 3.0.16 sent them.
The same holds for an array's names; an index is sent whatever its flags.

An object proxy no longer remembers outer proxies.
Every trap of an outer proxy runs on every write, as on a plain object, and the 3.0.16 caveat about traps that answer differently later is gone.
A write through an outer proxy costs about what it cost in 3.0.15, and about twice what it cost in 3.0.16.
A write through a membrane costs more than in 3.0.15, which sent nothing for it.

A define that leaves a key non-configurable and read-only with a proxy as its value now returns `false` before it writes, and `Object.defineProperty` throws a `TypeError`.
3.0.16 wrote the raw object, sent the event, and then the engine threw.
A define of such a key with an equal object or with `-0` stores the defined value, as natively.

A define calls no getter: a value defined over an accessor replaces it without reading it.
3.0.16 read the old value through the getter, so a getter that threw stopped the define.

An array proxy's `set` trap takes four parameters, as an object proxy's does since 3.0.16, which makes index writes a little faster.

Every other write sends the same events as in 3.0.16.

## 3.0.18: objects under hidden keys send nothing

A write inside an object that only hidden keys hold now sends nothing, at any depth, and still reruns the effects that read it.
3.0.17 sent it with its path, and `updateState` on a replica logged a warning and skipped it.
An object that a hidden key and a visible key both hold sends each write once, on the visible path; 3.0.17 sent it once per key.
Once the key is shown again, writes inside the object are sent again.

A non-configurable, read-only define of `NaN` succeeds again, as on a plain object; 3.0.17 returned `false`.

An object with a hidden key no longer reads a property descriptor on each write; 3.0.17 did, also after the hidden key was deleted.

Every other write sends the same events as in 3.0.17.
