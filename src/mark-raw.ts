import { ReactiveFlags } from './constants';

/**
 * Marks an object so that it will never be converted into a reactive proxy.
 *
 * Similar to Vue's `markRaw`, this is useful when you need to store
 * non-reactive, opaque objects (e.g. DOM nodes, complex class instances,
 * third-party library objects) inside a reactive tree without having them
 * wrapped by the reactivity system.
 */
export function markRaw<T extends object>(obj: T): T {
  if (obj && typeof obj === 'object') {
    // Define the SKIP flag as a non-enumerable, non-writable property so it
    // doesn't interfere with normal iteration or get accidentally removed.
    Object.defineProperty(obj, ReactiveFlags.SKIP, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }
  return obj;
} 