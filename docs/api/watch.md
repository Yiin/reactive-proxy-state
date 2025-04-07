# watch

Watches one or more reactive data sources and runs a callback when those sources change.

## Signatures

```ts
// Watching a single source
function watch<T>(
  source: WatchSource<T>,
  callback: (newValue: T, oldValue: T | undefined) => void,
  options?: WatchOptions
): WatchStopHandle

// Watching multiple sources
function watch<T extends readonly any[]>(
  sources: [...WatchSource<T>],
  callback: (newValues: T, oldValues: T) => void,
  options?: WatchOptions
): WatchStopHandle

// Type for watch sources
type WatchSource<T> = Ref<T> | (() => T)
```

## Parameters

- `source`: A reactive reference or a getter function that returns a value to watch.
- `callback`: A function that receives the new value(s), old value(s), and an optional `onCleanup` function (see Cleanup Function example below).
- `options`: Optional configuration object:
  - `immediate?: boolean`: If `true`, the callback is called immediately with the current value. Default: `false`.
  - `deep?: boolean`: If `true`, performs deep traversal on objects for dependency tracking and deep comparisons. Default: `true`.
  - `onTrack?`: Debug callback for when dependencies are tracked.
  - `onTrigger?`: Debug callback for when the watcher is triggered.

## Return Value

Returns a function that stops the watcher when called:

```ts
type WatchStopHandle = () => void
```

## Examples

### Watching a Ref

```ts
import { ref, watch } from '@yiin/reactive-proxy-state';

const count = ref(0);

watch(count, (newValue, oldValue) => {
  console.log(`Count changed from ${oldValue} to ${newValue}`);
});

count.value = 1;
// Output: Count changed from 0 to 1
```

### Watching a Getter

```ts
import { reactive, watch } from '@yiin/reactive-proxy-state';

const user = reactive({
  firstName: 'John',
  lastName: 'Doe'
});

// Watch a specific derived value
watch(
  () => `${user.firstName} ${user.lastName}`,
  (newName, oldName) => {
    console.log(`Name changed from "${oldName}" to "${newName}"`);
  }
);

user.firstName = 'Jane';
// Output: Name changed from "John Doe" to "Jane Doe"
```

### Watching a Reactive Object

```ts
import { reactive, watch } from '@yiin/reactive-proxy-state';

const user = reactive({
  name: 'John',
  age: 30,
  address: {
    city: 'New York',
    zip: '10001'
  }
});

// By default, deep: true - so it watches nested properties
watch(user, (newUser, oldUser) => {
  console.log('User changed:', newUser, oldUser);
  // Note: When watching a reactive object deeply,
  // newUser and oldUser will be the same object reference.
  // The callback triggers because a mutation occurred *within* the object.
});

user.address.city = 'Boston';
// Triggers callback, deep changes are detected
```

### Shallow Watching

```ts
import { reactive, watch } from '@yiin/reactive-proxy-state';

const user = reactive({
  name: 'John',
  address: {
    city: 'New York'
  }
});

// With deep: false, only watches top-level properties
watch(
  user,
  (newUser, oldUser) => {
    console.log('User changed:', newUser, oldUser);
  },
  { deep: false }
);

// This won't trigger the callback
user.address.city = 'Boston';

// This will trigger the callback (top-level property)
user.name = 'Jane';
```

### Immediate Execution

```ts
import { ref, watch } from '@yiin/reactive-proxy-state';

const count = ref(0);

watch(
  count,
  (newValue, oldValue) => {
    console.log(`Count is ${newValue} (was ${oldValue})`);
  },
  { immediate: true }
);
// Output: Count is 0 (was undefined)

count.value = 1;
// Output: Count is 1 (was 0)
```

### Watching Multiple Sources

```ts
import { ref, watch } from '@yiin/reactive-proxy-state';

const firstName = ref('John');
const lastName = ref('Doe');

watch(
  [firstName, lastName],
  ([newFirstName, newLastName], [oldFirstName, oldLastName]) => {
    console.log(
      `Name changed from ${oldFirstName} ${oldLastName} to ${newFirstName} ${newLastName}`
    );
  }
);

firstName.value = 'Jane';
// Output: Name changed from John Doe to Jane Doe
```

### Watching Collections (Map, Set, Array)

