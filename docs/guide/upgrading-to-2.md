# Upgrading to 2.0.0

2.0.0 fixes event paths. In 1.x an event could name the wrong array index after an earlier item was removed, and a replica then changed the wrong row. 2.0.0 reads each path when it makes the event, so paths follow moves, and an object stored at two places sends one event per place.

To make that hold, every payload is now a copy, and a few inputs are refused. Most apps need the steps below and nothing else.

## Migrating from 1.x

1. **Build the replica from the initial `replace` event.** `reactive(state, emit)` sends `{ action: 'replace', path: [], newValue }` first. `newValue` is a copy you may keep as your replica. 1.0.44 sent `state` itself, so a replica built from it shared objects with the source.

   ```ts
   let replica: any;
   const state = reactive(initial, (event) => {
     if (event.action === "replace" && event.path.length === 0) replica = event.newValue;
     else updateState(replica, event);
   });
   ```

2. **Do not rely on payload identity.** `newValue`, `items`, a `set-add`'s `value` and the initial state are copies. On a root with `{ async: true }`, what a write removes is a copy too. Compare payloads by content or by an id field, never with `===` against your own objects. A replica's Set members are copies as well, and so are its Map keys, except the key of a `map-set` event, which is your source object, as in 1.0.44. That key is a copy too when another key in that Map already carries its token (see Collection membership below). Change them through `updateState`, not by looking up your source objects in the replica.

