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

### Paths follow moves

An event's path names where the object is when the event is made. A proxy you keep across a structural change still writes to the right place:

```ts
const state = reactive({ list: [{ id: "A", xp: 0 }, { id: "B", xp: 0 }] }, emit);
const b = state.list[1];
state.list.splice(0, 1); // emits { action: 'array-splice', path: ['list'], key: 0, deleteCount: 1, ... }
b.xp = 12; // emits { action: 'set', path: ['list', '0', 'xp'], ... }
```

- `splice`, `shift`, `unshift`, `pop`, `push`, index writes, `length` writes, whole-array replacement and map or set changes all move the paths of the objects they keep, at any depth.
- `sort`, `reverse`, `fill` and `copyWithin` emit one `replace` event with the array's new contents as `newValue` and the old items as `oldValue`, and return the proxy.
- A proxy whose object left the tree emits nothing. If the object comes back, its proxy emits at the new place.
- An object placed at two places (`list[0] = list[1]`) emits one event per place for each write, because a replica holds a copy at each place. Each place's event gets its own copy of what the write stores (`newValue`, `items`, a `set-add`'s `value`). Each place also gets a snapshot of removed payloads, made before mutation. The places are found when a value is stored (root creation, assignment, insertion, `sort`, `reverse`, `fill`, `copyWithin`), not when it is read.
- An object reachable from two roots emits only to the root it was first read under.
- What a write stores (`newValue`, `items`, a `set-add`'s `value`) is a deep copy made with the event. A later write cannot change it, also in an event that waits in a queue (`{ async: true }`, or your own).
- What a write removes (`oldValue`, `oldValues`, a `set-delete`'s `value`) is a deep copy whenever delivery queues the event. This includes async roots, alias writes, and writes made during an active delivery queue. The snapshot describes the value before mutation, on async and synchronous roots alike: a removed object that reaches the written container holds it as it was before the write. An immediate single-path event sends the removed value itself. An object that has a token of its own in one Set or Map, because another member there carries its usual token (see Collection membership in the upgrade guide), is sent as a copy there, in a removal and as a `map-set` key. Copy it in the listener if you keep it and later write to the objects it holds.
- The initial `replace` of a root is a copy too, one object per place, so a listener may keep it as its replica and apply the later events to it. (1.0.44 sent the object you passed.)
- Except for the array assignment rule below, a copy keeps every own enumerable data property, including symbol properties and properties on Maps, Sets and Dates, and an own `__proto__` key stays an own property. Arrays keep their named (non-index) properties where 1.0.44 sent the value itself: in the initial `replace`, `items`, a set's `value` and what a write removes. An assignment's `newValue` (`set`, `map-set`) keeps each array's items only, as 1.0.44's copy did. A reorder keeps enumerable named and symbol properties of nested arrays. A reordered array keeps its own named properties on a replica, because `updateState` replaces its items in place.
- Copies and the walks that find places keep their own stacks, so a tree of any depth can be stored and written, also under Node's smaller stack. The equality check of an object written over an object still recurses, as in 1.0.44.
- A listener can write to the state. With no event waiting, that write's events are delivered at once, inside the listener call that made the write. While a write delivers several events (the other places of an alias, the new indexes of a longer `length`), a listener's write goes after the events still waiting, and that delivery sends it after the listener returns. So a replica sees the events in the order the state changed, also when the listener writes its own keys (a version stamp) before it applies the event it received. Writing a key before you apply an event that changes the same key sends your replica the two writes in the wrong order. The effects of a listener's write run when the outermost write ends, after the listener returns. A listener that drops the events delivered while it writes (a mute scope) drops them only when nothing waits; write after the listener returns (for example in `queueMicrotask`) to send the same events every time.
- Listener writes are bounded by how deep they nest, not by how many there are. A write made outside a listener sends events of generation 0. A write a listener makes while it receives an event of generation `g` sends events of generation `g + 1`, also when they wait in a queue or reach another root. A listener write of generation 101 is refused before mutation. One listener call that writes uses one round, and all its writes share it. A branching loop (a listener that writes twice for each event) stays shallow, so rounds of generation 2 and deeper also count toward a total of 100,000 per operation. An operation is one write, ref write or trigger made outside listeners, with its delivery and its effects, or one async delivery microtask. After the first refusal, every further listener write of the operation is refused, committed events and waiting effects drain, and the caller gets the `RangeError`, also when an effect or a listener threw too. The next operation starts fresh. A root with `{ async: true }` logs the `RangeError` with `console.error` instead of throwing it from its microtask, where it would end a Node process. Finite fan-out never reaches the bound: a longer `length`, an alias at many places, or many effect writes send one generation-1 round per event. Loops through effects stay bounded by the effect loop limit. See [the upgrade guide](../guide/upgrading-to-3.md#_3-0-8-the-listener-bound-counts-depth) for event-path filters.
- Listener reads do not become dependencies of the effect whose write called the listener. Effects and computed values evaluated inside a listener still track their own reads.
- A listener that throws does not stop the delivery. Every event still waiting under that root is delivered once, each for a write that already changed the state, then the first error reaches the write that started the delivery. A listener can catch the error of a write it made only when nothing waited, so that write delivered its events itself. A root with `{ async: true }` delivers every queued event, including writes made by its listeners, then throws the first error from the microtask; the listener bound's `RangeError` is logged instead (see above).
- A payload copies a shared object once per place, so a graph that shares objects at many places grows exponentially (22 objects, each holding the next twice, become 4,194,303 copies). A payload that would make more than 100,000 copies beyond the first copy of each object (`SNAPSHOT_SHARED_COPY_LIMIT`) throws a `SnapshotLimitError`, a `RangeError`, before anything changes. For a root, `reactive()` throws before it returns a proxy and emits nothing. A write throws with the state, its proxies and their places as they were: no event is sent, no effect runs, and a replica still matches. Each payload counts on its own, and the `items` of one `push`, `unshift` or `splice` are one payload. A queued event copies removed values as `oldValue` or `oldValues`, so removing a part over the limit is refused too: remove it in smaller parts. In a cyclic graph every part can reach the whole graph, so even one property can be too large to remove. An immediate single-path event does not copy what it removes, so it refuses no removal, `Set.delete()` included, with one exception: a member that has a token of its own in its Set or Map (see above) is sent as a copy, so removing it can be refused too. Then rebuild the root: make the state again from new objects without that graph (for example with `structuredClone` of the parts you keep), pass it to `reactive()` with the same emit function, and stop using the old root and its proxies. The new root's first event, a `replace` at the root path, resets every replica. A tree, however large, never hits the limit.
- `splice` normalizes its arguments like `Array.prototype.splice` (fractions, `NaN`, negatives, omitted or `undefined` arguments); the event's `key` and `deleteCount` are the normalized numbers. A `BigInt` or `Symbol` start or count throws a `TypeError` and leaves the array unchanged, like native `splice`.
- A write through a proxy whose object left the tree emits nothing and adds one to `getProxyStats().detachedWrites`.
- A stored value may hold proxies, for example after `{ ...proxy, meta: { ...proxy.meta } }`. The store puts each proxy's raw object in its place, at any depth: data properties of objects and arrays, Map values and Set members (a Set keeps its order). Map keys stay as they are. A sealed object gets the raw object. A frozen object, a read-only property or a getter keeps its proxy, without an error in the ES module or the CommonJS bundle. A read there returns that proxy, never a new one around it, and a write through it reaches every place of the object under the root that proxy belongs to. A Set that holds a proxy and its raw object keeps one member for both, where the first of them was, and its copy in the event does too. A root made without a listener does not walk its initial value, so a proxy in it stays in the raw state.
- `reactive()` of a proxy returns that proxy. It ignores `emit`, sends no `replace`, and the proxy keeps sending events to its own root.

- `sort`, `reverse`, `fill` and `copyWithin` check every index they would write (read-only, a hole in a non-extensible array, a non-configurable delete) before the first write, and throw a `TypeError` with the array unchanged. `fill` and `copyWithin` convert each bound once.
- A payload that reaches back into the object it is written to is copied as it will be after the write; an accessor property there throws an `UnsupportedStateError`, a `TypeError`, before the write.

The supported inputs (data properties, callbacks that do not change their target, numeric bounds), what is refused, and the map and set limits for synchronization are listed in the README under "Synchronization Limits".

When forwarding events across workers or other structured-clone boundaries, convert them first:

```ts
import { reactive, deepToRaw } from "@yiin/reactive-proxy-state";

const state = reactive({ count: 0 }, (event) =>
  worker.postMessage(deepToRaw(event))
);
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

[Upgrading to 2.0.0](/guide/upgrading-to-2) describes the differences from 1.x and collection identity.
