# API Reference

This section provides detailed documentation for all the functions and types exported by the `reactive-proxy-state` library.

## Core APIs

- [`reactive`](/api/reactive) - Create reactive proxy objects
- [`ref`](/api/ref) - Create reactive references for primitive values
- [`computed`](/api/computed) - Create derived reactive state
- [`watchEffect`](/api/watch-effect) - Run and automatically re-run functions when dependencies change
- [`watch`](/api/watch) - Watch specific reactive sources for changes
- [`updateState`](/api/update-state) - Apply state change events to objects

## Helper Functions

- `isRef` - Check if a value is a ref object
- `unref` - Unwrap a ref to get its inner value
- `isReactive` - Check if an object is a reactive proxy
- `isReadonly` - Check if an object is a readonly proxy
- `isComputed` - Check if a value is a computed ref

## Type Definitions

- `Ref<T>` - Type for ref objects
- `ComputedRef<T>` - Type for computed refs
- `WritableComputedRef<T>` - Type for writable computed refs
- `WatchSource<T>` - Type for sources that can be watched
- `WatchEffect` - Type for watch effect handlers
- `WatchOptions` - Type for watch options
- `StateEvent` - Type for state change events 