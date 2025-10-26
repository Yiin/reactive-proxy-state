# Cookbook: Practical Patterns

The snippets in this page are **copy-pasteable** starting points for common scenarios. They are all framework-agnostic vanilla TS/JS and assume you are using the APIs from `@yiin/reactive-proxy-state` 1.x.

> Each snippet is intentionally concise; production code should add error handling and edge-case guards as appropriate.

---

## 1. Off-thread Image Processing (Worker Sync)

An in-browser image editor often needs CPU-intensive work—flattening layers, computing histograms, applying filters—without freezing the UI. We keep a single **reactive document** on the main thread and mirror it inside a Web Worker. Every mutation ships as a tiny `StateEvent`.

```ts
// main.ts  (UI thread)
import { reactive, updateState, StateEvent } from "@yiin/reactive-proxy-state";

const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});

export const doc = reactive(
  {
    layers: [
      { id: 1, pixels: new Uint8ClampedArray() },
      { id: 2, pixels: new Uint8ClampedArray() },
    ],
    activeLayer: 1,
    zoom: 1,
  },
  (ev) => worker.postMessage(ev) // forward every mutation to the worker
);

// Apply mutations coming back from the worker
worker.onmessage = (e: MessageEvent<StateEvent>) => updateState(doc, e.data);

// Receive computed artefacts (e.g. histogram) and render them
worker.addEventListener("message", (e) => {
  if (e.data?.type === "histogram") {
    renderHistogram(e.data.data);
  }
});
```

```ts
// worker.ts
import {
  reactive,
  updateState,
  StateEvent,
  watchEffect,
} from "@yiin/reactive-proxy-state";

const workerDoc = reactive({}, (ev) => self.postMessage(ev)); // send worker-originated changes back

self.onmessage = (e: MessageEvent<StateEvent>) =>
  updateState(workerDoc, e.data);

// Re-compute heavy stuff whenever the document changes
watchEffect(() => {
  const flattened = flattenLayers(workerDoc.layers);
  const histogram = makeHistogram(flattened);
  self.postMessage({ type: "histogram", data: histogram });
});

function flattenLayers(layers: any[]) {
  /* heavy pixel blending */
}
function makeHistogram(pixels: Uint8ClampedArray) {
  /* heavy stats */
}
```

**Why this works**  
`StateEvent`s are minimal diffs that move quickly across `postMessage`, while the expensive math lives entirely off the render thread.

---

## 2. Persistent LocalStorage Store

Automatically save the entire state tree to `localStorage` on every mutation and restore it on startup.

```ts
import {
  reactive,
  updateState,
  StateEvent,
  deepClone,
} from "@yiin/reactive-proxy-state";

const STORAGE_KEY = "my-app-state";

// ① Load previous snapshot (if any)
const saved = localStorage.getItem(STORAGE_KEY);
const initial = saved ? JSON.parse(saved) : { todos: [], theme: "light" };

// ② Create reactive store with emitter
export const store = reactive(initial, (ev) => persist(ev));

function persist(ev: StateEvent) {
  // We only need the *final* object; deepClone to avoid mutating proxies
  const snapshot = deepClone(store);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}
```

**Notes**

1. Serialising on every mutation is fine for small/medium trees. For very large trees throttle/debounce `persist`.
2. `deepClone` removes proxy wrappers so the data is safe to serialise.

---

## 3. Time-Travel Undo / Redo

Record `StateEvent`s in two stacks and replay them via `updateState`.

```ts
import { reactive, updateState, StateEvent } from "@yiin/reactive-proxy-state";

const undoStack: StateEvent[] = [];
const redoStack: StateEvent[] = [];

export const doc = reactive({ text: "" }, (ev) => {
  undoStack.push(ev);
  // Clearing redoStack because new branch of history starts
  redoStack.length = 0;
});

export function undo() {
  const last = undoStack.pop();
  if (!last) return;
  // Reverse the change (simple strategy: swap old/new + action)
  const inverse = invertEvent(last);
  redoStack.push(inverse);
  updateState(doc, inverse);
}

export function redo() {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(next);
  updateState(doc, next);
}

function invertEvent(ev: StateEvent): StateEvent {
  switch (ev.action) {
    case "set":
      return { ...ev, newValue: ev.oldValue, oldValue: ev.newValue };
    case "delete":
      return { action: "set", path: ev.path, newValue: ev.oldValue };
    case "array-push":
      return { action: "array-pop", path: ev.path };
    // handle other actions as needed …
    default:
      throw new Error(`Cannot invert ${ev.action}`);
  }
}
```

**Tip** For complex apps you'll likely serialise events to disk and prune history to keep memory usage predictable.

---

## 4. Vue 3 + Electron (Bidirectional Sync)

Use Vue 3 state in components and synchronize with another context (e.g. Electron main) using RPS `StateEvent`s.

Outbound (Vue → main): use `trackVueReactiveEvents` to emit events when Vue state changes.
Inbound (main → Vue): call `updateState(vueState, event)` to apply remote diffs to the Vue proxy.

```ts
// renderer.ts
import { reactive as vueReactive } from 'vue';
import { trackVueReactiveEvents, updateState, StateEvent } from '@yiin/reactive-proxy-state';

const { ipcRenderer } = window.require?.('electron') ?? {};

export const state = vueReactive({
  todos: [],
  user: { name: 'Alice' },
  prefs: new Map([["theme", "light"]])
});

// Vue -> main
const stop = trackVueReactiveEvents(state, (ev: StateEvent) => ipcRenderer?.send('state:mutation', ev));

// main -> Vue
ipcRenderer?.on('state:mutation', (_evt: any, ev: StateEvent) => updateState(state, ev));
```

```vue
<!-- Example.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { state } from './renderer';

const todoCount = computed(() => state.todos.length);
function addTodo(title: string) {
  state.todos.push({ title, done: false });
}
</script>

<template>
  <div>
    <p>{{ todoCount }} items</p>
  </div>
</template>
```

Notes

- Array diffs are emitted as index `set`s plus a `length` update. `updateState` applies them correctly.
- For Maps/Sets, events use `map-set`/`map-delete` and `set-add`/`set-delete`.
- No granular array ops are emitted (like `array-splice`); Vue’s public reactivity does not surface such triggers directly.

---

### Where to go from here

- Share your own patterns in issues/PRs – the cookbook is intended to grow.
- Combine patterns: e.g. worker sync **plus** localStorage persistence for offline-first behaviour.
