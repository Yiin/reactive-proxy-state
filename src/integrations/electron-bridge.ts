import type { StateEvent } from "../types";

export type BridgeMessage = { tx: string; origin: string; event: StateEvent };

type OnMessage = (cb: (msg: BridgeMessage, ctx?: any) => void) => () => void;
type Send = (msg: BridgeMessage, ctx?: any) => void;
type Forward = (msg: BridgeMessage, ctx?: any) => void;

function makeTx(): string {
  try {
    // Web Crypto API in modern runtimes
    const g: any = globalThis as any;
    if (g.crypto && typeof g.crypto.randomUUID === "function") {
      return g.crypto.randomUUID();
    }
  } catch {}
  // Fallback
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * Create a loop-safe bridge emitter for bi-directional sync.
 * - Tags every message with tx + origin
 * - Mutes emit while applying remote updates
 * - Dedupe by tx using a small LRU
 */
export function createBridgeEmitter(opts: {
  id: string;
  apply: (event: StateEvent) => void;
  send: Send;
  onMessage: OnMessage;
  forward?: Forward;
  seenLimit?: number;
}) {
  const { id, apply, send, onMessage, forward, seenLimit = 1000 } = opts;

  let muteCount = 0;
  const mute = <T>(fn: () => T): T => {
    muteCount++;
    try {
      return fn();
    } finally {
      muteCount--;
    }
  };

  // tiny LRU for seen tx ids
  const seen = new Set<string>();
  const order: string[] = [];
  const markSeen = (tx: string) => {
    if (seen.has(tx)) return;
    seen.add(tx);
    order.push(tx);
    if (order.length > seenLimit) {
      const oldest = order.shift()!;
      seen.delete(oldest);
    }
  };

  const emit = (event: StateEvent) => {
    if (muteCount > 0) return; // suppressed during remote apply
    const msg: BridgeMessage = { tx: makeTx(), origin: id, event };
    markSeen(msg.tx); // do not re-handle our own
    send(msg);
  };

  const unsubscribe = onMessage((msg, ctx) => {
    if (!msg || !msg.tx) return;
    if (seen.has(msg.tx)) return; // already processed
    markSeen(msg.tx);
    if (msg.origin === id) return; // ignore reflections

    // Apply locally while muting outbound emission
    mute(() => apply(msg.event));

    // Optional re-broadcast (e.g., main -> other renderers)
    if (forward) forward(msg, ctx);
  });

  const stop = () => unsubscribe();

  return { emit, stop, mute };
}

// ---- Electron adapters (no direct dependency on 'electron') ----

/**
 * Renderer-side bridge bound to Electron's ipcRenderer.
 * Keep this generic by accepting a minimal ipcRenderer-like object.
 */
export function createRendererBridgeEmitter(opts: {
  id: string; // e.g., `renderer-${ipcRenderer.id}`
  channel: string; // e.g., 'rps:update'
  ipcRenderer: {
    send: (channel: string, msg: any) => void;
    on: (channel: string, handler: (event: any, msg: any) => void) => void;
    off: (channel: string, handler: (event: any, msg: any) => void) => void;
  };
  apply: (event: StateEvent) => void;
  seenLimit?: number;
}) {
  const { id, channel, ipcRenderer, apply, seenLimit } = opts;

  return createBridgeEmitter({
    id,
    apply,
    seenLimit,
    send: (msg) => ipcRenderer.send(channel, msg),
    onMessage: (cb) => {
      const handler = (_e: any, msg: any) => cb(msg);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.off(channel, handler);
    },
  });
}

/**
 * Main-process bridge bound to Electron's ipcMain and BrowserWindows.
 * Accepts a provider for windows to avoid importing Electron types.
 */
export function createMainBridgeEmitter(opts: {
  id?: string; // default 'main'
  channel: string; // e.g., 'rps:update'
  ipcMain: {
    on: (channel: string, handler: (event: any, msg: any) => void) => void;
    off: (channel: string, handler: (event: any, msg: any) => void) => void;
  };
  windows: () => { webContents: { id: number; send: (channel: string, msg: any) => void } }[];
  apply: (event: StateEvent) => void;
  seenLimit?: number;
}) {
  const { id = "main", channel, ipcMain, windows, apply, seenLimit } = opts;

  const broadcast = (msg: any, exceptId?: number) => {
    for (const w of windows()) {
      if (exceptId != null && w.webContents.id === exceptId) continue;
      w.webContents.send(channel, msg);
    }
  };

  return createBridgeEmitter({
    id,
    apply,
    seenLimit,
    send: (msg) => broadcast(msg),
    onMessage: (cb) => {
      const handler = (e: any, msg: any) => cb(msg, { senderId: e?.sender?.id });
      ipcMain.on(channel, handler);
      return () => ipcMain.off(channel, handler);
    },
    forward: (msg, ctx) => broadcast(msg, ctx?.senderId),
  });
}

