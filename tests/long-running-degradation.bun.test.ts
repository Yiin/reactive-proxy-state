/**
 * Long-running degradation test.
 *
 * Production shows 21-second event loop blocks after ~23 hours but 0ms
 * after restart — with identical memory limits (16 GiB, 43% usage).
 * The 5000-cycle test showed no degradation. This test scales to 100k+
 * cycles and monitors V8 heap/GC behavior to find the accumulation.
 *
 * Run: bun test tests/long-running-degradation.bun.test.ts --timeout 120000
 */
import { describe, test, expect, beforeEach } from 'bun:test'
import { reactive, getProxyStats, resetProxyStats, deepToRaw } from '../src'
import { globalSeen, wrapperCache, pathConcatCache } from '../src/utils'
import type { StateEvent } from '../src/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gc() {
  Bun.gc(true)
}

function fmt(bytes: number) {
  if (Math.abs(bytes) < 1024) return `${bytes} B`
  if (Math.abs(bytes) < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// ---------------------------------------------------------------------------
// State fixtures
// ---------------------------------------------------------------------------

function createStorage() {
  return {
    id: 0, villageId: 0,
    wood: Math.floor(Math.random() * 80000),
    clay: Math.floor(Math.random() * 80000),
    iron: Math.floor(Math.random() * 80000),
    crop: Math.floor(Math.random() * 80000),
    warehouseCapacity: 80000, granaryCapacity: 80000,
    freeCrop: Math.floor(Math.random() * 5000),
    lastUpdated: Date.now(),
  }
}

function createBuilding(location: number) {
  return {
    type: location <= 18 ? (location % 4) + 1 : 10 + location - 18,
    level: Math.floor(Math.random() * 20),
    location,
    isUnderConstruction: false,
  }
}

function createVillage(id: number, accountId: number) {
  const buildings = []
  for (let loc = 1; loc <= 40; loc++) buildings.push(createBuilding(loc))
  return {
    village: { id, accountId, name: `Village ${id}`, x: 10, y: 20, isUnderAttack: false, tribe: 1 },
    storage: createStorage(),
    buildings,
    queueBuildings: [{ id: 1, villageId: id, position: 1, type: 1, level: 11, location: 1, completeTime: new Date().toISOString() }],
    resourceFieldType: 1, isShore: false,
    resourceProduction: { wood: 1200, clay: 1100, iron: 1300, crop: 900, lastUpdated: Date.now() },
    marketplace: { merchantsAvailable: 10, maxPerMerchant: 750, merchantsTotal: 20 },
    troops: {} as Record<string, number>,
    troopsLastUpdated: Date.now(),
    troopUpkeep: 500,
    farmLists: Array.from({ length: 7 }, (_, i) => ({
      id: id * 10 + i, name: `List ${i}`, enabled: true, hasStartButton: true,
      villageId: id, lastUpdated: Date.now(),
    })),
    incomingAttacks: [] as any[],
  }
}

function createAccount(id: number, villageCount: number) {
  const villages = []
  for (let v = 0; v < villageCount; v++) villages.push(createVillage(id * 100 + v, id))
  return {
    account: { id, username: `user${id}`, server: 'https://ts1.example.com' },
    info: { id: 0, accountId: id, gold: 100, silver: 500, hasPlusAccount: true },
    playerName: `Player${id}`,
    farmLists: villages[0]?.farmLists ?? [],
    villages,
    sitting: [],
  }
}

/** Simulate a farm list scan mirror — the exact production pattern */
function mirrorFarmListScan(account: any) {
  const village = account.villages[0]

  // Replace storage
  village.storage = createStorage()
  village.storage.villageId = village.village.id

  // Replace farm list entries
  for (let i = 0; i < account.farmLists.length; i++) {
    account.farmLists[i] = {
      ...account.farmLists[i],
      lastUpdated: Date.now(),
      hasStartButton: true,
    }
  }

  // Replace queue
  village.queueBuildings = [{
    id: 1, villageId: village.village.id, position: 1,
    type: Math.floor(Math.random() * 30) + 1,
    level: Math.floor(Math.random() * 20),
    location: Math.floor(Math.random() * 40) + 1,
    completeTime: new Date(Date.now() + 3600000).toISOString(),
  }]
}

/** Simulate resource page scan — more frequent, lighter */
function mirrorResourceScan(account: any, villageIdx: number) {
  const village = account.villages[villageIdx % account.villages.length]
  village.storage = {
    ...village.storage,
    wood: Math.floor(Math.random() * 80000),
    clay: Math.floor(Math.random() * 80000),
    iron: Math.floor(Math.random() * 80000),
    crop: Math.floor(Math.random() * 80000),
    lastUpdated: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetProxyStats()
})

describe('long-running degradation', () => {
  test('100k mutation cycles with heap monitoring', () => {
    const state = { accounts: {} as Record<string, any> }
    for (let i = 1; i <= 8; i++) {
      state.accounts[String(i)] = createAccount(i, i <= 3 ? 6 : 2)
    }

    const events: StateEvent[] = []
    const proxy = reactive(state, (e) => events.push(e)) as any
    JSON.stringify(proxy) // materialize
    gc()
    events.length = 0

    const TOTAL_CYCLES = 100_000
    const MEASURE_EVERY = 10_000
    const checkpoints: {
      cycle: number
      mutateMedianMs: number
      heapMB: number
      proxiesCreated: number
      proxiesEvicted: number
      pathCacheSize: number
    }[] = []

    let batchTimes: number[] = []

    for (let cycle = 0; cycle < TOTAL_CYCLES; cycle++) {
      const accountId = String((cycle % 8) + 1)

      const t0 = performance.now()
      if (cycle % 5 === 0) {
        mirrorFarmListScan(proxy.accounts[accountId])
      } else {
        mirrorResourceScan(proxy.accounts[accountId], cycle)
      }
      batchTimes.push(performance.now() - t0)

      // Clear events like production batch does
      events.length = 0

      if ((cycle + 1) % MEASURE_EVERY === 0) {
        gc()
        const stats = getProxyStats()
        checkpoints.push({
          cycle: cycle + 1,
          mutateMedianMs: median(batchTimes),
          heapMB: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
          proxiesCreated: stats.created,
          proxiesEvicted: stats.staleEvicted,
          pathCacheSize: stats.pathConcatCacheSize,
        })
        batchTimes = []
      }
    }

    console.log('\n=== 100k Mutation Cycles ===')
    console.log('  cycle     | median ms | heap MB | proxies (created/evicted) | pathCache')
    console.log('  ----------|-----------|---------|---------------------------|----------')
    for (const cp of checkpoints) {
      console.log(
        `  ${String(cp.cycle).padStart(9)} | ` +
        `${cp.mutateMedianMs.toFixed(3).padStart(9)} | ` +
        `${String(cp.heapMB).padStart(7)} | ` +
        `${String(cp.proxiesCreated).padStart(12)}/${String(cp.proxiesEvicted).padEnd(13)} | ` +
        `${cp.pathCacheSize}`
      )
    }

    const first = checkpoints[0]
    const last = checkpoints[checkpoints.length - 1]
    const timeRatio = last.mutateMedianMs / first.mutateMedianMs
    const heapGrowthMB = last.heapMB - first.heapMB

    console.log(`\n  Time degradation: ${timeRatio.toFixed(2)}x`)
    console.log(`  Heap growth: ${heapGrowthMB} MB`)

    expect(timeRatio).toBeLessThan(5)
  })

  test('deepToRaw cost at scale after 50k mutations', () => {
    const state = { accounts: {} as Record<string, any> }
    for (let i = 1; i <= 8; i++) {
      state.accounts[String(i)] = createAccount(i, i <= 3 ? 6 : 2)
    }

    const events: StateEvent[] = []
    const proxy = reactive(state, (e) => events.push(e)) as any
    JSON.stringify(proxy)
    events.length = 0

    // Measure baseline deepToRaw
    const baselineTimes: number[] = []
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now()
      deepToRaw(proxy)
      baselineTimes.push(performance.now() - t0)
    }

    // Run 50k mutations
    for (let cycle = 0; cycle < 50_000; cycle++) {
      const accountId = String((cycle % 8) + 1)
      if (cycle % 5 === 0) {
        mirrorFarmListScan(proxy.accounts[accountId])
      } else {
        mirrorResourceScan(proxy.accounts[accountId], cycle)
      }
      events.length = 0
    }

    // Measure deepToRaw after mutations
    gc()
    const afterTimes: number[] = []
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now()
      deepToRaw(proxy)
      afterTimes.push(performance.now() - t0)
    }

    const beforeMs = median(baselineTimes)
    const afterMs = median(afterTimes)
    const ratio = afterMs / beforeMs

    console.log('\n=== deepToRaw at Scale ===')
    console.log(`  Before: ${beforeMs.toFixed(2)}ms`)
    console.log(`  After 50k mutations: ${afterMs.toFixed(2)}ms`)
    console.log(`  Ratio: ${ratio.toFixed(2)}x`)

    expect(ratio).toBeLessThan(5)
  })

  test('globalSeen size probe via proxy stats', () => {
    // Check if globalSeen accumulates entries that prevent GC
    const state = { accounts: {} as Record<string, any> }
    for (let i = 1; i <= 4; i++) {
      state.accounts[String(i)] = createAccount(i, 3)
    }

    const events: StateEvent[] = []
    const proxy = reactive(state, (e) => events.push(e)) as any
    JSON.stringify(proxy) // materialize all

    const statsInitial = { ...getProxyStats() }

    // Run many mutations that replace objects
    for (let cycle = 0; cycle < 20_000; cycle++) {
      const accountId = String((cycle % 4) + 1)
      mirrorFarmListScan(proxy.accounts[accountId])
      events.length = 0
    }

    gc()
    const statsAfter = { ...getProxyStats() }

    // The net proxy count should be bounded — evictions should keep pace with creations
    const netProxies = statsAfter.created - statsAfter.staleEvicted
    const initialNet = statsInitial.created - statsInitial.staleEvicted

    console.log('\n=== Proxy Lifecycle Balance ===')
    console.log(`  Initial: created=${statsInitial.created}, evicted=${statsInitial.staleEvicted}, net=${initialNet}`)
    console.log(`  After 20k: created=${statsAfter.created}, evicted=${statsAfter.staleEvicted}, net=${netProxies}`)
    console.log(`  Net growth: ${netProxies - initialNet} proxies`)

    // Net proxy count should not grow significantly — it should stay near initial
    expect(netProxies - initialNet).toBeLessThan(100)
  })

  test('event accumulation with batched emit pattern', () => {
    // Simulate the exact batchAccountKnowledgeMutation pattern:
    // collect events during mutate, then iterate+clean, then drop
    const state = { accounts: {} as Record<string, any> }
    for (let i = 1; i <= 8; i++) {
      state.accounts[String(i)] = createAccount(i, i <= 3 ? 6 : 2)
    }

    let batchedEvents: StateEvent[] | null = null
    const proxy = reactive(state, (e) => {
      if (batchedEvents) batchedEvents.push(e)
    }) as any
    JSON.stringify(proxy)

    const CYCLES = 50_000
    const BATCH_SIZE = 5000
    const batchMedians: number[] = []

    for (let batch = 0; batch < CYCLES / BATCH_SIZE; batch++) {
      const times: number[] = []

      for (let i = 0; i < BATCH_SIZE; i++) {
        const cycle = batch * BATCH_SIZE + i
        const accountId = String((cycle % 8) + 1)
        const collected: StateEvent[] = []
        batchedEvents = collected

        const t0 = performance.now()
        if (cycle % 5 === 0) {
          mirrorFarmListScan(proxy.accounts[accountId])
        } else {
          mirrorResourceScan(proxy.accounts[accountId], cycle)
        }
        times.push(performance.now() - t0)

        // Simulate cleanEvent: strip oldValue, then drop
        for (const ev of collected) {
          const { oldValue, ...rest } = ev
          // cleanEvent would deepToRaw(rest) here but we skip for speed
        }
        batchedEvents = null
      }

      batchMedians.push(median(times))
    }

    const firstQuarter = batchMedians.slice(0, Math.floor(batchMedians.length / 4))
    const lastQuarter = batchMedians.slice(-Math.floor(batchMedians.length / 4))
    const firstMs = median(firstQuarter)
    const lastMs = median(lastQuarter)
    const ratio = lastMs / firstMs

    console.log('\n=== Batched Emit Pattern (50k cycles) ===')
    console.log(`  First quarter: ${firstMs.toFixed(3)}ms`)
    console.log(`  Last quarter: ${lastMs.toFixed(3)}ms`)
    console.log(`  Degradation: ${ratio.toFixed(2)}x`)
    console.log(`  Batch medians: [${batchMedians.map(m => m.toFixed(3)).join(', ')}]`)

    expect(ratio).toBeLessThan(5)
  })
})
