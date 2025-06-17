# markRaw

Marks an object so that the reactivity system **skips** it entirely. The object will be returned as-is from `reactive()` and will not be proxied or tracked.

This is identical in spirit to Vue's [`markRaw`](https://vuejs.org/api/reactivity-advanced.html#markraw) utility and is useful whenever you need to store opaque or performance-sensitive objects (DOM nodes, class instances, third-party library objects, large immutable data blobs, etc.) inside a reactive tree.

## Signature

```ts
function markRaw<T extends object>(obj: T): T;
```

## Parameters

- `obj` – The object that should remain raw / non-reactive.

## Return value

Returns the same object, now flagged to be ignored by the reactivity system.

## Usage

```ts
import { reactive, markRaw, isReactive } from "@yiin/reactive-proxy-state";

const socket = markRaw(new WebSocket("wss://example.com"));

const state = reactive({
  count: 0,
  connection: socket, // stays raw – no proxy!
});

console.log(isReactive(state.connection)); // false

// Mutating the raw object will **not** trigger reactivity
state.connection.customField = 123; // no reactive effects run
```

## Caveats

1. **No Tracking:** Because the object is never proxied, reads/writes on it will not be tracked. Reactive effects depending on these properties will **not** rerun.
2. **Deep Skipping:** The skip flag is _not_ inherited. If you nest reactive objects _inside_ a raw object, they will still become reactive when wrapped separately.
3. **Immutability of the Flag:** The internal `__v_skip` flag is non-enumerable and non-configurable. Do not attempt to remove it.

---

See also: [`reactive`](/api/reactive) for creating reactive objects, [`updateState`](/api/update-state) for applying mutation events.
