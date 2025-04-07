# reactive

Creates a reactive proxy around an object, making it reactive. Accessing properties on the reactive object will be tracked, and mutating the object will trigger any effects that depend on those properties.

## Signatures

```ts
// Basic usage
function reactive<T extends object>(target: T): T

// With event emitter for state synchronization
function reactive<T extends object>(
  target: T,
  emit: (event: StateEvent) => void
): T
```

## Parameters

- `target`: The object to make reactive.
- `emit`: An optional callback function that receives state change events (`StateEvent`) whenever the reactive object or its nested properties/collections are mutated. This is key for state replication.

## Return Value

Returns a proxy that intercepts operations on the original object. The proxy behaves like the original object but with reactivity tracking. The reactivity is deep by default, meaning nested objects are also made reactive.

## Type Declarations

```ts
// Event emitted when state changes
interface StateEvent {
  action: 'set' | 'delete' | 'set-add' | 'set-delete' | 'map-set' | 'array-splice';
  path: (string | number)[]; // Path to the target property/collection
  newValue?: any; // Value for 'set', 'map-set'
  oldValue?: any; // Previous value (if applicable)
  value?: any;    // Value for 'set-add', 'set-delete'
  key?: number;   // Index/key for 'map-set', 'array-splice'
  deleteCount?: number; // For 'array-splice'
  items?: any[];  // For 'array-splice'
}

// Emit function type
type EmitFunction = (event: StateEvent) => void
```

## Examples

### Basic Usage

```ts
import { reactive, watchEffect } from '@yiin/reactive-proxy-state';

const user = reactive({
  name: 'Alice',
  age: 30
});

watchEffect(() => {
  console.log(`User is ${user.name}, age ${user.age}`);
});
// Output: User is Alice, age 30

// Updating a property triggers the effect
user.age = 31;
// Output: User is Alice, age 31

user.name = 'Bob';
// Output: User is Bob, age 31
```

### Event Emission

You can track all state changes by providing an emit callback:

```ts
import { reactive, updateState } from '@yiin/reactive-proxy-state';

// Create an array to store state events
const stateEvents = [];

// Create a reactive object with event tracking
const state = reactive(
  {
    count: 0,
    user: { name: 'Alice' },
    items: ['apple', 'banana'],
    preferences: new Map([['theme', 'dark']]),
    tags: new Set(['important'])
  },
  (event) => {
    console.log('State changed:', event);
    stateEvents.push(event);
  }
);

// Each mutation will emit an event
state.count = 1;
// Event: { action: 'set', path: ['count'], oldValue: 0, newValue: 1 }

state.user.name = 'Bob';
// Event: { action: 'set', path: ['user', 'name'], oldValue: 'Alice', newValue: 'Bob' }

state.items.push('orange');
// Event: { action: 'set', path: ['items', '2'], newValue: 'orange' }

state.preferences.set('language', 'en');
// Event: { action: 'set', path: ['preferences', 'language'], newValue: 'en' }

state.tags.add('urgent');
// Event: { action: 'set-add', path: ['tags'], value: 'urgent' }
```

### Syncing State Between Instances

You can use event emission and [`updateState`](/api/update-state) together to synchronize state changes between different instances:

```ts
import { reactive, updateState } from '@yiin/reactive-proxy-state';

// Create a secondary state that will be kept in sync
const secondaryState = { count: 0, user: { name: 'Alice' } };

// Create primary state with event tracking
const primaryState = reactive(
  { count: 0, user: { name: 'Alice' } },
  (event) => {
    // Apply the same change to secondary state
    updateState(secondaryState, event);
  }
);

// Mutate the primary state
primaryState.count = 1;
primaryState.user.name = 'Bob';

// The changes are automatically applied to the secondary state
console.log(secondaryState.count); // 1
console.log(secondaryState.user.name); // 'Bob'
```

### State Synchronization Across Contexts

Event emission enables powerful state synchronization patterns, like syncing state between a main thread and a Web Worker. The `emit` function captures changes that can be sent elsewhere.

