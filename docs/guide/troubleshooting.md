# Troubleshooting & FAQ

A collection of the most common questions and pitfalls when working with **reactive-proxy-state**.

---

## Why doesn't my effect run after I destructure a reactive object?

When you do

```ts
const { count } = state; // state is reactive
watchEffect(() => {
  console.log(count); // NEVER re-runs
});
```

you copy the **value** of `count` at that moment – it's a plain primitive, no longer connected to the proxy. Either:

1. Use a getter function:
   ```ts
   watchEffect(() => console.log(state.count));
   ```
2. Or keep it reactive with `toRefs` / `toRef`:
   ```ts
   const { count } = toRefs(state);
   watchEffect(() => console.log(count.value));
   ```

---

## `watch` callback shows the same object for `newValue` and `oldValue` when I watch an array / Map / Set

`watch` compares **deeply** by default but it still passes the _proxy instance_ to you. Internal mutations (e.g. `push`, `set`, `add`) don't create a new array/collection – they mutate in place – so the reference is identical.

If you need granular diffing:

```ts
watch(
  () => state.items.slice(), // clone on every access
  (newArr, oldArr) => {
    // now references differ – do your diff
  },
  { deep: false } // shallow compare is enough now
);
```

---

## Map/Delete mismatch – should I emit `delete` or `map-delete`?

For operations that originate from a `Map` proxy (`map.set`, `map.delete`, `map.clear`) the wrapper already emits the specialised actions: `map-set`, `map-delete`, `map-clear`. You only use plain `delete` when you remove a _property_ of a normal object.

---

## How do I cancel expensive async work in `watchEffect`?

Pass a cleanup function to the `onCleanup` helper:

```ts
watchEffect((onCleanup) => {
  const ctrl = new AbortController();
  fetch("/api", { signal: ctrl.signal });

  onCleanup(() => ctrl.abort());
});
```

The cleanup runs before the effect re-executes and when it is stopped.

---

## Deep watching is slow for huge objects – what can I do?

1. Watch a getter that returns only the piece you care about.
2. Set `deep: false` and manage nested changes yourself.
3. Rely on collection-specific actions (`array-splice`, `map-set`, etc.) that carry just the diff and apply them with `updateState`.

---

## `isReactive` returns `false` for my Map / Set

Make sure you access the **proxy**, not the original collection:

```ts
const state = reactive({ myMap: new Map() });
console.log(isReactive(state.myMap)); // true
const raw = state.myMap.__v_raw;
console.log(isReactive(raw)); // false
```

---

## Can I turn a reactive object back into its raw form?

Yes – use `toRaw()`:

```ts
const rawUser = toRaw(state.user);
```

The returned object is the original instance; further proxy mutations won't reflect there.

---

## Triggering an update manually

For a `ref`, call `triggerRef(refInstance)`. For objects use normal mutation – there's no public API for force-trigger.

---

## Memory leaks when creating many effects in a loop

Always capture the stop handle and dispose it:

```ts
const stops = list.map((item) => watchEffect(() => doStuff(item)));
// later
stops.forEach((stop) => stop());
```

Computed refs also expose `.stop()` – call it if you create them dynamically.

---

Have another issue? [File an issue](https://github.com/Yiin/reactive-proxy-state/issues) or open a discussion!
