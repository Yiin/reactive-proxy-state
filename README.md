# Reactive Proxy State

[![npm version](https://badge.fury.io/js/%40yiin%2Freactive-proxy-state.svg)](https://badge.fury.io/js/%40yiin%2Freactive-proxy-state) [![Tests](https://github.com/Yiin/reactive-proxy-state/actions/workflows/test.yml/badge.svg)](https://github.com/Yiin/reactive-proxy-state/actions/workflows/test.yml) [![codecov](https://codecov.io/gh/Yiin/reactive-proxy-state/branch/main/graph/badge.svg)](https://codecov.io/gh/Yiin/reactive-proxy-state)

A simple, standalone reactivity library inspired by Vue 3's reactivity system, designed for use outside of Vue, particularly in server-side contexts or for data synchronization tasks. It uses JavaScript Proxies to track changes in plain objects, Arrays, Maps, and Sets.

**Note:** This library currently only supports synchronous effect execution.

## Documentation

For comprehensive documentation, visit our [documentation site](https://Yiin.github.io/reactive-proxy-state/).

## Installation

```bash
bun add @yiin/reactive-proxy-state
# or npm install @yiin/reactive-proxy-state
# or yarn add @yiin/reactive-proxy-state
```

## Core Concepts

1.  **Reactive State**: Create reactive versions of your objects using `reactive`. Any mutations to these wrapped objects will be tracked.
2.  **Dependency Tracking**: When code inside a `watchEffect` reads a property of a reactive object, a dependency is established.
3.  **Effect Triggering**: When a tracked property is mutated, any dependent effects (`watchEffect` or `watch` callbacks) are re-run **synchronously**.

## API

### `reactive<T extends object>(obj: T): T`

Creates a reactive proxy for the given object, Array, Map, or Set. Nested objects/collections are also recursively wrapped.

```typescript
import { reactive } from '@yiin/reactive-proxy-state';

const state = reactive({
  count: 0,
  user: { name: 'Alice' },
  items: ['a', 'b'],
  settings: new Map([['theme', 'dark']]),
  ids: new Set([1, 2])
});

// Mutations to 'state' and its nested properties/elements will be tracked.
state.count++;
state.user.name = 'Bob';
state.items.push('c');
state.settings.set('theme', 'light');
state.ids.add(3);
```

### `ref<T>(value?: T): Ref<T | undefined>`

Creates a reactive "reference" object for any value type (primitive or object). The value is accessed and mutated through the `.value` property. Reactivity is tracked on the `.value` property itself.

**Note:** If a plain object is passed to `ref`, the object *itself* is not made deeply reactive. Only assignment to the `.value` property is tracked. Use `reactive` for deep object reactivity.

```typescript
import { ref, watchEffect, isRef, unref } from '@yiin/reactive-proxy-state';

// Ref for a primitive
const count = ref(0);
console.log(count.value); // 0

watchEffect(() => {
  console.log('Count is:', count.value);
});
// Output: Count is: 0

count.value++; // Triggers the effect
// Output: Count is: 1

// Ref for an object
const user = ref({ name: 'Alice' });

watchEffect(() => {
  // This effect depends on the object reference stored in user.value
  console.log('User object:', user.value);
});
// Output: User object: { name: 'Alice' }

// Mutating the inner object DOES NOT trigger the effect above
user.value.name = 'Bob'; 

// Assigning a new object DOES trigger the effect
user.value = { name: 'Charles' };
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

-   **Getter-only:** The getter tracks reactive dependencies (`ref`s or reactive object properties) and its result is cached. The computed value only recalculates when a dependency changes. Computed refs created this way are **read-only**.
-   **Getter/Setter:** Provides both a getter for deriving the value and a setter for mutating underlying reactive state when the computed ref's `.value` is assigned.

```typescript
import { ref, computed, watchEffect, isComputed } from '@yiin/reactive-proxy-state';

// Read-only computed
const firstName = ref('John');
const lastName = ref('Doe');

const readOnlyFullName = computed(() => {
  console.log('Computing readOnlyFullName...');
  return `${firstName.value} ${lastName.value}`;
});

// Accessing .value triggers computation
console.log(readOnlyFullName.value); 
// Output: Computing readOnlyFullName...
// Output: John Doe

// Accessing again uses the cache
console.log(readOnlyFullName.value);
// Output: John Doe

watchEffect(() => {
  console.log('Read-only full name changed:', readOnlyFullName.value);
});
// Output: Read-only full name changed: John Doe

// Changing a dependency marks computed as dirty
firstName.value = 'Jane';

// Accessing .value again triggers re-computation and the effect
console.log(readOnlyFullName.value);
// Output: Computing readOnlyFullName...
// Output: Read-only full name changed: Jane Doe
// Output: Jane Doe

// Chained computed
const message = computed(() => `User: ${readOnlyFullName.value}`);
console.log(message.value); // User: Jane Doe

lastName.value = 'Smith';
// Output: Computing readOnlyFullName...
// Output: Read-only full name changed: Jane Smith
console.log(message.value); // User: Jane Smith (message recomputed automatically)

// Read-only check
console.warn = () => console.log('Warning triggered!'); // Mock console.warn
try {
  (readOnlyFullName as any).value = 'Test'; // Triggers warning
} catch (e) { /* ... */ }
// Output: Warning triggered!
console.log(readOnlyFullName.value); // Jane Smith (value unchanged)

// Writable computed
const source = ref(1);
const plusOne = computed({
    get: () => source.value + 1,
    set: (newValue) => { 
        console.log(`Setting source based on new value: ${newValue}`);
        source.value = newValue - 1; 
    }
});

console.log(plusOne.value); // 2 (Initial get)
console.log(source.value);  // 1

watchEffect(() => {
  console.log('Writable computed changed:', plusOne.value);
});
// Output: Writable computed changed: 2

// Set the writable computed value
plusOne.value = 10;
// Output: Setting source based on new value: 10
// Output: Writable computed changed: 10 

console.log(plusOne.value); // 10
console.log(source.value);  // 9 (Source was updated by the setter)

// Changing the source ref also updates the computed
source.value = 20;
// Output: Writable computed changed: 21
console.log(plusOne.value); // 21

// Helper
console.log(isComputed(readOnlyFullName)); // true
console.log(isComputed(plusOne)); // true
console.log(isComputed(firstName)); // false
```

### `watchEffect(effect: () => void, options?: WatchEffectOptions)`

Runs a function immediately, tracks its reactive dependencies, and re-runs it synchronously whenever any of those dependencies change.

`WatchEffectOptions`:
*   `onTrack?(event)`: Debug hook called when a dependency is tracked.
*   `onTrigger?(event)`: Debug hook called when the effect is triggered by a mutation.

```typescript
import { reactive, ref, watchEffect } from '@yiin/reactive-proxy-state';

// ... existing watchEffect example using reactive ...

// Using watchEffect with refs
const counter = ref(10);
watchEffect(() => {
  console.log('Counter:', counter.value);
});
// Output: Counter: 10
counter.value--;
// Output: Counter: 9
```

### `watch<T>(source: WatchSource<T> | T, callback: (newValue: T, oldValue: T | undefined) => void, options?: WatchOptions)`

Watches a specific reactive source (either a getter function, a direct reactive object/value created by `reactive`, or a `ref`) and runs a callback when the source's value changes.

`WatchSource<T>`: A function that returns the value to watch, or a `ref`.
`callback`: Function executed on change. Receives the new value and the old value.
`WatchOptions`:
*   `immediate?: boolean`: If `true`, runs the callback immediately with the initial value (oldValue will be `undefined`). Defaults to `false`.
*   `deep?: boolean`: If `true`, deeply traverses the source for dependency tracking and uses deep comparison logic. **Defaults to `true`**. Set to `false` for shallow watching (only triggers on direct assignment or identity change).

```typescript
import { reactive, ref, watch } from '@yiin/reactive-proxy-state';

// ... existing watch examples using reactive ...

// Watching a ref
const count = ref(0);
watch(count, (newVal, oldVal) => {
  console.log(`Count changed from ${oldVal} to ${newVal}`);
});
count.value = 5; // Output: Count changed from 0 to 5

// Watching a getter involving a ref
const doubleCount = ref(100);
watch(
  () => doubleCount.value * 2,
  (newDouble, oldDouble) => {
    console.log(`Double changed from ${oldDouble} to ${newDouble}`);
  }
);
doubleCount.value = 110; // Output: Double changed from 200 to 220
```

## Collections (Arrays, Maps, Sets)

`reactive` automatically handles Arrays, Maps, and Sets. Mutations via standard methods (`push`, `pop`, `splice`, `set`, `delete`, `add`, `clear`, etc.) are reactive and will trigger effects that depend on the collection or its contents (if watched deeply).

```typescript
import { reactive, watchEffect } from '@yiin/reactive-proxy-state';

const state = reactive({
  list: [1, 2],
  data: new Map<string, number>(),
  tags: new Set<string>()
});

watchEffect(() => console.log('List size:', state.list.length));
watchEffect(() => console.log('Data has "foo":', state.data.has('foo')));
watchEffect(() => console.log('Tags:', Array.from(state.tags).join(', ')));

state.list.push(3);            // Output: List size: 3
state.data.set('foo', 100);    // Output: Data has "foo": true
state.tags.add('important');   // Output: Tags: important
state.data.delete('foo');      // Output: Data has "foo": false
state.tags.add('urgent');      // Output: Tags: important, urgent
```