3. **Catch the two new errors.** Both are thrown before anything changes, so the state, its proxies and every replica stay as they were.
   - `SnapshotLimitError`, a `RangeError`, from `reactive()` or a write whose payload would copy shared objects more than 100,000 extra times (see [Shared graphs](#shared-graphs-have-a-copy-limit)).
   - `UnsupportedStateError`, a `TypeError`, from a write the library cannot synchronize, such as a getter in a payload that reaches back into the object it is written to.

   ```ts
   try {
     state.graph = value;
   } catch (error) {
     if (error instanceof SnapshotLimitError || error instanceof UnsupportedStateError) {
       // nothing changed: store a smaller value, or rebuild the root
     } else throw error;
   }
   ```

4. **Write after the listener returns when it mutes events.** A write made inside a listener delivers the events that still wait for other places of an alias first, inside that call. A listener that drops every event while it writes (a "mute" flag around its own writes) drops those waiting events too. Move the write out of the listener, for example with `queueMicrotask(() => { state.x = 1; })`.

5. **Use 2.x `updateState` on both sides.** 2.0 events name object Set members and Map keys by an identity token. A 1.0.44 `updateState` fed 2.0 events never deletes an object Set member or Map key: its replica keeps them. Upgrade the sender and every receiver together.

6. **Run on ES2021 or later.** The library uses `WeakRef` (Node 14.6 and every current browser). Your TypeScript `lib` setting needs nothing new: the published types do not name `WeakRef`, and a 1.0.44 consumer compiles with `lib: ["es2020"]` and `skipLibCheck: false`.

7. **`reactive(proxy, emit)` returns that proxy.** 2.0 never wraps a proxy again. The second `emit` is ignored and no new `replace` is sent; the proxy keeps sending events to its own root. In 1.0.44 the call made a second proxy, and both listeners got events. A proxy of another root inside a root's initial value also sends events to its own root only.

## What else changed

| Change | Why |
| --- | --- |
| Initial state, inserted items and added Set members arrive as copies. On an async root, removed values arrive as copies too. | A listener must not change the source by updating its replica. A queued event must keep the value its write had. |
| Two places that share one object get separate copies. Cycles inside one copy stay cycles. | A shared object sends one event per place. A replica that shared objects would apply those events more than once. |
| Payloads refuse more than 100,000 extra copies of shared objects. An async removal can be refused too. | This bounds the copy work when one object sits at many places. A tree never reaches the limit. |
| Copies leave out non-enumerable own properties, except an array's length and indexes. They drop property descriptors, frozen status and markers such as `markRaw`'s flag. | Keeping them means reading descriptors across every copied graph, which slows copies and root creation. 1.0.44 sent the original objects in initial, inserted and removed payloads, so those details reached the listener then. |
| A nested synchronous write delivers waiting alias events inside the listener's call. | Events then arrive in the order the state changed (see step 4). |
| A store puts the raw object where the stored value holds a proxy, at any depth: data properties of objects, arrays and sealed objects, Map values and Set members (the Set keeps its order, and a proxy and its raw object become one member). Map keys stay as they are. A frozen object, a read-only property or a getter keeps its proxy, without an error in either bundle, and a write through that proxy still reaches every place of the object. | A proxy left in the state was wrapped again at each read. In 1.0.44 every write cycle grew a chain of proxies around it and kept replaced data alive. 1.0.44 unwrapped direct children only. |

Correct paths after moves, alias delivery, reorder events, `splice` argument handling, equality checks, deep trees and delivery after a listener error are bug fixes. `SNAPSHOT_SHARED_COPY_LIMIT`, `SnapshotLimitError`, `UnsupportedStateError` and `getProxyStats().detachedWrites` are new exports and fields. The path-concatenation cache is gone; its statistics field reports 0.

## Measured costs

The copies and the place tracking cost time where 1.0.44 did no work. 1.0.44 below is the npm package. The first table comes from 40 paired rounds on one idle ARM64 host (Bun 1.4.3), one process per version and round, medians per operation:

| Operation | 1.0.44 | 2.0.0 | Why |
| --- | ---: | ---: | --- |
| Root creation, small entity | 0.2 µs | 1.0 µs | The first `replace` event carries a copy of the state; 1.0.44 sent the object itself. |
| Root creation, one account of jobs and 400 slots | 62.0 µs | 656 µs | Same: the copy. |
| Root creation, 20 such accounts | 4.6 µs | 12.6 ms | Same: the copy. |
| Root creation, 43,000 objects | 0.6 µs | 4.50 ms | Same: the copy. |
| Root creation, 173,000 objects | 0.9 µs | 18.0 ms | Same: the copy. |
| `reverse()` of a 400-slot list | 1.9 µs | 306 µs | 2.0.0 sends a `replace` with a copy of the array. 1.0.44 sent nothing, so its replica missed the change. |
| Assigning an equal 400-slot array again (same object) | 3.7 µs | 156 µs | 2.0.0 compares the values each time. 1.0.44 remembered an answer that could be stale. |
| `push` of one list with 100 slots | 0.9 µs | 74.2 µs | The event carries a copy of what is stored. |
| `splice` of a spread 400-slot list | 4.3 µs | 622 µs | Same: the copy. |
| Keeping a 20-item history (`unshift`, then `length = 20`) | 1.3 µs | 2.2 µs | Each object a write moves gets its new index. |

The second table comes from five runs per version on a host of the same model (Bun 1.4.3), medians:

| Operation | 1.0.44 | 2.0.0 | Why |
| --- | ---: | ---: | --- |
| Root creation, 32,000 rows that share one object | 0.1 ms | 40.6 ms | Each row's copy gets its own copy of the shared object. |
| Assigning those 32,000 rows | 8.10 ms | 24.2 ms | The copy, and one place per row for the shared object. |
| 4,000 `shift()` calls on a 4,000-row list | 6.70 ms | 58.5 ms | Each removal gives every later row it has seen its new index. |
| 100,000 `add()` calls of new objects to a Set | 18.9 ms | 50.8 ms | Each event carries a copy with an identity token. |
| Applying those 100,000 `set-add` events with `updateState` | 6.80 ms | 36.6 ms | The replica indexes each member by its token. |

Other writes got faster than in 1.0.44, because paths are no longer joined into strings and cached: a deep property write, a mixed write sequence, replacing 400 slots, replacing a job list by `filter` and `map.set` of an object take 50 to 70 percent of their 1.0.44 time, and a read of a nested leaf about 22 percent.

## Collection membership

A replica's Set members are copies, so `updateState` finds them by an identity token, not by comparing contents. Its Map keys are copies too, except the key of a `map-set` event, which is the source's own key object, as in 1.0.44. A token is unique inside the collection that holds its member. Each member has its own token, made when a copy or an event first names it, and a copy carries the token of the member it was copied from. Two different objects with equal contents have different tokens. A copy that a write puts into a collection gets a token of its own there, so the replica keeps it apart from its original, whichever of the two came first.

A reactive root made on a replica names its members the way the source does: a copy that `updateState` puts into it, or that the replica held when the root was made, keeps the token of the member it was copied from, unless that collection holds another member with that token. So the root's events can go back to the source through `updateState` in the same JavaScript realm, and both sides stay equal. A mirror that writes back must mute its echoes, the events one side sends while it applies the other side's events, as in every version across a socket. An object that joins a collection where another member already carries its token gets a token of its own in that collection, and an event that would carry the object itself carries a copy of it.

A replica keeps an index from token to member for each Set and Map that `updateState` changes, so an event finds its member without a scan. The index follows the changes `updateState` makes, and the writes through the proxies of a reactive root. A change by hand to a plain replica collection that alters its size makes `updateState` build the index again; one that keeps the size goes unnoticed, so leave plain replica collections to `updateState`.

Tokens live in weak maps: they keep no member alive. ESM and CommonJS copies of the library in one JavaScript realm share them. They are not a wire format. An event copied with JSON or `structuredClone` loses them, and the replica then matches object members by identity, which a copy never has. A transport that copies each event needs its own member ids. 1.0.44 could not delete object members across such a transport either.

## Shared graphs have a copy limit

The limit is new in 2.0.0. A chain of 17 distinct objects, each holding the next one twice, needs 131,071 copies, 131,054 of them extra, so it is refused. A chain of 16 needs 65,535 copies and passes.

A wide graph reaches the limit with two distinct objects. An array that holds the same leaf 100,002 times needs 100,001 extra copies and is refused; 100,001 times reaches exactly 100,000 and passes.

1.0.44 delivered these graphs without that work, because its initial event and inserted items were the original objects. A consumer that turns the graph into a tree, such as JSON serialization, still expands every repeated path. The limit bounds that expansion inside the library.

## Limits that stay

Map keys used in nested paths become strings. Set members have no path for nested writes. Named array properties and symbol properties travel in the payloads listed under [Supported inputs](https://github.com/Yiin/reactive-proxy-state#supported-inputs), but a write through them sends nothing. Array assignments still leave out named array properties, as 1.0.44 did. A getter in a payload that reaches back into the object it is written to is refused, and a reorder of a read-only array is refused before it writes.
