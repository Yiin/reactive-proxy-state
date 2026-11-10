# Reactive Proxy State

[![npm version](https://badge.fury.io/js/%40yiin%2Freactive-proxy-state.svg)](https://badge.fury.io/js/%40yiin%2Freactive-proxy-state) [![Tests](https://github.com/Yiin/reactive-proxy-state/actions/workflows/test.yml/badge.svg)](https://github.com/Yiin/reactive-proxy-state/actions/workflows/test.yml) [![codecov](https://codecov.io/gh/Yiin/reactive-proxy-state/branch/main/graph/badge.svg)](https://codecov.io/gh/Yiin/reactive-proxy-state)

A simple, standalone reactivity library inspired by Vue 3's reactivity system, designed for use outside of Vue, particularly in server-side contexts or for data synchronization tasks. It uses JavaScript Proxies to track changes in plain objects, Arrays, Maps, and Sets. Notably, it includes mechanisms for serializing and applying state changes (see [`updateState`](./docs/api/update-state.md)), enabling use cases like state replication between different environments (e.g., server-client, main thread-worker), a feature not typically found in core reactivity libraries.

**Note:** This library currently only supports synchronous effect execution.

## Documentation

For comprehensive documentation, visit our [documentation site](https://Yiin.github.io/reactive-proxy-state/).

## Installation

```bash
bun add @yiin/reactive-proxy-state
# or npm install @yiin/reactive-proxy-state
# or yarn add @yiin/reactive-proxy-state
```

Version 2 needs ES2021 or later (it uses `WeakRef`). Coming from 1.x? Read [Upgrading to 2.0.0](./docs/guide/upgrading-to-2.md) first: payloads are copies now, and a few inputs are refused.

Version 3 changes only the Vue tracker, `trackVueReactiveEvents`: it needs Vue 3.5 and the app's own `@vue/reactivity`. See [Upgrading to 3.0.0](./docs/guide/upgrading-to-3.md).

## Quick Start

The most common use case is creating reactive state for local applications:

```typescript
import { reactive, watchEffect } from "@yiin/reactive-proxy-state";

// Create reactive state
const state = reactive({
  count: 0,
  user: { name: "Alice" },
  items: ["apple", "banana"],
});

// Watch for changes
watchEffect(() => {
  console.log(`Count: ${state.count}, User: ${state.user.name}`);
});
// Output: Count: 0, User: Alice

// Mutations automatically trigger effects
state.count++;
// Output: Count: 1, User: Alice

state.user.name = "Bob";
// Output: Count: 1, User: Bob

state.items.push("orange");
// Arrays, Maps, and Sets are also reactive
```

## Core Concepts

1.  **Reactive State**: Create reactive versions of your objects using `reactive`. Any mutations to these wrapped objects will be tracked.
2.  **Dependency Tracking**: When code inside a `watchEffect` reads a property of a reactive object, a dependency is established.
3.  **Effect Triggering**: When a tracked property is mutated, any dependent effects (`watchEffect` or `watch` callbacks) are re-run **synchronously**.

## Advanced: State Synchronization

For advanced use cases like server-client synchronization, you can track state changes and apply them elsewhere:

```typescript
import { reactive, updateState } from "@yiin/reactive-proxy-state";

// Server: Track changes and send them to clients
const serverState = reactive({ count: 0 }, (event) => {
  // Send event to all connected clients
  broadcastToClients(event);
});

// Client: Apply changes received from server
const clientState = reactive({});

// When client receives events from server
onServerEvent((event) => {
  updateState(clientState, event);
});

// Now both states stay in sync
serverState.count = 5; // Automatically synced to all clients
```

If you need to relay state or events through `postMessage`, workers, or any structured-clone boundary, convert them first:

```typescript
import { deepToRaw } from "@yiin/reactive-proxy-state";

worker.postMessage(deepToRaw(serverState));
```

See the [`updateState` documentation](./docs/api/update-state.md) and [`reactive` documentation](./docs/api/reactive.md) for more details on event emission and application.

## API

### `reactive<T extends object>(obj: T): T`

Creates a reactive proxy for the given object, Array, Map, or Set. Nested objects/collections are also recursively wrapped.

```typescript
import { reactive } from "@yiin/reactive-proxy-state";

const state = reactive({
  count: 0,
  user: { name: "Alice" },
  items: ["a", "b"],
  settings: new Map([["theme", "dark"]]),
  ids: new Set([1, 2]),
});

// Mutations to 'state' and its nested properties/elements will be tracked.
state.count++;
state.user.name = "Bob";
state.items.push("c");
state.settings.set("theme", "light");
state.ids.add(3);
```

### `ref<T>(value?: T): Ref<T | undefined>`

Creates a reactive "reference" object for any value type (primitive or object). The value is accessed and mutated through the `.value` property. Reactivity is tracked on the `.value` property itself.

**Note:** If a plain object is passed to `ref`, the object _itself_ is not made deeply reactive. Only assignment to the `.value` property is tracked. Use `reactive` for deep object reactivity.

```typescript
import { ref, watchEffect, isRef, unref } from "@yiin/reactive-proxy-state";

// Ref for a primitive
const count = ref(0);
console.log(count.value); // 0

watchEffect(() => {
  console.log("Count is:", count.value);
});
// Output: Count is: 0

count.value++; // Triggers the effect
// Output: Count is: 1

// Ref for an object
const user = ref({ name: "Alice" });

watchEffect(() => {
  // This effect depends on the object reference stored in user.value
  console.log("User object:", user.value);
});
// Output: User object: { name: 'Alice' }

// Mutating the inner object DOES NOT trigger the effect above
user.value.name = "Bob";

// Assigning a new object DOES trigger the effect
user.value = { name: "Charles" };
// Output: User object: { name: 'Charles' }

// Helpers
console.log(isRef(count)); // true
console.log(isRef({ value: 0 })); // false

console.log(unref(count)); // 1 (current value)
console.log(unref(123)); // 123 (returns non-refs as is)
```

### `computed<T>(getter: () => T): ComputedRef<T>`

### `computed<T>(options: { get: () => T, set: (value: T) => void }): WritableComputedRef<T>`

Creates a computed property based on a getter function or a getter/setter pair.

- **Getter-only:** The getter tracks reactive dependencies (`ref`s or reactive object properties) and its result is cached. The computed value only recalculates when a dependency changes. Computed refs created this way are **read-only**.
- **Getter/Setter:** Provides both a getter for deriving the value and a setter for mutating underlying reactive state when the computed ref's `.value` is assigned.

```typescript
import { ref, computed } from "@yiin/reactive-proxy-state";

// Read-only computed
const firstName = ref("John");
const lastName = ref("Doe");

const fullName = computed(() => `${firstName.value} ${lastName.value}`);
console.log(fullName.value); // John Doe

firstName.value = "Jane";
console.log(fullName.value); // Jane Doe

// Writable computed
const count = ref(1);
const doubled = computed({
  get: () => count.value * 2,
  set: (value) => {
    count.value = value / 2;
  },
});

console.log(doubled.value); // 2
doubled.value = 10;
console.log(count.value); // 5
```

### `watchEffect(effect: () => void, options?: WatchEffectOptions)`

Runs a function immediately, tracks its reactive dependencies, and re-runs it synchronously whenever any of those dependencies change.

`WatchEffectOptions`:

- `onTrack?(event)`: Debug hook called when a dependency is tracked.
- `onTrigger?(event)`: Debug hook called when the effect is triggered by a mutation.

```typescript
import { reactive, watchEffect } from "@yiin/reactive-proxy-state";

const state = reactive({ count: 0 });

watchEffect(() => {
  console.log("Count:", state.count);
});
// Output: Count: 0

state.count++;
// Output: Count: 1
```

### `watch<T>(source: WatchSource<T> | T, callback: (newValue: T, oldValue: T | undefined) => void, options?: WatchOptions)`

Watches a specific reactive source (either a getter function, a direct reactive object/value created by `reactive`, or a `ref`) and runs a callback when the source's value changes.

`WatchSource<T>`: A function that returns the value to watch, or a `ref`.
`callback`: Function executed on change. Receives the new value and the old value.
`WatchOptions`:

- `immediate?: boolean`: If `true`, runs the callback immediately with the initial value (oldValue will be `undefined`). Defaults to `false`.
- `deep?: boolean`: If `true`, deeply traverses the source for dependency tracking and uses deep comparison logic. **Defaults to `true`**. Set to `false` for shallow watching (only triggers on direct assignment or identity change).

```typescript
import { reactive, watch } from "@yiin/reactive-proxy-state";

const state = reactive({ count: 0 });

watch(
  () => state.count,
  (newVal, oldVal) => {
    console.log(`Count changed from ${oldVal} to ${newVal}`);
  }
);

state.count = 5; // Output: Count changed from 0 to 5
```

## Collections (Arrays, Maps, Sets)

`reactive` automatically handles Arrays, Maps, and Sets. Mutations via standard methods (`push`, `pop`, `splice`, `set`, `delete`, `add`, `clear`, etc.) are reactive and will trigger effects that depend on the collection or its contents (if watched deeply).

```typescript
import { reactive, watchEffect } from "@yiin/reactive-proxy-state";

const state = reactive({
  list: [1, 2],
  data: new Map<string, number>(),
  tags: new Set<string>(),
});

watchEffect(() => console.log("List size:", state.list.length));
watchEffect(() => console.log('Data has "foo":', state.data.has("foo")));
watchEffect(() => console.log("Tags:", Array.from(state.tags).join(", ")));

state.list.push(3); // Output: List size: 3
state.data.set("foo", 100); // Output: Data has "foo": true
state.tags.add("important"); // Output: Tags: important
state.data.delete("foo"); // Output: Data has "foo": false
state.tags.add("urgent"); // Output: Tags: important, urgent
```

An effect reruns once after each write that changes what it read. An effect that reads all items of an array, with a method (`map`, `filter`, `forEach`, `reduce`, `join`, `indexOf`, `includes`, `find`, `slice`, `concat`, `flatMap`, `toSorted` and the rest) or a loop (`for...of`, spread, `Array.from`), reruns after an index write, an index delete, a length change and every method that changes the array. An effect that reads one index or `length` reruns only when that index or the length changes, also after `shift`, `unshift` and `splice`. On a Map, `get` tracks the value at its key, `has` tracks membership, and `keys()` tracks the ordered keys. A value update at an existing key reruns neither `has` nor `keys()` readers. Map value iteration reruns on every entry change. On a Set, `has` tracks membership, and iteration tracks all members. Each entry is tracked as the collection keys it: `1` and `"1"` are two entries, and an entry named `"get"` or `"size"` is not the method or the property. Saved array, Map and Set iterators track each step inside an effect. A method tracks when it runs, so `const values = map.values` taken before an effect still tracks inside it. Mutators (`push`, `splice`, `set`, `add` and the rest) track nothing. In 3.0.1 and earlier, an index write, an index delete or a length change did not rerun readers of all items.

A key added to or deleted from a plain object reruns every effect that read a key of that object, so `JSON.stringify`, spread, `Object.entries`, `Object.values` and a deep `watch` follow it. An effect that read only `a` of that object reruns too.

A write marks every `computed` it changes as stale, down a chain of computed values, before listeners or effects run, so both read fresh computed values. Effects run in the order they were triggered, each once per write: an effect that waits to run is not queued again. A write that a listener makes while it receives an event belongs to that write, so effects run when the outermost write ends, after the listener returns. An effect that throws does not stop the others; the write throws the first error after they ran. Effects that keep writing new values to each other throw a `RangeError` after one of them ran 100,000 times in one write. Listener writes that keep answering each other stop the same way: a listener write nested more than 100 deep, or past 100,000 nested rounds in one operation, is refused with a `RangeError` after the committed events drain (an `{ async: true }` root logs it with `console.error`). After a listener write is refused, every further listener write in that operation is refused. This includes every listener still running, even one that did not see the error.

Some reads are not tracked:

- `in`, `Object.keys`, `Object.entries` and `for...in` on an array. Traps for them made `Object.keys(list)` 70% slower for every caller. Read `length` or loop over the array instead.
- Reads inside array callbacks of the raw items they receive. `state.rows.map((row) => row.join())` reruns when `state.rows` changes, not when a row changes. Loop with `for (const row of state.rows)` to track the rows too.
- `in`, `Object.keys`, `Object.hasOwn` and `for...in` of keys on a plain object, when the effect reads no key of that object. An `ownKeys` trap made `JSON.stringify` of the state 35% slower for every caller. Read a key of the object too, or `JSON.stringify` it.

## Synchronization Limits

### Supported inputs

A replica fed every event always equals the state when the state is made of:

- plain objects, arrays, Maps and Sets, with enumerable data properties (no getters or setters);
- `sort` comparators and array callbacks that do not change the array or object they work on;
- numeric or numeric-string bounds for `splice`, `fill` and `copyWithin`.

Other input stays correct or is refused before anything changes:

- **Comparator writes.** A comparator that writes through the proxy gets the native result: `sort` writes back the items it read before comparing, sorted, and keeps a tail the comparator appended. The comparator's own writes send their own events first.
- **Bounds with side effects.** `fill` and `copyWithin` convert each bound once, in native order, and use the same numbers for the event and the write. A `BigInt` or `Symbol` bound throws a `TypeError` before any change, like native code.
- **Read-only and frozen arrays.** `sort`, `reverse`, `fill` and `copyWithin` check every index native code would write before the first write. A read-only index, a hole in a non-extensible array, or a non-configurable index to delete throws a `TypeError` with the array unchanged and no event. A one-item `sort` writes nothing, so it works on a frozen array, as natively.
- **Getters on a back-reference.** A payload that reaches back into the object it is written to (a cycle) is copied as it will be after the write. An accessor property in that object or in the payload throws an `UnsupportedStateError` (a `TypeError`) before the write. The written object's getter is not called. (The set trap reads the new value's own properties to unwrap stored proxies, so a getter on the new value itself runs once.)
- **Payloads too large to copy** throw a `SnapshotLimitError` (see the copy limit below).

A refused write sends no event and runs no effect: the state and every replica stay as they were. Keep the same root and retry with supported input.

These cases are not synchronized, and are not refused:

- **Getters elsewhere.** A getter is copied as the value it returns when the event is made. The replica keeps that value; a later change of what the getter returns sends no event.
- **Writes to another receiver.** A write to an array proxy whose receiver does not forward to the array (`Reflect.set(list, 0, 9, {})`, a write to `Object.create(list)`) lands on that receiver, as on a plain array, and sends nothing. The raw array as receiver (`Reflect.set(list, 0, 9, toRaw(list))`) is a raw write: it changes the array and sends nothing. A write through an outer proxy (`new Proxy(list, {})`) reaches the array and is sent once, like the same write on the proxy.
- **Raw writes.** A write through `toRaw()`, through the raw items that array callbacks receive (`forEach`, `map`, `filter`, `flatMap`, `reduce`, `some`, `every`, the `find` predicate) or that copying methods return (`slice`, `concat`, `filter`, `flatMap`, `toSorted`), or on raw objects inside a `valueOf` bypasses the proxies and sends nothing. Index reads, `at`, `find`, `findLast` and iteration (`for...of`, spread, `Array.from`, destructuring, `values()`, `entries()`) give proxies, so writes through them are sent. Until 3.0.0, iteration gave raw items too. A loop that only reads a long list can iterate `toRaw(list)` to skip the proxies.
- **Descriptor and prototype changes** after the state is made (`Object.defineProperty` on an object, a Map or a Set, an accessor on an array, freezing part of the state, a setter on a prototype). `Object.defineProperty` with a value on an array is sent like the same write with `=`, and flags alone on a key the array does not have like the write of `undefined`. An array's setter, its own or one on its prototype chain, runs with the proxy as `this`, so its writes are sent; a setter on the prototype chain also reruns the effects that read its key. `list.__proto__ = proto` runs such a setter: it changes the array's prototype and sends nothing. An array, Map or Set proxy keeps a built-in method once it read it, so a later change to `Array.prototype`, `Map.prototype` or `Set.prototype` does not reach that proxy. Only the reorders above check the array first; `push`, `pop`, `shift`, `unshift`, `splice` and index writes on an array with a read-only index can fail part way, like native code, and send no event for the part they wrote.

Events carry paths, and `updateState` applies them on a replica. Some shapes cannot travel that way:

- **Map keys are path segments, written as strings.** A map with both `1` and `"1"` as keys gives the same path for both, so a write inside one value can land on the other on the replica. Object keys have no path at all: a write inside an object used as a key emits nothing. Use string keys, or one key type per map, in synced state.
- **Set members have no key.** A path into a set member uses its current position, and `updateState` cannot follow a path into a set. Writes inside an object stored in a set do not replay. Keep primitives in synced sets, or replace a member (`delete` then `add`) instead of changing it.
- **Raw objects can hide an alias.** An object at two places emits one event per place. The library finds the places when a value is stored (root creation, assignment, insertion, `sort`, `reverse`, `fill`, `copyWithin`), also inside a value that left the tree and is stored again. An object stored through a raw reference (from `toRaw`, or the raw items that array callbacks and copying methods such as `filter`, `map` and `slice` give) next to a place it already has elsewhere is not seen as an alias until it is stored again through a proxy.
- **Array properties depend on the event.** The initial replace, inserted items, a set's added value and removed values keep enumerable named and symbol properties. Reorders keep these properties on nested arrays too. The reordered array keeps its own properties because `updateState` replaces its items in place. An assignment's `newValue` (`set`, `map-set`) still copies only array items, as in 1.0.44. A read of a named array property returns the raw value, so a write inside it sends nothing.
- **A cycle through the written object travels as a copy.** A value that reaches back into the object it is written to (`state.x = [toRaw(state)]`) reaches the replica with a copy of that object at the back-reference, because a path cannot name the object itself. A later write to the object changes its own place on the replica, not that copy. Keep such back-references out of synced state.
- **Shared graphs have a copy limit.** Payloads copy a shared object once per place. A payload that would make more than 100,000 extra copies (`SNAPSHOT_SHARED_COPY_LIMIT`) throws a `SnapshotLimitError` (a `RangeError`) before anything changes: `reactive()` throws before it returns a proxy, and a write throws with the state as it was, no event sent and no effect run, so a replica still matches. The `items` of one call are one payload. A root with `{ async: true }` refuses to remove a part over the limit too, because its copy is the `oldValue`: remove it in smaller parts. In a cyclic graph every part can reach the whole graph, so even one property can be too large to remove. A synchronous root sends what a write removes without a copy, as 1.0.44 did, and never refuses a removal, `Set.delete()` included. Then rebuild the root: make the state again from new objects without that graph (for example with `structuredClone` of the parts you keep), pass it to `reactive()` with the same emit function, and stop using the old root and its proxies. The new root's first event, a `replace` at the root path, resets every replica.

[Upgrading to 2.0.0](./docs/guide/upgrading-to-2.md) lists what a 1.x user must change, what else changed, and the measured costs.

A write through a proxy whose object is no longer in the tree changes the object and emits nothing. `getProxyStats().detachedWrites` counts those writes, so you can alert on them.

## Advanced Usage

For more complex scenarios like state synchronization between different contexts, manual event handling, and detailed API documentation, see our [comprehensive documentation](https://Yiin.github.io/reactive-proxy-state/).
