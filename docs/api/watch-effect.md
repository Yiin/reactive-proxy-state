# watchEffect

Runs a function immediately while automatically tracking its reactive dependencies, and re-runs it whenever those dependencies change.

## Signature

```ts
function watchEffect(
  effect: () => void, 
  options?: WatchEffectOptions
): WatchEffectStopHandle
```

## Parameters

- `effect`: A function that will be run immediately and re-run when its dependencies change. This function receives an optional `onCleanup` function as its first argument (see example below).
- `options`: Optional settings object with the following properties:
  - `onTrack?`: Debug callback for when a reactive property is tracked
  - `onTrigger?`: Debug callback for when the effect is triggered

## Return Value

Returns a stop handle function that can be called to stop the watcher:

```ts
interface WatchEffectStopHandle {
  stop(): void;
}
```

## Examples

### Basic Usage

```ts
import { reactive, watchEffect } from '@yiin/reactive-proxy-state';

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
import { reactive, watchEffect } from '@yiin/reactive-proxy-state';

const user = reactive({
  firstName: 'John',
  lastName: 'Doe',
  age: 30
});

watchEffect(() => {
  // Only properties accessed inside this function will be tracked
  console.log(`Name: ${user.firstName} ${user.lastName}`);
});
// Output: Name: John Doe

// This triggers the effect because firstName was accessed in the effect
user.firstName = 'Jane';
// Output: Name: Jane Doe

// This does NOT trigger the effect because age wasn't accessed in the effect
user.age = 31;
// No output
```

### Cleanup on Re-execution

The `effect` function receives an `onCleanup` function as its first argument. You can call this to register a cleanup callback that will be executed right before the effect is run again, or when the watcher is stopped.

```ts
import { ref, watchEffect } from '@yiin/reactive-proxy-state';
// No import needed for onCleanup

const id = ref(0);

watchEffect((onCleanup) => { // onCleanup is passed as an argument
  const currentId = id.value;
  console.log(`Effect running for id: ${currentId}`);
  const timer = setTimeout(() => {
    console.log(`Timer ${currentId} fired`);
  }, 1000);

  // Register a cleanup function that will be called before re-execution
  // or when the effect is stopped
  onCleanup(() => {
    clearTimeout(timer);
    console.log(`Timer ${currentId} cleared`);
  });
});

// After 500ms, change the id which will trigger cleanup and re-run
setTimeout(() => {
  id.value++;
}, 500);

// Output:
// Effect running for id: 0
// (after 500ms)
// Timer 0 cleared
// Effect running for id: 1
// (after 1500ms)
// Timer 1 fired
```

### Debugging with onTrack and onTrigger

The `onTrack` and `onTrigger` options can be used to debug when dependencies are tracked and when the effect is triggered:

```ts
import { reactive, watchEffect } from '@yiin/reactive-proxy-state';

const state = reactive({ count: 0 });

watchEffect(
  () => {
    console.log(`Count is: ${state.count}`);
  },
  {
    onTrack(event) {
      console.log('Property tracked:', event);
    },
    onTrigger(event) {
      console.log('Effect triggered:', event);
    }
  }
);

state.count++;
```

## Stopping the Watcher

The returned stop handle can be used to stop the watcher when you no longer need it:

```ts
import { reactive, watchEffect } from '@yiin/reactive-proxy-state';

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
import { ref, watchEffect } from '@yiin/reactive-proxy-state';

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