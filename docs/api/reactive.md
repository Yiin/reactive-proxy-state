# reactive

Creates a reactive proxy around an object, making it reactive. Accessing properties on the reactive object will be tracked, and mutating the object will trigger any effects that depend on those properties.

## Signatures

```ts
// Basic usage
function reactive<T extends object>(target: T): T;

// With event emitter for state synchronization
function reactive<T extends object>(
  target: T,
  emit: (event: StateEvent) => void
): T;
```

## Parameters

- `target`: The object to make reactive.
- `emit`: An optional callback function that receives state change events (`StateEvent`) whenever the reactive object or its nested properties/collections are mutated. This is key for state replication. **Note:** When an emit function is provided, a 'replace' event is automatically emitted immediately with the initial state.

## Return Value

Returns a proxy that intercepts operations on the original object. The proxy behaves like the original object but with reactivity tracking. The reactivity is deep by default, meaning nested objects are also made reactive.

## Type Declarations

```ts
// Event emitted when state changes
interface StateEvent {
  action:
    | "set"
    | "delete"
    | "array-push"
    | "array-pop"
    | "array-splice"
    | "array-shift"
    | "array-unshift"
    | "map-set"
    | "map-delete"
    | "map-clear"
    | "set-add"
    | "set-delete"
    | "set-clear"
    | "replace";

  // Path to the *collection* that was mutated, or to the parent object for simple set/delete
  path: (string | number)[];

  // Common payload fields (only some will be defined based on action)
  newValue?: any; // For 'set', 'map-set', and 'replace'
  oldValue?: any; // For 'set', 'delete', pop/shift etc.

  // Array & Map specific
  key?: any; // Index for array-splice or Map key for map-set / map-delete

  // Set-specific
  value?: any; // Value added/removed for set-add / set-delete
}

// Emit function type
type EmitFunction = (event: StateEvent) => void;
```

## Examples

### Basic Usage

```ts
import { reactive, watchEffect } from "@yiin/reactive-proxy-state";

const user = reactive({
  name: "Alice",
  age: 30,
});

watchEffect(() => {
  console.log(`User is ${user.name}, age ${user.age}`);
});
// Output: User is Alice, age 30

// Updating a property triggers the effect
user.age = 31;
// Output: User is Alice, age 31

user.name = "Bob";
// Output: User is Bob, age 31
```

### Event Emission

You can track all state changes by providing an emit callback:

```ts
import { reactive } from "@yiin/reactive-proxy-state";

const state = reactive({ count: 0, user: { name: "Alice" } }, (event) => {
  console.log("State changed:", event);
});
// Automatically emits: { action: 'replace', path: [], newValue: { count: 0, user: { name: 'Alice' } } }

// Each mutation will emit an event
state.count = 1;
// Emits: { action: 'set', path: ['count'], oldValue: 0, newValue: 1 }

state.user.name = "Bob";
// Emits: { action: 'set', path: ['user', 'name'], oldValue: 'Alice', newValue: 'Bob' }
```

### Simple State Synchronization

You can use event emission and [`updateState`](/api/update-state) to synchronize state:

```ts
import { reactive, updateState } from "@yiin/reactive-proxy-state";

const targetState = reactive({});

const sourceState = reactive({ count: 0 }, (event) =>
  updateState(targetState, event)
);

// Changes to source automatically sync to target
sourceState.count = 5;
console.log(targetState.count); // 5
```

## Nested Objects

Nested objects are automatically made reactive:

```ts
const state = reactive({
  user: {
    name: "Alice",
    address: {
      city: "New York",
      zip: "10001",
    },
  },
});

watchEffect(() => {
  console.log(`${state.user.name} lives in ${state.user.address.city}`);
});
// Output: Alice lives in New York

// Updating a nested property triggers the effect
state.user.address.city = "Boston";
// Output: Alice lives in Boston
```

## Collections (Map and Set)

Maps and Sets are also handled reactively:

```ts
const state = reactive({
  userMap: new Map([
    ["alice", { role: "admin" }],
    ["bob", { role: "user" }],
  ]),
  activeUsers: new Set(["alice"]),
});

watchEffect(() => {
  console.log(
    "Admin users:",
    Array.from(state.userMap.entries())
      .filter(([_, data]) => data.role === "admin")
      .map(([name]) => name)
  );
  console.log("Active users:", Array.from(state.activeUsers));
});
// Output: Admin users: ['alice']
// Output: Active users: ['alice']

// Map methods trigger the effect
state.userMap.set("charlie", { role: "admin" });
// Output: Admin users: ['alice', 'charlie']
// Output: Active users: ['alice']

// Set methods trigger the effect
state.activeUsers.add("bob");
// Output: Admin users: ['alice', 'charlie']
// Output: Active users: ['alice', 'bob']
```

## Helper Function

```ts
function isReactive(value: unknown): boolean;
```

Checks if an object is a reactive proxy created with `reactive()`.

### Example

```ts
import { reactive, isReactive } from "@yiin/reactive-proxy-state";

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
import { reactive } from "@yiin/reactive-proxy-state";

const state = reactive({ count: 0, _private: "internal" }, (event) => {
  // Skip events for properties starting with _
  if (event.path[0].toString().startsWith("_")) {
    return;
  }

  // Log other events
  console.log("Public state changed:", event);

  // Send to server
  sendToServer(event);
});

state.count = 1; // Triggers emit function
state._private = "hidden"; // Filtered out by the emit function
```

### Complex Synchronization Patterns

For advanced scenarios like Web Worker synchronization, server-client state sync, or multi-context state management, see the [`updateState` documentation](/api/update-state) for detailed examples and patterns.

## Related

- [`updateState`](/api/update-state) - Used to apply state events to synchronize different instances
