# computed

Creates a reactive computed property that automatically tracks its dependencies and updates when those dependencies change. Computed values are cached until their dependencies change.

## Signatures

### Basic (Read-only)

```ts
function computed<T>(getter: () => T): ComputedRef<T>;
```

### Writable

```ts
function computed<T>(options: {
  get: () => T;
  set: (value: T) => void;
}): WritableComputedRef<T>;
```

## Return Value

- A `ComputedRef<T>` or `WritableComputedRef<T>` object with a `.value` property that gives access to the computed value.
- Accessing `.value` triggers the computation if the computed value is dirty (or on first access).
- A computed ref tracks any reactivity sources (refs, reactive objects) accessed during its getter function execution.
- Every computed ref exposes a `.stop()` **handle** that disposes all internal watchers and frees resources. Call it when you no longer need the computed value (e.g., in component unmount hooks).
- The computed ref automatically tracks any reactive sources accessed during its getter function execution.

## Type Declarations

```ts
// resembles a ref but is read-only and derived from a getter
interface ComputedRef<T = any> extends Omit<Ref<T>, "value"> {
  readonly value: T;
  readonly stop: WatchEffectStopHandle<T>; // allows manual disposal
}

// interface for writable computed refs
interface WritableComputedRef<T> extends Ref<T> {
  // Writable computed refs are also refs, but derived.
  readonly stop: WatchEffectStopHandle<T>;
}
```

## Examples

### Basic (Read-only) Computed

Creating a read-only computed property:

```ts
import { ref, computed } from "@yiin/reactive-proxy-state";

const count = ref(1);
const double = computed(() => count.value * 2);

console.log(double.value); // 2

count.value = 2;
console.log(double.value); // 4
```

### Writable Computed

Creating a writable computed property with both getter and setter:

```ts
import { ref, computed } from "@yiin/reactive-proxy-state";

const firstName = ref("John");
const lastName = ref("Doe");

const fullName = computed({
  get: () => `${firstName.value} ${lastName.value}`,
  set: (newValue) => {
    const parts = newValue.split(" ");
    firstName.value = parts[0] || "";
    lastName.value = parts[1] || "";
  },
});

console.log(fullName.value); // 'John Doe'

// Update source refs through the computed property
fullName.value = "Jane Smith";

console.log(firstName.value); // 'Jane'
console.log(lastName.value); // 'Smith'
console.log(fullName.value); // 'Jane Smith'
```

### Chained Computed

Computed properties can depend on other computed properties:

```ts
const count = ref(1);
const double = computed(() => count.value * 2);
const quadruple = computed(() => double.value * 2);

console.log(quadruple.value); // 4

count.value = 2;
console.log(quadruple.value); // 8
```

### Caching Behavior

Computed properties cache their return value until their dependencies change:

```ts
const count = ref(0);

// To demonstrate the caching behavior, we'll log when the getter runs
const expensive = computed(() => {
  console.log("Computing expensive value...");
  return count.value * 1000 + Date.now();
});

// First access runs the getter
console.log(expensive.value);
// Output: Computing expensive value...
// Output: <some value with the current timestamp>

// Accessing again immediately uses cached value without running getter
console.log(expensive.value);
// Output: <same value as before, no "Computing..." message>

// Changing the dependency marks the computed as dirty
count.value = 1;

// Next access runs the getter again
console.log(expensive.value);
// Output: Computing expensive value...
// Output: <updated value with a new timestamp>
```

## Helper Function

```ts
function isComputed<T>(
  value: any
): value is ComputedRef<T> | WritableComputedRef<T>;
```

Checks if a value is a computed ref.

### Example

```ts
import { ref, computed, isComputed } from "@yiin/reactive-proxy-state";

const count = ref(0);
const double = computed(() => count.value * 2);

console.log(isComputed(double)); // true
console.log(isComputed(count)); // false
console.log(isComputed({})); // false
```

## Related

- [`ref`](/api/ref) – reactive primitive & object holders
- [`reactive`](/api/reactive) – create deep reactive objects used by computed getters
- [`watchEffect`](/api/watch-effect) – run side-effects that automatically track dependencies
- [`watch`](/api/watch) – respond to specific reactive sources with old/new values
