# watchEffect

Runs a function immediately while automatically tracking its reactive dependencies, and re-runs it whenever those dependencies change.

## Signature

```ts
function watchEffect<T>(
  effect: (onCleanup?: (cleanupFn: () => void) => void) => T,
  options?: WatchEffectOptions
): WatchEffectStopHandle<T>;
```

## Parameters

- `effect`: A function that will be run immediately and re-run when its dependencies change. This function receives an optional `onCleanup` function as its first argument that allows you to register cleanup callbacks.
  - `onCleanup?`: Function to register cleanup callbacks that will be called before the effect re-runs or when the effect is stopped
- `options`: Optional settings object with the following properties:
  - `lazy?`: If true, the effect does not run immediately upon creation
  - `scheduler?`: Custom function to control how/when the effect runs after a trigger
  - `onTrack?`: Debug callback for when a reactive property is tracked
  - `onTrigger?`: Debug callback for when the effect is triggered

## Return Value

Returns a stop handle function that can be called to stop the watcher. The stop handle also exposes the internal effect instance for advanced use cases:

```ts
interface WatchEffectStopHandle<T = any> {
  (): void; // Stop function - call to stop watching
  effect: TrackedEffect<T>; // Internal effect instance
}
```

When the stop function is called, any registered cleanup functions will be executed before the effect is permanently stopped.

## Examples

### Basic Usage

```ts
import { reactive, watchEffect } from "@yiin/reactive-proxy-state";

const state = reactive({ count: 0 });

const stop = watchEffect(() => {
  console.log(`Count is: ${state.count}`);
});
// Output: Count is: 0

state.count++;
// Output: Count is: 1

// Stop watching
stop();

state.count++;
// No output - the effect is no longer running
```

### Automatic Dependency Tracking

One of the key features of `watchEffect` is that dependencies are automatically tracked:

```ts
import { reactive, watchEffect } from "@yiin/reactive-proxy-state";

const user = reactive({
  firstName: "John",
  lastName: "Doe",
  age: 30,
});

watchEffect(() => {
  // Only properties accessed inside this function will be tracked
  console.log(`Name: ${user.firstName} ${user.lastName}`);
});
// Output: Name: John Doe

// This triggers the effect because firstName was accessed in the effect
user.firstName = "Jane";
// Output: Name: Jane Doe

// This does NOT trigger the effect because age wasn't accessed in the effect
user.age = 31;
// No output
```

### Cleanup Functions with onCleanup

The `effect` function receives an `onCleanup` function as its first argument. You can call this to register cleanup callbacks that will be executed:

- **Before the effect re-runs** (when dependencies change)
- **When the effect is stopped** (via the stop handle)

This is essential for cleaning up side effects like timers, event listeners, subscriptions, etc.

```ts
import { ref, watchEffect } from "@yiin/reactive-proxy-state";

const id = ref(0);

const stop = watchEffect((onCleanup) => {
  const currentId = id.value;
  console.log(`Effect running for id: ${currentId}`);

  // Set up a side effect
  const timer = setTimeout(() => {
    console.log(`Timer ${currentId} fired`);
  }, 1000);

  // Register cleanup function - will be called before re-execution or on stop
  onCleanup(() => {
    clearTimeout(timer);
    console.log(`Timer ${currentId} cleared`);
  });
});

// After 500ms, change the id which will trigger cleanup and re-run
setTimeout(() => {
  id.value++; // Triggers cleanup, then re-runs effect
}, 500);

// Later, stop the effect (triggers final cleanup)
setTimeout(() => {
  stop(); // Calls cleanup one final time
}, 2000);

// Output:
// Effect running for id: 0
// (after 500ms)
// Timer 0 cleared
// Effect running for id: 1
// (after 1500ms more)
// Timer 1 cleared
```

#### Multiple Cleanup Functions

You can register multiple cleanup functions - they will all be called in the order they were registered:

```ts
const state = ref(0);

watchEffect((onCleanup) => {
  console.log(`Setting up for state: ${state.value}`);

  // Multiple cleanup registrations
  onCleanup(() => console.log("Cleanup 1"));
  onCleanup(() => console.log("Cleanup 2"));
  onCleanup(() => console.log("Cleanup 3"));
});

state.value++;
// Output:
// Setting up for state: 0
// (when state changes)
// Cleanup 1
// Cleanup 2
// Cleanup 3
// Setting up for state: 1
```

#### Error Handling in Cleanup

If a cleanup function throws an error, it won't break the effect or prevent other cleanup functions from running:

```ts
watchEffect((onCleanup) => {
  onCleanup(() => {
    throw new Error("Cleanup error");
  });
  onCleanup(() => {
    console.log("This cleanup still runs");
  });

  return state.value;
});

// Errors are logged to console but don't break the effect
```

### Debugging with onTrack and onTrigger

The `onTrack` and `onTrigger` options can be used to debug when dependencies are tracked and when the effect is triggered:

```ts
import { reactive, watchEffect } from "@yiin/reactive-proxy-state";

const state = reactive({ count: 0 });

watchEffect(
  () => {
    console.log(`Count is: ${state.count}`);
  },
  {
    onTrack(event) {
      console.log("Property tracked:", event);
    },
    onTrigger(event) {
      console.log("Effect triggered:", event);
    },
  }
);

state.count++;
```

## Stopping the Watcher

The returned stop handle can be used to stop the watcher when you no longer need it:

```ts
import { reactive, watchEffect } from "@yiin/reactive-proxy-state";

const state = reactive({ count: 0 });

const stop = watchEffect(() => {
  console.log(`Count is: ${state.count}`);
});
// Output: Count is: 0

// Later, when you want to stop watching
stop();

// This will no longer trigger the effect
state.count++;
```

## Self-stopping Watchers

A watcher can also stop itself during execution:

```ts
import { ref, watchEffect } from "@yiin/reactive-proxy-state";

const count = ref(0);

const stop = watchEffect((onCleanup) => {
  console.log(`Count is: ${count.value}`);

  // Stop watching when count reaches 3
  if (count.value >= 3) {
    stop();
  }
});
// Output: Count is: 0

count.value++;
// Output: Count is: 1

count.value++;
// Output: Count is: 2

count.value++;
// Output: Count is: 3
// Watcher stops itself

count.value++;
// No output - the effect is no longer running
```

## Comparison with watch

Unlike `watch`, which focuses on specific sources and gives you access to old and new values:

- `watchEffect` automatically tracks dependencies
- `watchEffect` can track multiple reactive sources at once
- `watchEffect` doesn't give you access to previous values
- `watchEffect` runs immediately by default

If you need to compare old and new values, or have more control over when the callback is executed, use `watch` instead.

## Related

- [`watch`](/api/watch) – watch specific sources with old/new comparison
- [`computed`](/api/computed) – cached derived reactive values that internally use watchEffect
- [`ref`](/api/ref) – reactive primitive wrapper commonly used inside watchEffect
- [`reactive`](/api/reactive) – create reactive objects that supply dependencies
