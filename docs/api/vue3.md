# Vue 3 Integration

`trackVueReactiveEvents` watches a Vue 3 `reactive()` object and sends an RPS `StateEvent` for every change made through Vue. Feed the events to `updateState` to keep a plain copy of the state in step, in another process, a worker or on a server.

## Signature

```ts
function trackVueReactiveEvents<T extends object>(
  vueState: T,
  emit: (event: StateEvent) => void,
  options?: {
    emitInitialReplace?: boolean;
    onDiffError?: (context: DiffErrorContext) => void;
  }
): VueTrackingControl;

type VueTrackingControl = { stop(): void; pause(): void; resume(): void };
type DiffErrorContext = { key: string; path: (string | number | symbol)[]; error: unknown };
```

## Parameters

- `vueState`: the object Vue's `reactive()` returned (`shallowReactive()` and `readonly()` work too). It must come from the copy of `@vue/reactivity` this library imports, see [Requirements](#requirements).
- `emit`: gets each event synchronously, inside the write that caused it. Vue tracking is paused while it runs, so reads it makes do not subscribe the tracker to anything.
- `options.emitInitialReplace` (default `true`): first send `{ action: 'replace', path: [], newValue }`, where `newValue` is a copy of the whole state.
- `options.onDiffError`: called when `emit` throws, or when reading the state throws (a getter). `path` is the event's path for an `emit` error, else the path of the object that failed. `key` is the first key of `path`, or `''` when the failure is in the root object.
  - After an `emit` error the tracker goes on and sends the rest of that change.
  - After a read error it rebuilds that object's copy from the current state without events, so that one write is not sent.

## Return value

- `pause()`: stop sending events. Writes made while paused still update the tracker's copy, so they are never sent, and later events compare against the state they left. Use it around writes that came from the other side.
- `resume()`: send events again. It costs nothing.
- `stop()`: stop for good and free every effect. `stop()` is final: a stopped tracker cannot start again, and `pause()` or `resume()` after it only print a warning. Make a new tracker instead.

## Cost

The tracker gives every object, array, Map and Set in the state its own small Vue effect, which reads only that object's own entries. A write runs only the effect of the object it changed, which compares that object's entries with its copy. So a write costs what it changed, not the size of the state, and a paused write costs the same without the events. Storing a new subtree costs one copy of that subtree.

Memory: the tracker holds a plain copy of the state and one effect per object.

## What It Emits

- Objects: `set` for a changed or added key and `delete` for a removed key, with the full `path`. A changed value carries `oldValue`, an added key does not.
- Arrays: compared index by index. A grow sends one `set` per new index and no `length` event, so a replica never has holes. A shrink sends one `set` on `length`.
- A value that changes type (an object to an array, a primitive to an object) sends one `set` with the whole new value. A replaced object with the same content sends nothing.
- Maps: `map-set` and `map-delete` with whole values at the Map's path. A write anywhere inside a Map value sends a `map-set` of that whole value.
- Sets: `set-add` and `set-delete`.

Notes

- Values in events are copies, and a sent event never changes later. Objects in `set` and `delete` events are plain: no class prototype, no symbol keys.
- `NaN` equals `NaN`, so a `NaN` value is sent once.
- One object at two places sends one event per place.
- Write through Vue's proxy. A write to a raw object (`toRaw(x).a = 1`), to the inside of a `markRaw` or frozen object, or a `Date` changed in place (`setTime`) triggers nothing. The tracker sees it the next time the object that holds it changes.
- Set members and Map keys that are objects are compared with copies, so any change to that Set or Map sends them again. Use primitives there.
- A cycle (an object inside itself) is reported through `onDiffError` and not tracked below that point.

## Requirements

- Vue 3.5: the peers are `vue ^3.5.0` and `@vue/reactivity ^3.5.0`.
- One copy of `@vue/reactivity`. The library imports it and does not bundle it. A proxy from another copy would never trigger the tracker, so creation throws a `TypeError` that names the cause. With Vite, set `resolve.dedupe: ['vue', '@vue/reactivity']`. A package manager with an isolated layout (pnpm, `bun install --linker isolated`) needs `@vue/reactivity` as a direct dependency of the app.

## Example

```ts
import { reactive as vueReactive } from 'vue';
import { trackVueReactiveEvents, updateState, reactive as rpsReactive, StateEvent } from '@yiin/reactive-proxy-state';

// Vue state (renderer)
const vueState = vueReactive({ todos: [], prefs: new Map([["theme", "light"]]) });

// RPS state (could be in another context)
const remote = rpsReactive({ todos: [], prefs: new Map() });

// Observe Vue and apply changes to RPS
const tracking = trackVueReactiveEvents(vueState, (ev: StateEvent) => updateState(remote, ev));

// Apply a change from the other side without sending it back
tracking.pause();
try {
  vueState.todos.push({ title: 'from remote' });
} finally {
  tracking.resume();
}

// Later
// tracking.stop();
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
const tracking = trackVueReactiveEvents(vueState, (ev: StateEvent) => ipcRenderer?.send('state:mutation', ev));

// main -> Vue, not sent back
ipcRenderer?.on('state:mutation', (_evt: any, ev: StateEvent) => {
  tracking.pause();
  try {
    updateState(vueState, ev);
  } finally {
    tracking.resume();
  }
});
```

## Related

- [Upgrading to 3.0.0](/guide/upgrading-to-3) – what changed from 2.x
- [`updateState`](/api/update-state) – apply events to any target object (including Vue proxies)
- [`reactive`](/api/reactive) – create RPS proxies that emit `StateEvent`s directly
