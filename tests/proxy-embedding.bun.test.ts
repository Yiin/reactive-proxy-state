/**
 * Regression tests for leak #3 (vangrd heap forensics, 2026-08-30):
 * proxies stored into reactive arrays via push/unshift/splice bypassed
 * unwrapForStore (only the set trap had it), embedding proxies into raw
 * state. Every later read of an embedded proxy minted a NEW proxy around it
 * (globalSeen is keyed by raw objects, so a proxy key misses), growing
 * proxy chains by one layer per write cycle and pinning every replaced
 * state subtree through the live tree.
 *
 * Production pattern (server/src/core/scan/mirror.ts mergeFarmLists):
 *   const existing = farmLists[idx]       // reactive proxy
 *   const merged = { ...existing, ... }   // spread embeds proxies
 *   farmLists.splice(idx, 1, merged)      // stored raw, proxies intact
 *
 * Run: bun test tests/proxy-embedding.bun.test.ts
 */
import { describe, test, expect, beforeEach } from 'bun:test'
import { reactive, toRaw, isReactive, getProxyStats, resetProxyStats } from '../src'
import { ReactiveFlags } from '../src/constants'

beforeEach(() => {
  resetProxyStats()
})

function createSlot(id: number) {
  return {
    id,
    target: { id: id * 100, x: -28, y: -40, name: `Village ${id}` },
    troop: { t1: 0, t6: 20 },
    activeInTravian: true,
    isRunning: false,
    lastRaid: { reportObjectId: `r${id}`, raidedResources: { lumber: 50 } },
    totalBooty: { booty: 500, raids: 12 },
  }
}

function createFarmList(id: number, slotCount: number) {
  return {
    id,
    name: `List ${id}`,
    villageId: 100,
    lastUpdated: Date.now(),
    slots: Array.from({ length: slotCount }, (_, i) => createSlot(id * 1000 + i)),
    targets: Array.from({ length: slotCount }, () => ({ x: 0, y: 0 })),
    defaultTroop: { t1: 0, t6: 0 },
  }
}

/** Assert no proxy is reachable anywhere inside a raw tree. */
function expectNoEmbeddedProxies(value: any, seen = new Set<any>()) {
  if (value === null || typeof value !== 'object') return
  expect(value[ReactiveFlags.IS_REACTIVE]).toBeFalsy()
  if (seen.has(value)) return
  seen.add(value)
  if (value instanceof Date) return
  if (value instanceof Map) {
    for (const v of value.values()) expectNoEmbeddedProxies(v, seen)
    return
  }
  if (value instanceof Set) {
    for (const v of value) expectNoEmbeddedProxies(v, seen)
    return
  }
  for (const key of Object.keys(value)) {
    expectNoEmbeddedProxies(value[key], seen)
  }
}

describe('array mutators never embed proxies into raw state', () => {
  test('push of a reactive value stores the raw object', () => {
    const state = reactive({ items: [] as any[] })
    const child = reactive({ id: 1, nested: { x: 1 } })

    state.items.push(child)

    const rawItems = toRaw(state).items
    expect(rawItems).toHaveLength(1)
    expect(rawItems[0]).toBe(toRaw(child))
  })

  test('unshift and splice store raw objects too', () => {
    const state = reactive({ items: [{ id: 0 }] as any[] })
    const a = reactive({ id: 'a' })
    const b = reactive({ id: 'b' })

    state.items.unshift(a)
    state.items.splice(1, 0, b)

    const rawItems = toRaw(state).items
    expect(rawItems[0]).toBe(toRaw(a))
    expect(rawItems[1]).toBe(toRaw(b))
    expect(rawItems[2]).toEqual({ id: 0 })
  })

  test('push unwraps proxies nested deep inside a plain item', () => {
    // The mirror.ts case: `merged` is a fresh plain object, but spreading a
    // proxy leaves proxy references at arbitrary depth (slots, lastRaid...).
    const state = reactive({ lists: [] as any[] })
    const donor = reactive(createFarmList(1, 2))

    const merged = {
      id: 9,
      slots: donor.slots, // array proxy
      lastRaid: donor.slots[0].lastRaid, // object proxy, two levels deep
    }
    state.lists.push(merged)

    const rawLists = toRaw(state).lists
    expect(isReactive(rawLists[0].slots)).toBe(false)
    expect(isReactive(rawLists[0].slots[0])).toBe(false)
    expect(isReactive(rawLists[0].lastRaid)).toBe(false)
    expect(rawLists[0].slots).toBe(toRaw(donor).slots)
    expect(rawLists[0].lastRaid).toBe(toRaw(donor).slots[0].lastRaid)
  })

  test('map.set / set.add unwrap deep proxies as well', () => {
    const state = reactive({ m: new Map<string, any>(), s: new Set<any>() })
    const donor = reactive({ nested: { x: 1 } })

    state.m.set('k', { payload: donor.nested })
    state.s.add(donor.nested)

    const raw = toRaw(state)
    expect(isReactive(raw.m.get('k').payload)).toBe(false)
    expect(isReactive([...raw.s][0])).toBe(false)
  })
})

