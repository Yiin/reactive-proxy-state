import type { StateEvent } from "../types";
export type BridgeMessage = {
    tx: string;
    origin: string;
    event: StateEvent;
};
type OnMessage = (cb: (msg: BridgeMessage, ctx?: any) => void) => () => void;
type Send = (msg: BridgeMessage, ctx?: any) => void;
type Forward = (msg: BridgeMessage, ctx?: any) => void;
/**
 * Create a loop-safe bridge emitter for bi-directional sync.
 * - Tags every message with tx + origin
 * - Mutes emit while applying remote updates
 * - Dedupe by tx using a small LRU
 */
export declare function createBridgeEmitter(opts: {
    id: string;
    apply: (event: StateEvent) => void;
    send: Send;
    onMessage: OnMessage;
    forward?: Forward;
    seenLimit?: number;
}): {
    emit: (event: StateEvent) => void;
    stop: () => void;
    mute: <T>(fn: () => T) => T;
};
/**
 * Renderer-side bridge bound to Electron's ipcRenderer.
 * Keep this generic by accepting a minimal ipcRenderer-like object.
 */
export declare function createRendererBridgeEmitter(opts: {
    id: string;
    channel: string;
    ipcRenderer: {
        send: (channel: string, msg: any) => void;
        on: (channel: string, handler: (event: any, msg: any) => void) => void;
        off: (channel: string, handler: (event: any, msg: any) => void) => void;
    };
    apply: (event: StateEvent) => void;
    seenLimit?: number;
}): {
    emit: (event: StateEvent) => void;
    stop: () => void;
    mute: <T>(fn: () => T) => T;
};
/**
 * Main-process bridge bound to Electron's ipcMain and BrowserWindows.
 * Accepts a provider for windows to avoid importing Electron types.
 */
export declare function createMainBridgeEmitter(opts: {
    id?: string;
    channel: string;
    ipcMain: {
        on: (channel: string, handler: (event: any, msg: any) => void) => void;
        off: (channel: string, handler: (event: any, msg: any) => void) => void;
    };
    windows: () => {
        webContents: {
            id: number;
            send: (channel: string, msg: any) => void;
        };
    }[];
    apply: (event: StateEvent) => void;
    seenLimit?: number;
}): {
    emit: (event: StateEvent) => void;
    stop: () => void;
    mute: <T>(fn: () => T) => T;
};
export {};
