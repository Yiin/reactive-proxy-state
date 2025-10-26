# Vue 3 Integration

Observe a Vue 3 reactive object and emit RPS-compatible `StateEvent`s for every mutation. This lets you keep a plain RPS state (in another context/process) in sync using `updateState`.

## Signature

```ts
function trackVueReactiveEvents<T extends object>(
  vueState: T,
  emit: (event: StateEvent) => void,
  options?: { emitInitialReplace?: boolean }
): () => void;
```

## Parameters

- `vueState`: A Vue 3 proxy created by `vue.reactive(...)`.
- `emit`: Callback that receives RPS `StateEvent`s for each Vue-originated change.
- `options.emitInitialReplace` (default `true`): Emit `{ action: 'replace', path: [], newValue: snapshot }` immediately with the current state tree.

## Return Value

Returns a `stop()` function that unsubscribes the internal deep watcher.

## What It Emits

- Objects: `set` and `delete` with full property `path`.
- Arrays: `set` for element indices and a `set` on `length` for grows/shrinks.
- Maps: `map-set`, `map-delete`.
- Sets: `set-add`, `set-delete`.

Notes

- Array diffs are represented by index writes + `length` writes (not `array-push`/`array-splice`). `updateState` understands these and will apply them correctly.
- Map/Set events mirror the action names defined by RPS and are applied via `updateState`.
- Values are deep-cloned before emitting to avoid leaking Vue proxies across contexts.

## Example

```ts
import { reactive as vueReactive } from 'vue';
import { trackVueReactiveEvents, updateState, reactive as rpsReactive, StateEvent } from '@yiin/reactive-proxy-state';

// Vue state (renderer)
const vueState = vueReactive({ todos: [], prefs: new Map([["theme", "light"]]) });

// RPS state (could be in another context)
const remote = rpsReactive({ todos: [], prefs: new Map() });

// Observe Vue and apply changes to RPS
const stop = trackVueReactiveEvents(vueState, (ev: StateEvent) => updateState(remote, ev));

// Later
// stop();
```

## Electron (Renderer) Wiring

```ts
// renderer.ts
import { reactive as vueReactive } from 'vue';
import { trackVueReactiveEvents, updateState, StateEvent } from '@yiin/reactive-proxy-state';

const { ipcRenderer } = window.require?.('electron') ?? {};

export const vueState = vueReactive({
  todos: [],
  user: { name: 'Alice' },
  prefs: new Map([["theme", "light"]])
});

// Vue -> main
const stop = trackVueReactiveEvents(vueState, (ev: StateEvent) => ipcRenderer?.send('state:mutation', ev));

// main -> Vue
ipcRenderer?.on('state:mutation', (_evt: any, ev: StateEvent) => updateState(vueState, ev));
```

## Related

- [`updateState`](/api/update-state) – apply events to any target object (including Vue proxies)
- [`reactive`](/api/reactive) – create RPS proxies that emit `StateEvent`s directly