describe('identity guard: already-reactive values are never re-wrapped', () => {
  test('reactive() of a reactive value returns the identical proxy', () => {
    const state = reactive({ child: { x: 1 }, list: [1, 2] })
    expect(reactive(state)).toBe(state)
    expect(reactive(state.child)).toBe(state.child)
    expect(reactive(state.list)).toBe(state.list)
  })

  test('re-wrapping through the get trap keeps canonical identity', () => {
    const state = reactive({ farmLists: [createFarmList(1, 3)] })
    const firstRead = state.farmLists[0]
    const secondRead = state.farmLists[0]
    expect(secondRead).toBe(firstRead)
    expect(secondRead.slots).toBe(firstRead.slots)
  })
})

describe('farm-list merge loop (production mirror.ts pattern)', () => {
  test('spread -> splice cycles never embed proxies and never grow chains', () => {
    const state = reactive({ farmLists: [createFarmList(1, 10), createFarmList(2, 10)] })

    const createdAfterWarmup = getProxyStats().created

    const CYCLES = 25
    for (let cycle = 0; cycle < CYCLES; cycle++) {
      for (let i = 0; i < state.farmLists.length; i++) {
        const existing = state.farmLists[i]
        // exact production shape: spread the proxy, overwrite one field,
        // write back via splice
        const merged = { ...existing, lastUpdated: Date.now() }
        state.farmLists.splice(i, 1, merged)
      }
    }

    // 1. The raw state tree contains no proxy anywhere.
    expectNoEmbeddedProxies(toRaw(state))

    // 2. Canonical wrapper identity is stable: two consecutive read passes
    //    after the loop return the same proxy objects — chain depth is 1.
    //    (Cross-cycle identity is not asserted: splice evictDeep over-evicts
    //    aliased subtrees, so wrappers are re-minted once per cycle — churn,
    //    not chains.)
    const firstPass = state.farmLists.map((fl) => fl.slots)
    const secondPass = state.farmLists.map((fl) => fl.slots)
    for (let i = 0; i < firstPass.length; i++) {
      expect(secondPass[i]).toBe(firstPass[i])
    }

    // 3. Wrapper churn is bounded. The spread aliases live raw subtrees into
    //    `merged`, so splice's evictDeep evicts wrappers that are still live
    //    and the next cycle re-mints them: exactly 4 per list per cycle
    //    (merged + slots + targets + defaultTroop). That is GC churn, not a
    //    leak — old wrappers are only ephemeron-referenced and die. The leak
    //    signature was CHAIN growth, ruled out by (1) and (2).
    const churn = getProxyStats().created - createdAfterWarmup
    // +8 slack for one-off wrappers (e.g. the farmLists array itself on the
    // first post-warmup read); the bound is linear with a small constant.
    expect(churn).toBeLessThanOrEqual(CYCLES * 2 * 4 + 8)
  })

  test('push of a spread proxy (list-creation path) stays raw', () => {
    const state = reactive({ farmLists: [createFarmList(1, 4)] })

    for (let cycle = 0; cycle < 10; cycle++) {
      const existing = state.farmLists[state.farmLists.length - 1]
      const merged = { ...existing, id: 100 + cycle, lastUpdated: Date.now() }
      state.farmLists.push(merged)
      state.farmLists.pop()
    }

    expectNoEmbeddedProxies(toRaw(state))
  })
})
