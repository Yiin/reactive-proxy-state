# deepToRaw

Recursively converts reactive proxies, refs, Maps/Sets, and arrays into plain JavaScript data. Useful before sending state through `postMessage`, structured cloning, or any channel that cannot serialize proxies.

## Signature

```ts
function deepToRaw<T>(input: T): T;
```

## Notes

- Handles `ref` values by unwrapping `.value`.
- Supports Arrays, Maps, Sets, Dates, and plain objects, preserving circular references.
- Returns a new plain data structure; it does **not** mutate the original value.

## Example: prepare state for workers

```ts
import { reactive, deepToRaw } from "@yiin/reactive-proxy-state";

const state = reactive({
  user: { name: "Ada" },
  prefs: new Map([["theme", "dark"]]),
});

// Send a clone without reactive proxies
worker.postMessage(deepToRaw(state));
```
