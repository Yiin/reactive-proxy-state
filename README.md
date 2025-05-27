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

## Advanced Usage

For more complex scenarios like state synchronization between different contexts, manual event handling, and detailed API documentation, see our [comprehensive documentation](https://Yiin.github.io/reactive-proxy-state/).