```ts
import { reactive, watch } from '@yiin/reactive-proxy-state';

const state = reactive({
  items: ['apple', 'banana'],
  preferences: new Map([['theme', 'dark']]),
  activeIds: new Set([1, 2])
});

watch(
  () => state.items,
  (newItems, oldItems) => {
    console.log('Items changed:', newItems, oldItems);
    // Note: With deep: true (default), this triggers on internal mutations (like push).
    // In that case, newItems and oldItems will be the same Array instance.
  },
  { deep: true } // Explicitly showing default for clarity
);

watch(
  () => state.preferences,
  (newPrefs, oldPrefs) => {
    console.log('Preferences changed:', newPrefs, oldPrefs);
    // Similarly, for Maps, newPrefs and oldPrefs will be the same Map instance
    // when triggered by internal changes (like set, delete).
  },
  { deep: true }
);

watch(
  () => state.activeIds,
  (newIds, oldIds) => {
    console.log('Active IDs changed:', newIds, oldIds);
    // And for Sets, newIds and oldIds will be the same Set instance
    // when triggered by internal changes (like add, delete).
  },
  { deep: true }
);

state.items.push('orange');        // Triggers items watcher
state.preferences.set('lang', 'en'); // Triggers preferences watcher
state.activeIds.add(3);            // Triggers activeIds watcher
```

### Stopping a Watcher

```ts
import { ref, watch } from '@yiin/reactive-proxy-state';

const count = ref(0);

const stop = watch(count, (newValue) => {
  console.log(`Count is now: ${newValue}`);
});

count.value = 1;
// Output: Count is now: 1

// Stop watching
stop();

count.value = 2;
// No output - the watcher is stopped
```

### Cleanup Function

The watch `callback` receives an `onCleanup` function as its third argument. This can be used to register a function that will be called when the watched source changes again, or when the watcher is stopped. This is useful for cleaning up side effects, like cancelling pending asynchronous requests.

```ts
import { ref, watch } from '@yiin/reactive-proxy-state';

const id = ref(1);

const stop = watch(id, async (newId, oldId, onCleanup) => {
  const controller = new AbortController();
  const { signal } = controller;

  // Register the cleanup function to abort the request if
  // id changes again before this fetch completes, or if the watch stops.
  onCleanup(() => {
    console.log(`Cleanup: Aborting fetch for ID ${newId}`);
    controller.abort();
  });

  try {
    console.log(`Fetching data for ID ${newId}...`);
    const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${newId}`, { signal });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Data for ID ${newId}:`, data.title);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`Fetch aborted for ID ${newId}`);
    } else {
      console.error(`Fetch failed for ID ${newId}:`, error);
    }
  }
});

// Trigger the first fetch
// Output: Fetching data for ID 1...
// Output: Data for ID 1: <todo title>

// Change the ID quickly to trigger cleanup and a new fetch
setTimeout(() => {
  id.value = 2;
  // Output: Cleanup: Aborting fetch for ID 1
  // Output: Fetching data for ID 2...
  // Output: Data for ID 2: <todo title>
}, 100); // Adjust timing if needed

// Later, stop the watcher (which also triggers cleanup if a fetch was pending)
// setTimeout(stop, 500);
```

## When to Use watch vs. watchEffect

- **Use `watch` when:**
  - You need to know the previous value
  - You want to control when the callback is triggered (e.g., not immediately)
  - You're watching specific properties and don't want to react to other changes
  - You need to make side effects conditional on the type of change

- **Use `watchEffect` when:**
  - You just want to run code reactively based on dependencies
  - You don't need to compare old and new values
  - You want automatic dependency tracking
  - You want the effect to run immediately when created

## Notes and Best Practices

1. **Avoiding Infinite Loops**: Be careful not to modify watched values within the callback without some sort of guard condition to prevent infinite loops.

2. **Performance Considerations**: For deep watching of large objects, consider using a more specific getter function to watch only what you need.

3. **Timing of Callbacks**: The watch callback runs synchronously after the value changes. If you need to defer execution, use a custom scheduler.

4. **Dispose Watchers**: Always dispose of watchers when they're no longer needed, especially in component frameworks to prevent memory leaks.

5. **Object References**: When watching reactive objects directly (not via a getter), watch works with the proxy, not the original object. 