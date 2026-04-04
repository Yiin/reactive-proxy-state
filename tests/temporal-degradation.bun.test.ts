/**
 * Temporal degradation test for reactive-proxy-state.
 *
 * Validates whether repeated mutations on reactive proxies degrade in
 * performance over time — the pattern observed in production where
 * farm list scan mirrors took 0-1ms after fresh deploy but grew to
 * 21,000ms after 23 hours of continuous operation.
 *
 * Run: bun test tests/temporal-degradation.bun.test.ts
 */
import { describe, test, expect, beforeEach } from 'bun:test'
import { reactive, getProxyStats, resetProxyStats, deepToRaw } from '../src'
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

function p95(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * 0.95)]
}

// ---------------------------------------------------------------------------
// State fixtures matching production shape
// ---------------------------------------------------------------------------

function createStorage() {
  return {
    id: 0,
    villageId: 0,
    wood: Math.floor(Math.random() * 80000),
    clay: Math.floor(Math.random() * 80000),
    iron: Math.floor(Math.random() * 80000),
    crop: Math.floor(Math.random() * 80000),
    warehouseCapacity: 80000,
    granaryCapacity: 80000,
    freeCrop: Math.floor(Math.random() * 5000),
    lastUpdated: Date.now(),
  }
}

function createFarmList(id: number, targetCount: number) {
  return {
    id,
    name: `Farm list ${id}`,
    enabled: true,
    hasStartButton: true,
    villageId: 100,
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
  for (let loc = 1; loc <= 40; loc++) {
    buildings.push(createBuilding(loc))
  }
  return {
    village: { id, accountId, name: `Village ${id}`, x: 10, y: 20, isUnderAttack: false, tribe: 1 },
    storage: createStorage(),
    buildings,
    queueBuildings: [
      { id: 1, villageId: id, position: 1, type: 1, level: 11, location: 1, completeTime: new Date().toISOString() },
    ],
    resourceFieldType: 1,
    isShore: false,
    resourceProduction: { wood: 1200, clay: 1100, iron: 1300, crop: 900, lastUpdated: Date.now() },
    marketplace: { merchantsAvailable: 10, maxPerMerchant: 750, merchantsTotal: 20 },
    trainableUnits: {} as Record<string, any>,
    trainingQueues: {} as Record<string, any>,
    troops: {} as Record<string, number>,
    troopsLastUpdated: Date.now(),
    troopUpkeep: 500,
    troopUpkeepLastUpdated: Date.now(),
    incomingAttacks: [] as any[],
    incomingAttacksLastScanned: Date.now(),
    defenseConfig: { autoEvade: false },
    jobs: [] as any[],
  }
}

function createAccount(id: number, villageCount: number) {
  const villages = []
  for (let v = 0; v < villageCount; v++) {
    villages.push(createVillage(id * 100 + v, id))
  }
  const farmLists = []
  for (let f = 0; f < 7; f++) {
    farmLists.push(createFarmList(id * 10 + f, 0))
  }
  return {
    account: { id, username: `user${id}`, server: 'https://ts1.example.com' },
    info: { id: 0, accountId: id, gold: 100, silver: 500, hasPlusAccount: true },
    playerName: `Player${id}`,
    settings: {},
    heroItems: [],
    farmLists,
    jobs: [],
    villages,
    sitting: [],
    accesses: [],
  }
}

// ---------------------------------------------------------------------------
// Simulated mirror operations (matches mirror.ts patterns)
// ---------------------------------------------------------------------------

/** Simulates what mirrorScanToAppState does for a rallyPointFarmList page */
function simulateFarmListMirror(account: any) {
  // 1. Update storage (object replacement)
  const village = account.villages[0]
  village.storage = createStorage()
  village.storage.villageId = village.village.id

  // 2. Merge farm lists (find + replace pattern)
  const incomingLists = account.farmLists.map((fl: any) => ({
    ...fl,
    lastUpdated: Date.now(),
    hasStartButton: true,
  }))
  for (const list of incomingLists) {
    const idx = account.farmLists.findIndex((fl: any) => fl.id === list.id)
    if (idx >= 0) {
      account.farmLists[idx] = list
    }
  }

  // 3. Update buildings (Object.assign on existing entries)
  for (const building of village.buildings) {
    building.level = building.level // same value assignment (triggers deepEqual)
  }

  // 4. Update queue (array replacement)
  village.queueBuildings = [{
    id: 1,
    villageId: village.village.id,
    position: 1,
    type: Math.floor(Math.random() * 30) + 1,
    level: Math.floor(Math.random() * 20),
    location: Math.floor(Math.random() * 40) + 1,
    completeTime: new Date(Date.now() + 3600000).toISOString(),
  }]
}

/** Simulates what mirrorScanToAppState does for a resources/buildings page */
function simulateResourcePageMirror(account: any, villageIndex: number) {
  const village = account.villages[villageIndex % account.villages.length]
  // Storage percentage update
  village.storage = {
    ...village.storage,
    wood: Math.floor(Math.random() * village.storage.warehouseCapacity),
    clay: Math.floor(Math.random() * village.storage.warehouseCapacity),
    iron: Math.floor(Math.random() * village.storage.warehouseCapacity),
    crop: Math.floor(Math.random() * village.storage.granaryCapacity),
    lastUpdated: Date.now(),
  }
  // Resource production
  village.resourceProduction = {
    wood: 1200 + Math.floor(Math.random() * 100),
    clay: 1100 + Math.floor(Math.random() * 100),
    iron: 1300 + Math.floor(Math.random() * 100),
    crop: 900 + Math.floor(Math.random() * 100),
    lastUpdated: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetProxyStats()
})

describe('temporal degradation', () => {
  test('farm list mirror cycle time should not degrade over 2000 cycles', () => {
    // Create state matching production: multiple accounts with villages
    const state = {
      accounts: {} as Record<string, any>,
    }
    for (let i = 1; i <= 8; i++) {
      state.accounts[String(i)] = createAccount(i, i <= 3 ? 6 : 2)
    }

    const events: StateEvent[] = []
    const proxy = reactive(state, (e) => events.push(e)) as any

    // Warm up: traverse all state to materialize proxies
    JSON.stringify(proxy)
    gc()
    events.length = 0

    const CYCLES = 2000
    const BATCH_SIZE = 50
    const batchMedians: number[] = []

    for (let batch = 0; batch < CYCLES / BATCH_SIZE; batch++) {
      const batchTimes: number[] = []

      for (let i = 0; i < BATCH_SIZE; i++) {
        const cycle = batch * BATCH_SIZE + i
        const accountId = String((cycle % 3) + 1) // rotate accounts 1-3

        const t0 = performance.now()
        simulateFarmListMirror(proxy.accounts[accountId])
        batchTimes.push(performance.now() - t0)

        // Clear events like batchAccountKnowledgeMutation does
        events.length = 0
      }

      batchMedians.push(median(batchTimes))
    }

    const firstQuarter = batchMedians.slice(0, Math.floor(batchMedians.length / 4))
    const lastQuarter = batchMedians.slice(-Math.floor(batchMedians.length / 4))
    const firstMedian = median(firstQuarter)
    const lastMedian = median(lastQuarter)
    const ratio = lastMedian / firstMedian

    console.log('\n=== Farm List Mirror Degradation ===')
    console.log(`  Cycles:          ${CYCLES}`)
    console.log(`  First quarter:   ${firstMedian.toFixed(2)}ms median`)
    console.log(`  Last quarter:    ${lastMedian.toFixed(2)}ms median`)
    console.log(`  Degradation:     ${ratio.toFixed(2)}x`)
    console.log(`  All batch medians: [${batchMedians.map(m => m.toFixed(1)).join(', ')}]`)

    const stats = getProxyStats()
    console.log(`  Proxies created: ${stats.created}, evicted: ${stats.staleEvicted}`)
    console.log(`  pathConcatCache: ${stats.pathConcatCacheSize}`)

    // Should not degrade more than 3x
    expect(ratio).toBeLessThan(3)
  })

  test('mixed page mirror should not degrade over 5000 cycles', () => {
    const state = {
      accounts: {} as Record<string, any>,
    }
    for (let i = 1; i <= 8; i++) {
      state.accounts[String(i)] = createAccount(i, i <= 3 ? 6 : 2)
    }

    const events: StateEvent[] = []
    const proxy = reactive(state, (e) => events.push(e)) as any
    JSON.stringify(proxy)
    gc()
    events.length = 0

    const CYCLES = 5000
    const BATCH_SIZE = 100
    const batchMedians: number[] = []

    for (let batch = 0; batch < CYCLES / BATCH_SIZE; batch++) {
      const batchTimes: number[] = []

      for (let i = 0; i < BATCH_SIZE; i++) {
        const cycle = batch * BATCH_SIZE + i
        const accountId = String((cycle % 8) + 1)

        const t0 = performance.now()
        if (cycle % 3 === 0) {
          simulateFarmListMirror(proxy.accounts[accountId])
        } else {
          simulateResourcePageMirror(proxy.accounts[accountId], cycle)
        }
        batchTimes.push(performance.now() - t0)
        events.length = 0
      }

      batchMedians.push(median(batchTimes))
    }

    const firstQuarter = batchMedians.slice(0, Math.floor(batchMedians.length / 4))
    const lastQuarter = batchMedians.slice(-Math.floor(batchMedians.length / 4))
    const firstMedian = median(firstQuarter)
    const lastMedian = median(lastQuarter)
    const ratio = lastMedian / firstMedian

    console.log('\n=== Mixed Page Mirror Degradation ===')
    console.log(`  Cycles:          ${CYCLES}`)
    console.log(`  First quarter:   ${firstMedian.toFixed(2)}ms median`)
    console.log(`  Last quarter:    ${lastMedian.toFixed(2)}ms median`)
    console.log(`  Degradation:     ${ratio.toFixed(2)}x`)

    const stats = getProxyStats()
    console.log(`  Proxies created: ${stats.created}, evicted: ${stats.staleEvicted}`)

    expect(ratio).toBeLessThan(3)
  })

  test('deepToRaw time should not degrade after many mutations', () => {
    const state = {
      accounts: {} as Record<string, any>,
    }
    for (let i = 1; i <= 8; i++) {
      state.accounts[String(i)] = createAccount(i, i <= 3 ? 6 : 2)
    }

    const events: StateEvent[] = []
    const proxy = reactive(state, (e) => events.push(e)) as any
    JSON.stringify(proxy)
    events.length = 0

    // Measure deepToRaw before mutations
    const beforeTimes: number[] = []
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now()
      deepToRaw(proxy)
      beforeTimes.push(performance.now() - t0)
    }

    // Run 2000 mutation cycles
    for (let cycle = 0; cycle < 2000; cycle++) {
      const accountId = String((cycle % 8) + 1)
      if (cycle % 3 === 0) {
        simulateFarmListMirror(proxy.accounts[accountId])
      } else {
        simulateResourcePageMirror(proxy.accounts[accountId], cycle)
      }
      events.length = 0
    }

    // Measure deepToRaw after mutations
    const afterTimes: number[] = []
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now()
      deepToRaw(proxy)
      afterTimes.push(performance.now() - t0)
    }

    const beforeMedian = median(beforeTimes)
    const afterMedian = median(afterTimes)
    const ratio = afterMedian / beforeMedian

    console.log('\n=== deepToRaw Degradation ===')
    console.log(`  Before mutations: ${beforeMedian.toFixed(2)}ms median`)
    console.log(`  After 2000 mutations: ${afterMedian.toFixed(2)}ms median`)
    console.log(`  Degradation: ${ratio.toFixed(2)}x`)

    const stats = getProxyStats()
    console.log(`  Proxies created: ${stats.created}, evicted: ${stats.staleEvicted}`)

    expect(ratio).toBeLessThan(3)
  })

  test('array filter/replace pattern should not leak', () => {
    // This tests the specific pattern from mirror.ts:
    //   account.villages = account.villages.filter(n => incomingIds.has(n.village.id))
    // which replaces the entire array on each scan
    const state = {
      accounts: {
        '1': createAccount(1, 6),
      },
    }
    const events: StateEvent[] = []
    const proxy = reactive(state, (e) => events.push(e)) as any
    JSON.stringify(proxy)
    events.length = 0

    const CYCLES = 3000
    const BATCH_SIZE = 100
    const batchMedians: number[] = []

    for (let batch = 0; batch < CYCLES / BATCH_SIZE; batch++) {
      const batchTimes: number[] = []

      for (let i = 0; i < BATCH_SIZE; i++) {
        const account = proxy.accounts['1']
        const villageIds = new Set(account.villages.map((v: any) => v.village.id))

        const t0 = performance.now()
        // This is what mirror.ts does on every scan
        account.villages = account.villages.filter((n: any) => villageIds.has(n.village.id))
        batchTimes.push(performance.now() - t0)
        events.length = 0
      }

      batchMedians.push(median(batchTimes))
    }

    const firstQuarter = batchMedians.slice(0, Math.floor(batchMedians.length / 4))
    const lastQuarter = batchMedians.slice(-Math.floor(batchMedians.length / 4))
    const firstMedian = median(firstQuarter)
    const lastMedian = median(lastQuarter)
    const ratio = lastMedian / firstMedian

    console.log('\n=== Array Filter/Replace Degradation ===')
    console.log(`  Cycles:          ${CYCLES}`)
    console.log(`  First quarter:   ${firstMedian.toFixed(3)}ms median`)
    console.log(`  Last quarter:    ${lastMedian.toFixed(3)}ms median`)
    console.log(`  Degradation:     ${ratio.toFixed(2)}x`)

    const stats = getProxyStats()
    console.log(`  Proxies created: ${stats.created}, evicted: ${stats.staleEvicted}`)

    expect(ratio).toBeLessThan(3)
  })

  test('object replacement on reactive proxy should not accumulate cost', () => {
    // Tests repeated storage = {...} replacements which are very common
    const state = {
      accounts: {
        '1': createAccount(1, 6),
      },
    }
    const events: StateEvent[] = []
    const proxy = reactive(state, (e) => events.push(e)) as any
    JSON.stringify(proxy)
    events.length = 0

    const CYCLES = 5000
    const BATCH_SIZE = 100
    const batchMedians: number[] = []

    for (let batch = 0; batch < CYCLES / BATCH_SIZE; batch++) {
      const batchTimes: number[] = []

      for (let i = 0; i < BATCH_SIZE; i++) {
        const village = proxy.accounts['1'].villages[0]

        const t0 = performance.now()
        // Exact pattern from mirror.ts: replace storage object
        village.storage = {
          id: 0,
          villageId: village.village.id,
          wood: Math.floor(Math.random() * 80000),
          clay: Math.floor(Math.random() * 80000),
          iron: Math.floor(Math.random() * 80000),
          crop: Math.floor(Math.random() * 80000),
          warehouseCapacity: 80000,
          granaryCapacity: 80000,
          freeCrop: Math.floor(Math.random() * 5000),
          lastUpdated: Date.now(),
        }
        batchTimes.push(performance.now() - t0)
        events.length = 0
      }

      batchMedians.push(median(batchTimes))
    }

    const firstQuarter = batchMedians.slice(0, Math.floor(batchMedians.length / 4))
    const lastQuarter = batchMedians.slice(-Math.floor(batchMedians.length / 4))
    const firstMedian = median(firstQuarter)
    const lastMedian = median(lastQuarter)
    const ratio = lastMedian / firstMedian

    console.log('\n=== Storage Replacement Degradation ===')
    console.log(`  Cycles:          ${CYCLES}`)
    console.log(`  First quarter:   ${firstMedian.toFixed(3)}ms median`)
    console.log(`  Last quarter:    ${lastMedian.toFixed(3)}ms median`)
    console.log(`  Degradation:     ${ratio.toFixed(2)}x`)

    const stats = getProxyStats()
    console.log(`  Proxies created: ${stats.created}, evicted: ${stats.staleEvicted}`)

    expect(ratio).toBeLessThan(3)
  })
})