```ts
// In main thread
import { reactive, updateState } from '@yiin/reactive-proxy-state';

const worker = new Worker('worker.js');

// Create a state that emits events to the worker
const state = reactive(
  { count: 0, messages: [] },
  (event) => {
    console.log('Main: Sending event to worker ->', event);
    // Send the raw event data to the worker
    worker.postMessage({ type: 'STATE_CHANGE', event });
  }
);

// --- Receiving changes FROM worker ---
// Note: Applying changes received from another context back into the *same*
// reactive object that emits changes requires careful handling to prevent
// infinite loops (A -> B -> A -> ...).
// A common pattern is to apply incoming changes to a separate, non-reactive
// mirror of the state, or use updateState directly on the target data if
// the goal is one-way synchronization (e.g., UI updates based on worker state).

// Example of receiving data (assuming worker sends updates)
worker.addEventListener('message', (e) => {
  if (e.data.type === 'WORKER_UPDATE') {
    console.log('Main: Received data from worker:', e.data.payload);
    // Here you might update UI or a *different* state object
    // updateState(state, ...) // <-- Be cautious applying back to the emitting 'state'
  }
});

// Mutate state in main thread, triggering emit -> postMessage
state.count++;
state.messages.push('Hello from main');


// In worker.js
import { updateState } from '@yiin/reactive-proxy-state';

// Local non-reactive copy of state in the worker
let workerState = { count: 0, messages: [] };

self.addEventListener('message', (e) => {
  if (e.data.type === 'STATE_CHANGE') {
    console.log('Worker: Received event from main ->', e.data.event);
    // Apply changes from main thread to the worker's local state
    updateState(workerState, e.data.event);
    console.log('Worker: State updated:', workerState);

    // Example: Worker sends back some data (not a direct state event)
    if (workerState.count > 1) {
      self.postMessage({ type: 'WORKER_UPDATE', payload: { message: 'Count exceeded 1' } });
    }
  }
});

// Example: Worker updating its own state and notifying main thread
// (This part depends on the application logic - not directly tied to receiving events)
function updateStateFromWorker() {
  const event = {
    action: 'set',
    path: ['messages'],
    // Note: Directly creating events requires knowing the exact structure.
    // Usually, the worker would manage its own reactive state if needed.
    newValue: [...workerState.messages, 'Update from worker']
  };

  // Apply locally
  updateState(workerState, event);

  // Send the change back to main thread *if needed by the application*
  // self.postMessage({ type: 'STATE_CHANGE', event }); // <-- Be careful not to create loops!
}
```

## Nested Objects

Nested objects are automatically made reactive:

```ts
const state = reactive({
  user: {
    name: 'Alice',
    address: {
      city: 'New York',
      zip: '10001'
    }
  }
});

watchEffect(() => {
  console.log(`${state.user.name} lives in ${state.user.address.city}`);
});
// Output: Alice lives in New York

// Updating a nested property triggers the effect
state.user.address.city = 'Boston';
// Output: Alice lives in Boston
```

## Collections (Map and Set)

Maps and Sets are also handled reactively:

```ts
const state = reactive({
  userMap: new Map([
    ['alice', { role: 'admin' }],
    ['bob', { role: 'user' }]
  ]),
  activeUsers: new Set(['alice'])
});

watchEffect(() => {
  console.log('Admin users:', 
    Array.from(state.userMap.entries())
      .filter(([_, data]) => data.role === 'admin')
      .map(([name]) => name)
  );
  console.log('Active users:', Array.from(state.activeUsers));
});
// Output: Admin users: ['alice']
// Output: Active users: ['alice']

// Map methods trigger the effect
state.userMap.set('charlie', { role: 'admin' });
// Output: Admin users: ['alice', 'charlie']
// Output: Active users: ['alice']

// Set methods trigger the effect
state.activeUsers.add('bob');
// Output: Admin users: ['alice', 'charlie']
// Output: Active users: ['alice', 'bob']
```

## Helper Function

```ts
function isReactive(value: unknown): boolean
```

Checks if an object is a reactive proxy created with `reactive()`.

### Example

```ts
import { reactive, isReactive } from '@yiin/reactive-proxy-state';

const original = { count: 0 };
const observed = reactive(original);

console.log(isReactive(observed)); // true
console.log(isReactive(original)); // false
```

## Limitations

1. **Destructuring Loses Reactivity**: When you destructure reactive objects, the connection to the reactive system is lost.
2. **Primitive Values**: You can't make primitive values reactive with `reactive()`. Use `ref()` for that.
3. **Non-extensible Objects**: Objects that are frozen, sealed, or have preventExtensions cannot be made fully reactive.
4. **Property Deletion**: Although deleting properties works with reactive, it's generally better to set to undefined for more predictable reactivity behavior.

## Advanced Usage

### Custom Event Processing

You can process or filter events before passing them to other systems:

```ts
import { reactive, updateState } from '@yiin/reactive-proxy-state';

const state = reactive(
  { count: 0, _private: 'internal' },
  (event) => {
    // Skip events for properties starting with _
    if (event.path[0].toString().startsWith('_')) {
      return;
    }
    
    // Log other events
    console.log('Public state changed:', event);
    
    // Send to server
    sendToServer(event);
  }
);

state.count = 1; // Triggers emit function
state._private = 'hidden'; // Filtered out by the emit function
```

## Related

- [`updateState`](/api/update-state) - Used to apply state events to synchronize different instances 