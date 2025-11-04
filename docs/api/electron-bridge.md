# Electron Bridge (Loop-Safe Bi-Directional Sync)

The Electron bridge provides a simple, loop-safe pattern to bi-directionally sync state between the Electron main process and renderer processes while preventing infinite update loops.

It tags outbound messages with a transaction id (`tx`) and `origin`, mutes the bridge during remote applies, and deduplicates already-seen messages. Local reactivity still runs because we apply updates on the reactive targets; only the cross-process emit is muted.

## When To Use

- Main: Reactive state created with `reactive(obj, emit)` that should be synced to renderers.
- Renderer: Vue 3 state (or any object) observed via `trackVueReactiveEvents`, synced to main and other windows.

## API

### `createBridgeEmitter(options)`

Generic, transport-agnostic bridge.

```ts
import type { StateEvent } from '@yiin/reactive-proxy-state';

type BridgeMessage = { tx: string; origin: string; event: StateEvent };

function createBridgeEmitter(options: {
  id: string;                          // unique id for this node ('main', 'renderer-12', ...)
  apply: (event: StateEvent) => void;   // apply incoming events to local state
  send: (msg: BridgeMessage, ctx?: any) => void;        // send over transport
  onMessage: (cb: (msg: BridgeMessage, ctx?: any) => void) => () => void; // subscribe; return unsubscribe
  forward?: (msg: BridgeMessage, ctx?: any) => void;    // optional rebroadcast hook (e.g., main → other renderers)
  seenLimit?: number;                  // LRU size for dedupe (default 1000)
}): { emit: (e: StateEvent) => void; stop: () => void; mute: <T>(fn: () => T) => T }
```

- `emit(event)` — pass to `reactive(..., emit)` or `trackVueReactiveEvents(..., emit)`.
- `stop()` — unsubscribe from the underlying transport.
- `mute(fn)` — run a block while suppressing emits (useful for applying bulk snapshots).

### `createRendererBridgeEmitter(options)`

Renderer-side adapter for `ipcRenderer`.

```ts
function createRendererBridgeEmitter(options: {
  id: string; // e.g., `renderer-${ipcRenderer.id}`
  channel: string; // IPC channel name (e.g., 'rps:update')
  ipcRenderer: {
    send: (channel: string, msg: any) => void;
    on: (channel: string, handler: (event: any, msg: any) => void) => void;
    off: (channel: string, handler: (event: any, msg: any) => void) => void;
  };
  apply: (event: StateEvent) => void;
  seenLimit?: number;
}): { emit, stop, mute }
```

### `createMainBridgeEmitter(options)`

Main-process adapter for `ipcMain` and window broadcasting.

```ts
function createMainBridgeEmitter(options: {
  id?: string; // default 'main'
  channel: string; // IPC channel name
  ipcMain: {
    on: (channel: string, handler: (event: any, msg: any) => void) => void;
    off: (channel: string, handler: (event: any, msg: any) => void) => void;
  };
  windows: () => { webContents: { id: number; send: (channel: string, msg: any) => void } }[];
  apply: (event: StateEvent) => void;
  seenLimit?: number;
}): { emit, stop, mute }
```

## Usage

### Renderer (Vue 3 state → events)

```ts
// renderer.ts
import { ipcRenderer } from 'electron';
import { updateState, trackVueReactiveEvents } from '@yiin/reactive-proxy-state';
import { createRendererBridgeEmitter } from '@yiin/reactive-proxy-state';

const CHANNEL = 'rps:update';
const RENDERER_ID = `renderer-${ipcRenderer.id}`;
const vueState = /* your Vue reactive object */ {} as any;

const bridge = createRendererBridgeEmitter({
  id: RENDERER_ID,
  channel: CHANNEL,
  ipcRenderer,
  apply: (event) => updateState(vueState, event),
});

// Emit Vue mutations as StateEvents
const stopVue = trackVueReactiveEvents(vueState, bridge.emit, {
  // If main sends the first snapshot, set this to false
  emitInitialReplace: true,
});

// Later: stopVue(); bridge.stop();
```

### Main (RPS state ↔ renderers)

```ts
// main.ts
import { BrowserWindow, ipcMain } from 'electron';
import { reactive, updateState, deepClone, toRaw } from '@yiin/reactive-proxy-state';
import { createMainBridgeEmitter } from '@yiin/reactive-proxy-state';

const CHANNEL = 'rps:update';
const mainState = reactive({ /* initial */ }, /* emit wired by bridge */);

const bridge = createMainBridgeEmitter({
  channel: CHANNEL,
  ipcMain,
  windows: () => BrowserWindow.getAllWindows(),
  apply: (event) => updateState(mainState, event),
});

// Optionally push an initial snapshot to all renderers
const initial = {
  tx: 'init-' + Date.now(),
  origin: 'main',
  event: { action: 'replace', path: [], newValue: deepClone(toRaw(mainState)) },
};
BrowserWindow.getAllWindows().forEach(w => w.webContents.send(CHANNEL, initial));
```

## How It Avoids Loops

- Scoped mute: While applying remote events (`updateState`) we suppress only the bridge emit; local reactive effects still run.
- Tx + origin: Every message carries `{ tx, origin }`. Receivers ignore own reflections and already-seen txs.
- Dedupe LRU: A small LRU set prevents reprocessing echoed messages.

## Tips

- Use `mute(() => { ...bulk update... })` if you need to apply multiple events or a snapshot locally without emitting.
- Keep `seenLimit` reasonably bounded for long-lived processes.
- Apply events to reactive targets (not raw) so your local UI/effects update.
- With Vue, prefer `flush: 'sync'` in `trackVueReactiveEvents` if you need immediate main sync.

