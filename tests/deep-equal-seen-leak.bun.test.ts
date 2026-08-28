import { describe, test, expect } from 'bun:test'
import { reactive, watch, toRaw, deepEqual } from '../src/index'
import { globalSeen } from '../src/utils'

/**
 * Regression: deepEqual used the shared `globalSeen` WeakMap as its default
 * cycle-detection scratchpad and never deleted its entries. Deep watcher
 * comparisons (watch.ts calls deepEqual without the third argument) therefore
 * inserted proxy -> compared-tree pairs into globalSeen on every cycle.
 * WeakMap values are strong references, so each entry pinned the whole
 * compared (old) state tree for as long as the proxy key lived — the
 * production leak (10.75M entries after ~20h).
 *
 * On top of the leak, the scratch entries poisoned wrapper identity:
 * wrapSet/wrapMap/wrapArray/reactive do `globalSeen.has(x)` lookups, and a
 * scratch entry made them return a comparison partner that is NOT a wrapper.
 *
 * The fix: deepEqual's default `seen` is a fresh WeakMap per call.
 */

describe('deepEqual does not pollute the shared identity map', () => {
  test('plain-tree comparison leaves no scratch entries in globalSeen', () => {
    const a = { nested: { x: 1 }, list: [{ y: 2 }] }
    const b = { nested: { x: 1 }, list: [{ y: 2 }] }

    expect(deepEqual(a, b)).toBe(true)

    // deepEqual's scratch entries are keyed by the `a` side. None of them
    // may land in the shared identity map.
    expect(globalSeen.has(a)).toBe(false)
    expect(globalSeen.has(a.nested)).toBe(false)
    expect(globalSeen.has(a.list)).toBe(false)
    expect(globalSeen.has(a.list[0])).toBe(false)
    expect(globalSeen.has(b)).toBe(false)
  })

  test('compared objects still get a real wrapper when wrapped afterwards', () => {
    const a = { nested: { x: 1 } }
    const b = { nested: { x: 1 } }

    deepEqual(a, b)

    // Before the fix, deepEqual left globalSeen[a] = b, so reactive(a)
    // returned b — a comparison partner that is not a wrapper.
    const proxyA = reactive(a)
    expect(proxyA).not.toBe(b as any)
    expect((proxyA as any).__v_isReactive).toBe(true)
    expect(toRaw(proxyA)).toBe(a)

    const proxyB = reactive(b)
    expect((proxyB as any).__v_isReactive).toBe(true)
    expect(toRaw(proxyB)).toBe(b)
  })

  test('deep watcher comparisons leave no scratch entries in globalSeen', () => {
    const raw = {
      accounts: {
        '1': { villages: [{ settings: { buildPlan: [] as any[] } }] },
      },
    }
    const state = reactive(raw)

    let callbackCount = 0
    const stop = watch(state, () => { callbackCount++ })

    // Each mutation triggers a deep watcher comparison between the live proxy
    // tree and the previous deep clone — the exact leak path from production.
    for (let cycle = 0; cycle < 50; cycle++) {
      state.accounts['1'].villages[0].settings.buildPlan.push({ targetLevel: cycle })
    }
    expect(callbackCount).toBe(50)

    // globalSeen keys are always raw objects (identity: raw -> proxy).
    // A proxy key means deepEqual scratch leaked into the identity map.
    expect(globalSeen.has(state)).toBe(false)
    expect(globalSeen.has(state.accounts)).toBe(false)
    expect(globalSeen.has(state.accounts['1'])).toBe(false)
    expect(globalSeen.has(state.accounts['1'].villages[0])).toBe(false)
    expect(globalSeen.has(state.accounts['1'].villages[0].settings.buildPlan)).toBe(false)

    // The legitimate identity mappings are untouched.
    expect(globalSeen.get(toRaw(state))).toBe(state)
    expect(globalSeen.get(toRaw(state.accounts['1'].villages[0]))).toBe(
      state.accounts['1'].villages[0],
    )

    stop()
  })

  test('comparison partners stay collectible after deep watcher cycles', () => {
    const raw = { items: [{ value: 0 }] }
    const state = reactive(raw)

    let observed: WeakRef<object> | null = null
    const stop = watch(state, (_newValue, oldValue) => {
      // Keep only a weak reference to the FIRST compared tree, so the test
      // itself retains nothing. Before the fix, the first comparison wrote
      // globalSeen[rootProxy] = this tree (a strong value) and the stale-hit
      // early return on later cycles never overwrote it, pinning the whole
      // old tree for as long as the root proxy lived.
      if (!observed) observed = new WeakRef(oldValue as object)
    })

    for (let cycle = 1; cycle <= 10; cycle++) {
      state.items[0].value = cycle
    }

    // The watcher itself has moved on to a newer clone, so nothing
    // legitimately keeps the first compared tree alive.
    stop()
    Bun.gc(true)

    expect(observed!.deref()).toBeUndefined()
  })
})
