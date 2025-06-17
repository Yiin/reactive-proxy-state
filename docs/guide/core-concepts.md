# Core Concepts

Understanding the core concepts behind `reactive-proxy-state` will help you make the most of its capabilities. The reactivity system is built on three fundamental concepts: **reactivity**, **dependency tracking**, and **effect triggering**.

## Reactive State

Reactive state is created using either the `reactive()` function for objects or the `ref()` function for primitive values.

```js
// Reactive objects (deep reactivity)
const state = reactive({ count: 0, users: [] });

// Reactive primitives (via .value property)
const count = ref(0);
```

When you access or mutate reactive state, the reactivity system automatically tracks dependencies and triggers effects.

### Proxy-based Reactivity

The `reactive()` function works by creating a JavaScript Proxy around your object. This proxy intercepts property access (via get handlers) and property mutations (via set handlers). This allows the system to:

1. Track when a property is accessed during a tracked effect's execution
2. Trigger effects when a tracked property is mutated

The system automatically and recursively wraps nested objects, arrays, maps, and sets to maintain deep reactivity.

### Value References

The `ref()` function is needed specifically for primitive values (strings, numbers, booleans) since JavaScript doesn't allow proxying primitives directly. A `ref` wraps the value in an object with a `.value` property:

```js
const message = ref("hello");
console.log(message.value); // Access via .value
message.value = "world"; // Mutate via .value
```

## Dependency Tracking

When a piece of reactive state is accessed during the execution of a tracking function (like `watchEffect` or within a `computed` getter), a dependency relationship is established:

```js
const user = reactive({ name: "Alice" });

watchEffect(() => {
  // By accessing user.name here, this effect becomes dependent on it
  console.log(`User: ${user.name}`);
});
```

This tracking happens automatically, without requiring explicit declarations of dependencies.

### How Tracking Works

1. Before executing a tracking function, the system sets up an "active effect" context
2. When reactive properties are accessed during execution, they register the current active effect as a dependent
3. After execution, the system has a complete registry of which properties the effect depends on

## Effect Triggering

When a piece of reactive state is mutated, all effects that depend on it are automatically triggered to run again:

```js
const user = reactive({ name: "Alice" });

watchEffect(() => {
  console.log(`User: ${user.name}`);
});
// Output: User: Alice

// This mutation triggers the effect
user.name = "Bob";
// Output: User: Bob
```

### How Triggering Works

1. When a reactive property is mutated, the system looks up all effects that depend on it
2. Each dependent effect is added to a queue to be re-executed
3. Effects are then synchronously executed

## Computed Properties

Computed properties are derived values based on other reactive state. They have two key characteristics:

1. They're **lazy**: the computation only runs when the computed property is accessed
2. They're **cached**: the result is stored until its dependencies change

```js
const firstName = ref("John");
const lastName = ref("Doe");

const fullName = computed(() => {
  console.log("Computing full name"); // Only logs when dependencies change
  return `${firstName.value} ${lastName.value}`;
});

console.log(fullName.value); // Computation runs, caches result
console.log(fullName.value); // Uses cached value, doesn't recompute

firstName.value = "Jane"; // Dependency changed
console.log(fullName.value); // Recomputes and caches new result
```

### Writable Computed Properties

Writable computed properties add a setter function that allows you to update source values through the computed property:

```js
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

// Reading works as with normal computed
console.log(fullName.value); // "John Doe"

// Writing updates the source refs
fullName.value = "Jane Smith";
console.log(firstName.value); // "Jane"
console.log(lastName.value); // "Smith"
```

## Watchers

There are two types of watchers:

### 1. watchEffect

`watchEffect` runs a function immediately while automatically tracking its dependencies, and re-runs it when those dependencies change. The effect function receives an optional `onCleanup` parameter for registering cleanup functions:

```js
const count = ref(0);

const stop = watchEffect((onCleanup) => {
  console.log(`Count is: ${count.value}`);

  // Optional: register cleanup functions for side effects
  const timer = setInterval(() => {
    console.log("Background task running...");
  }, 1000);

  onCleanup(() => {
    clearInterval(timer);
    console.log("Timer cleaned up");
  });
});
// Output: Count is: 0

count.value++;
// Output: Timer cleaned up
// Output: Count is: 1

// Stop watching (cleanup runs automatically)
stop();
// Output: Timer cleaned up

count.value++;
// No output - effect no longer running
```

### 2. watch

`watch` allows you to:

- Watch specific reactive sources
- Compare old and new values
- Control when the callback is executed (immediate or on change)
- Apply deep observation when needed

```js
const user = reactive({ name: "Alice" });

// Watch a specific property
watch(
  () => user.name,
  (newName, oldName) => {
    console.log(`Name changed from ${oldName} to ${newName}`);
  }
);

user.name = "Bob";
// Output: Name changed from Alice to Bob
```

## Edge Cases and Limitations

- The reactivity system is **synchronous** - effects run immediately after mutations
- Destructuring reactive objects has the following reactivity implications:
  - Primitive values (numbers, strings, booleans): Destructuring completely breaks reactivity because you get a copy of the value, not a reactive connection
    ```js
    const state = reactive({ count: 0 });
    const { count } = state; // count is now just a number (0)
    count++; // This won't affect state.count
    ```
  - Objects and arrays: Partial reactivity is maintained - you can modify properties of the destructured object and maintain reactivity, but replacing the object itself won't be tracked
    ```js
    const state = reactive({ nested: { value: 42 } });
    const { nested } = state;
    nested.value = 100; // This still triggers reactivity
    nested = { value: 200 }; // This won't affect state.nested
    ```
  - Solution: Use `toRefs` to maintain full reactivity when destructuring
    ```js
    const state = reactive({ count: 0, nested: { value: 42 } });
    const { count, nested } = toRefs(state);
    count.value++; // This updates state.count reactively
    nested.value = { value: 100 }; // This updates state.nested reactively
    ```
- Object property addition/deletion is tracked, but requires the object to be created with `reactive()`
- Direct mutations to nested objects inside refs won't trigger effects - use `reactive` for deep reactivity
- Modifying array length directly or using non-standard array methods might have unexpected behavior

Understanding these concepts will give you a solid foundation for effectively using `reactive-proxy-state` in your applications.
