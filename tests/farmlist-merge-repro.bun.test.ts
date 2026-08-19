/**
 * Reproduction: spreading a reactive proxy and assigning back causes
 * linear performance degradation per cycle.
 *
 * Pattern from production (mirror.ts mergeFarmLists):
 *   const existing = farmLists[idx]        // reactive proxy
 *   const merged = { ...existing, ... }    // spread creates plain obj with proxy refs
 *   farmLists[idx] = merged                // set trap stores obj with nested proxies
 *
 * On next access, the get trap wraps `merged.slots` (already a proxy)
 * in ANOTHER proxy, creating unbounded nesting. Each cycle adds a
 * layer, making deepEqual/evictDeep/get progressively slower.
 *
 * Observed in production: 2.9ms → 41.5ms in 20 cycles (14x),
 * 106ms → 21,000ms over ~23 hours.
 *
 * Run: bun test tests/farmlist-merge-repro.bun.test.ts
 */
import { describe, test, expect, beforeEach } from 'bun:test'
import { reactive, getProxyStats, resetProxyStats } from '../src'

// ---------------------------------------------------------------------------
// Fixtures matching production farm list shape
// ---------------------------------------------------------------------------

function createSlot(id: number) {
  return {
    id,
    target: { id: id * 100, mapId: 90000 + id, x: -28, y: -40, name: `Village ${id}`, type: 1, population: 500 },
    troop: { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0, t6: 20, t7: 0, t8: 0, t9: 0, t10: 0 },
    distance: 7.2,
    isActive: true,
    isRunning: true,
    isSpying: false,
    runningAttacks: 5,
    nextAttackAt: Date.now() + 5000,
    lastRaid: {
      reportObjectId: `116${id}`,
      authKey: '|abc',
      time: Date.now() - 100,
      raidedResources: { lumber: 50, clay: 60, iron: 70, crop: 80 },
      bootyMax: 1600,
      icon: 1,
    },
    totalBooty: { booty: 50000, raids: 120 },
  }
}

function createFarmList(id: number, slotCount: number) {
  return {
    id,
    name: `List ${id}`,
    enabled: true,
    hasStartButton: true,
    villageId: 100,
    lastUpdated: Date.now(),
    slots: Array.from({ length: slotCount }, (_, i) => createSlot(id * 1000 + i)),
    targets: Array.from({ length: slotCount }, () => ({ x: 0, y: 0, type: 0 })),
    ownerVillageTroops: { t1: 1200, t2: 0, t3: 58, t4: 80, t5: 0, t6: 1011, t7: 137, t8: 200, t9: 0, t10: 0 },
    defaultTroop: { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0, t6: 0, t7: 0, t8: 0, t9: 0, t10: 0 },
    performanceSnapshots: [{ timestamp: Date.now(), totalBooty: 0, totalRaids: 0, totalBootyMax: 0, activeSlotCount: 0 }],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetProxyStats()
})

describe('spread-assign on reactive proxy causes linear degradation', () => {
  test('6 farm lists (351 slots total): time per cycle grows linearly', () => {
    const state = {
      farmLists: [
        createFarmList(1, 25),
        createFarmList(2, 82),
        createFarmList(3, 77),
        createFarmList(4, 35),
        createFarmList(5, 62),
        createFarmList(6, 70),
      ],
    }
    let events = 0
    const proxy = reactive(state, () => { events++ }) as any

    // Materialize all proxies (simulates initial page load)
    JSON.stringify(proxy)

    const cycleTimes: number[] = []
    const CYCLES = 20

    for (let cycle = 0; cycle < CYCLES; cycle++) {
      events = 0
      const t0 = performance.now()

      // Exact pattern from mirror.ts mergeFarmLists:
      // spread existing reactive entry, overwrite lastUpdated, assign back
      for (let i = 0; i < proxy.farmLists.length; i++) {
        const existing = proxy.farmLists[i]
        const merged = { ...existing, lastUpdated: Date.now() }
        proxy.farmLists[i] = merged
      }

      cycleTimes.push(performance.now() - t0)
    }

    const stats = getProxyStats()
    // Median of the first/last 5 cycles, not single cycles: one GC pause or
    // warmup outlier on a shared CI runner flips a single-cycle ratio past
    // the bound, while real linear degradation (the ~14x bug this guards
    // against) survives any median.
    const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
    const firstMs = median(cycleTimes.slice(0, 5))
    const lastMs = median(cycleTimes.slice(-5))
    const ratio = lastMs / firstMs

    console.log('\n=== Spread-Assign Degradation ===')
    console.log(`  Cycle times: [${cycleTimes.map(t => t.toFixed(1)).join(', ')}]`)
    console.log(`  First: ${firstMs.toFixed(1)}ms, Last: ${lastMs.toFixed(1)}ms`)
    console.log(`  Degradation: ${ratio.toFixed(1)}x over ${CYCLES} cycles`)
    console.log(`  Proxies created: ${stats.created}, evicted: ${stats.staleEvicted}, net: ${stats.created - stats.staleEvicted}`)

    // This SHOULD be < 3x but currently fails — demonstrating the bug
    // The ratio will be ~14x after 20 cycles
    expect(ratio).toBeLessThan(3)
  })

  test('minimal case: single list with 82 slots', () => {
    const state = { lists: [createFarmList(1, 82)] }
    let events = 0
    const proxy = reactive(state, () => { events++ }) as any
    JSON.stringify(proxy)

    const cycleTimes: number[] = []

    for (let cycle = 0; cycle < 30; cycle++) {
      events = 0
      const t0 = performance.now()
      const existing = proxy.lists[0]
      const merged = { ...existing, lastUpdated: Date.now() }
      proxy.lists[0] = merged
      cycleTimes.push(performance.now() - t0)
    }

    const stats = getProxyStats()
    const ratio = cycleTimes[cycleTimes.length - 1] / cycleTimes[0]

    console.log('\n=== Single List Degradation ===')
    console.log(`  Cycle times: [${cycleTimes.map(t => t.toFixed(2)).join(', ')}]`)
    console.log(`  Degradation: ${ratio.toFixed(1)}x over 30 cycles`)
    console.log(`  Proxies created: ${stats.created}, evicted: ${stats.staleEvicted}`)

    expect(ratio).toBeLessThan(3)
  })

  test('without nested objects: no degradation', () => {
    // Control test: flat objects (no slots/targets) should NOT degrade
    const state = {
      farmLists: Array.from({ length: 6 }, (_, i) => ({
        id: i, name: `List ${i}`, enabled: true, lastUpdated: Date.now(),
      })),
    }
    const proxy = reactive(state, () => {}) as any
    JSON.stringify(proxy)

    const cycleTimes: number[] = []

    for (let cycle = 0; cycle < 30; cycle++) {
      const t0 = performance.now()
      for (let i = 0; i < proxy.farmLists.length; i++) {
        const existing = proxy.farmLists[i]
        proxy.farmLists[i] = { ...existing, lastUpdated: Date.now() }
      }
      cycleTimes.push(performance.now() - t0)
    }

    const ratio = cycleTimes[cycleTimes.length - 1] / cycleTimes[0]

    console.log('\n=== Flat Objects (control) ===')
    console.log(`  Cycle times: [${cycleTimes.map(t => t.toFixed(3)).join(', ')}]`)
    console.log(`  Degradation: ${ratio.toFixed(1)}x (should be ~1x)`)

    // Flat objects should not degrade
    expect(ratio).toBeLessThan(3)
  })
})
