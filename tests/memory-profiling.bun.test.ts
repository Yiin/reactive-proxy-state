/**
 * Memory profiling tests for reactive-proxy-state.
 *
 * Determines whether the reactive proxy system is the root cause of ~700MB RSS
 * observed in production (3.5MB raw state → reportedly 400-500MB via proxies).
 *
 * Run: bun test tests/memory-profiling.bun.test.ts
 */
import { describe, test, expect, beforeEach } from 'bun:test'
import { reactive, getProxyStats, resetProxyStats, watchEffect } from '../src'
import type { StateEvent } from '../src/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gc() {
  Bun.gc(true)
}

function heapUsed(): number {
  gc()
  // Take the best of 3 measurements to reduce noise
  let min = Infinity
  for (let i = 0; i < 3; i++) {
    gc()
    min = Math.min(min, process.memoryUsage().heapUsed)
  }
  return min
}

function fmt(bytes: number) {
  if (Math.abs(bytes) < 1024) return `${bytes} B`
  if (Math.abs(bytes) < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function collectEvents(): { events: StateEvent[]; emit: (e: StateEvent) => void } {
  const events: StateEvent[] = []
  return { events, emit: (e) => events.push(e) }
}

// ---------------------------------------------------------------------------
// Realistic Vangrd state fixtures (scaled to ~3.5 MB JSON)
// ---------------------------------------------------------------------------

function createBuilding(type: number, level: number, location: number) {
  return { type, level, location, isUnderConstruction: false }
}

function createStorage() {
  return {
    warehouseCapacity: 80000,
    granaryCapacity: 80000,
    wood: Math.floor(Math.random() * 80000),
    clay: Math.floor(Math.random() * 80000),
    iron: Math.floor(Math.random() * 80000),
    crop: Math.floor(Math.random() * 80000),
    freeCrop: Math.floor(Math.random() * 5000),
    lastUpdated: Date.now(),
  }
}

function createTroops() {
  const troops: Record<string, number> = {}
  for (let i = 1; i <= 10; i++) {
    troops[String(i)] = Math.floor(Math.random() * 200)
  }
  return troops
}

function createSmithyLevels() {
  const levels: Record<string, number> = {}
  for (let i = 1; i <= 10; i++) {
    levels[String(i)] = Math.floor(Math.random() * 20)
  }
  return levels
}

function createTrainableUnits() {
  const units: Record<string, any> = {}
  for (let i = 1; i <= 10; i++) {
    units[String(i)] = {
      canTrain: true,
      cost: { wood: 100 * i, clay: 80 * i, iron: 150 * i, crop: 50 * i },
      timePerUnitSec: 30 * i,
    }
  }
  return units
}

function createTrainingQueues() {
  const queues: Record<string, any> = {}
  for (const buildingType of [14, 15, 16]) {
    queues[String(buildingType)] = {
      buildingType,
      items: Array.from({ length: 3 }, (_, i) => ({
        unitId: i + 1,
        count: Math.floor(Math.random() * 50),
        finishTime: Date.now() + (i + 1) * 600000,
      })),
    }
  }
  return queues
}

function createVillageSettings() {
  return {
    useHeroResourceForBuilding: false,
    autoUpgradeStorageWhenBlocked: false,
    completeImmediately: false,
    completeImmediatelyTime: 0,
    minCropReserve: 10000,
    trainTroopEnable: true,
    trainingResourceThresholdPercent: 60,
    trainingPriorities: [
      { unitId: 1, ratio: 50, minCount: 100 },
      { unitId: 3, ratio: 30, minCount: 50 },
      { unitId: 5, ratio: 20, minCount: 0 },
    ],
    autoNpcEnable: false,
    autoNpcGranaryPercent: 0,
    autoNpcWood: 25,
    autoNpcClay: 25,
    autoNpcIron: 25,
    autoNpcCrop: 25,
    autoNpcCropDeficitEnable: false,
    autoNpcCropDeficitMinutes: 30,
    autoNpcCropDeficitWood: 0,
    autoNpcCropDeficitClay: 0,
    autoNpcCropDeficitIron: 0,
    autoNpcCropDeficitCrop: 100,
    autoNpcCropDeficitMinMinutes: 10,
    buildPlan: Array.from({ length: 15 }, (_, i) => ({
      type: (i % 30) + 1,
      targetLevel: Math.floor(Math.random() * 20) + 1,
      location: i + 1,
      priority: i,
    })),
    supplyEnable: false,
    supplyTargetVillageId: 0,
    supplyKeepWood: 5000,
    supplyKeepClay: 5000,
    supplyKeepIron: 5000,
    supplyMinShipment: 1000,
    supplyMaxConcurrentShipments: 3,
    supplyRepeatTimeMin: 10,
    supplyRepeatTimeMax: 30,
    settlerTrainEnable: false,
    settlerAutoBuildResidence: false,
    settlerPreferredLocation: 0,
    settlerMaxCount: 3,
    settlerUseNpc: false,
    settlerAutoSettle: false,
    settlerTargetX: null as number | null,
    settlerTargetY: null as number | null,
    healTroopEnable: false,
    healingPriority: [] as any[],
    healTroopUseNpc: false,
    healTroopUseHeroResources: false,
  }
}

function createVillage(id: number, accountId: number) {
  // 18 resource fields + 22 inner buildings
  const buildings = []
  for (let loc = 1; loc <= 18; loc++) {
    buildings.push(createBuilding(loc <= 4 ? 1 : loc <= 8 ? 2 : loc <= 12 ? 3 : 4, Math.floor(Math.random() * 12) + 8, loc))
  }
  for (let loc = 19; loc <= 40; loc++) {
    buildings.push(createBuilding(10 + loc - 19, Math.floor(Math.random() * 20), loc))
  }

  return {
    village: {
      id, accountId,
      name: `Village ${id} - ${['Capital', 'Hammer', 'Defense', 'Feeder', 'Settler'][id % 5]}`,
      x: Math.floor(Math.random() * 400) - 200,
      y: Math.floor(Math.random() * 400) - 200,
      isUnderAttack: false,
      tribe: 1,
    },
    storage: createStorage(),
    buildings,
    queueBuildings: [
      { type: 1, level: 11, location: 1, finishTime: Date.now() + 3600000 },
      { type: 10, level: 15, location: 19, finishTime: Date.now() + 7200000 },
    ],
    jobs: Array.from({ length: 5 }, (_, i) => ({
      id: id * 100 + i,
      kind: `job-kind-${i}`,
      villageId: id,
      scheduledAt: Date.now() + i * 60000,
      data: { attempt: 1, reason: `scheduled update ${i}` },
    })),
    settings: createVillageSettings(),
    resourceFieldType: (id % 4) + 1,
    isShore: id % 7 === 0,
    resourceProduction: { wood: 1200 + id, clay: 1100 + id, iron: 1300 + id, crop: 900 + id },
    marketplace: { merchantsAvailable: 10, maxPerMerchant: 750 },
    trainableUnits: createTrainableUnits(),
    trainingQueues: createTrainingQueues(),
    trainingQueueTimers: { 14: Date.now() + 300000, 15: Date.now() + 600000, 16: 0 } as Record<string, number>,
    trainingQueueTimersUpdatedAt: Date.now(),
    troops: createTroops(),
    troopsLastUpdated: Date.now(),
    troopUpkeep: Math.floor(Math.random() * 2000),
    troopUpkeepLastUpdated: Date.now(),
    smithyLevels: createSmithyLevels(),
    smithyLevelsLastScanned: Date.now(),
    farmTroopBudget: { 1: 100, 3: 50, 4: 25 } as Record<string, number>,
    incomingAttacks: id % 3 === 0 ? [
      { id: 1, arrivalTime: Date.now() + 120000, sourceX: -50, sourceY: 30, troopCount: '?' },
    ] : [],
    defenseConfig: { autoEvade: false, evadeVillageId: 0, dodgeThreshold: 0 },
  }
}

function createFarmList(id: number, targetCount: number) {
  const targets = []
  for (let i = 0; i < targetCount; i++) {
    targets.push({
      id: id * 1000 + i,
      x: Math.floor(Math.random() * 400) - 200,
      y: Math.floor(Math.random() * 400) - 200,
      distance: Math.random() * 20,
      population: Math.floor(Math.random() * 300),
      lastRaidBooty: Math.floor(Math.random() * 500),
      lastRaidLosses: Math.floor(Math.random() * 5),
      lastRaidTime: Date.now() - Math.floor(Math.random() * 86400000),
      troopAllocation: { 1: 6, 3: 2, 4: 1 },
      isFatal: false,
      playerName: `Natars${i}`,
      villageName: `Oasis ${i}`,
    })
  }
  return { id, name: `Farm list ${id}`, villageId: id * 100, lastRun: Date.now(), targets }
}

function createTrackedPlayer(id: number) {
  return {
    id,
    name: `TrackedPlayer${id}`,
    allianceId: Math.floor(Math.random() * 50),
    allianceName: `Alliance ${Math.floor(Math.random() * 50)}`,
    lastScanned: Date.now(),
    snapshots: Array.from({ length: 30 }, (_, s) => ({
      timestamp: Date.now() - s * 86400000,
      population: 500 + s * 50 + Math.floor(Math.random() * 100),
      villages: 3 + Math.floor(s / 3),
      offensivePoints: s * 1000,
      defensivePoints: s * 800,
      robberPoints: s * 200,
      villageDetails: Array.from({ length: 3 + Math.floor(s / 3) }, (_, v) => ({
        id: id * 1000 + v,
        name: `Village ${v}`,
        x: Math.floor(Math.random() * 400) - 200,
        y: Math.floor(Math.random() * 400) - 200,
        population: 100 + v * 50,
      })),
    })),
  }
}

function createAccount(id: number, villageCount: number) {
  const villages = []
  for (let v = 0; v < villageCount; v++) {
    villages.push(createVillage(id * 100 + v, id))
  }

  // Farm lists: 3 lists × 150 targets = 450 farm targets per active account
  const farmLists = []
  for (let f = 0; f < 3; f++) {
    farmLists.push(createFarmList(id * 10 + f, 150))
  }

  return {
    account: { id, username: `user${id}`, server: 'https://ts1.example.com' },
    info: { id: 1, accountId: id, gold: 100, silver: 500, hasPlusAccount: true },
    playerName: `Player${id}`,
    settings: {
      workTimeMin: 15,
      workTimeMax: 45,
      sleepTimeMin: 60,
      sleepTimeMax: 120,
      mouseSpeedMultiplier: 1,
      mouseRandomness: 1,
      enableAutoStartAdventure: true,
      reduceAdventureDuration: false,
      increaseAdventureDanger: false,
      enableProductionBoost: true,
      useSpecialUpgrade: false,
      enableAutoCollectQuestRewards: true,
      enableAutoCollectDailyQuestRewards: true,
      enableAutoReadReports: true,
      enableAutoReadMessages: false,
      enableRandomNavigationVisits: true,
      randomNavigationIntervalMinutes: 20,
      randomNavigationJitterMinutes: 10,
      celebrationPreference: 0,
      heroUseMaxOnTransfer: true,
      useHeroHelmBeforeTraining: false,
      useNpcForBuildings: true,
      npcMaxUsesPerHour: 8,
      shipmentsMaxPerHour: 20,
      discordWebhookUrls: ['https://discord.com/api/webhooks/1234567890/token'],
      villageDefaults: createVillageSettings(),
    },
    heroItems: Array.from({ length: 12 }, (_, i) => ({
      id: i, type: i + 1, amount: 1, slot: i,
      name: `Hero Item ${i}`, bonus: { attack: i * 5, defense: i * 3 },
    })),
    autoReadMessages: Array.from({ length: 5 }, (_, i) => ({
      id: i, subject: `Message ${i}`, from: `Player${i}`, timestamp: Date.now() - i * 3600000,
    })),
    farmLists,
    jobs: Array.from({ length: 8 }, (_, i) => ({
      id: id * 1000 + i,
      kind: ['RefreshVillage', 'StartFarmList', 'TrainTroops', 'CheckAdventure', 'ScanPlayer', 'UpgradeBuilding', 'NpcTrade', 'CollectRewards'][i],
      accountId: id,
      scheduledAt: Date.now() + i * 60000,
      data: { villageId: id * 100, attempt: 1 },
    })),
    villages,
    sitting: id <= 3 ? [{
      account: { id: 100 + id, username: `sitter${id}`, server: 'https://ts1.example.com' },
      villages: [createVillage(1000 + id, 100 + id)],
    }] : [],
    accesses: [
      { id: 1, accountId: id, label: 'Primary', username: `user${id}`, password: 'encrypted', proxyUrl: 'socks5://proxy.example.com:1080', scheduleGrid: Array(168).fill(true) },
      { id: 2, accountId: id, label: 'Dual', username: `dual${id}`, password: 'encrypted', proxyUrl: '', scheduleGrid: Array(168).fill(false).map((_, i) => i % 2 === 0) },
    ],
    scheduledTasks: Array.from({ length: 3 }, (_, i) => ({
      id: i, kind: `scheduled-${i}`, cron: '*/30 * * * *', lastRun: Date.now() - 1800000,
    })),
    trackedPlayers: Array.from({ length: 15 }, (_, i) => createTrackedPlayer(id * 100 + i)),
    metallurgyBonus: 20,
    metallurgyLastScanned: Date.now(),
    oasisClearingPending: [],
    temporarilyDisabledOasisSlots: [],
    oasisClearingHistory: Array.from({ length: 20 }, (_, i) => ({
      oasisId: i, clearedAt: Date.now() - i * 86400000, troopsSent: { 1: 50, 3: 20 },
    })),
    probeCandidates: Array.from({ length: 10 }, (_, i) => ({
      id: i, x: Math.floor(Math.random() * 400) - 200, y: Math.floor(Math.random() * 400) - 200,
      population: Math.floor(Math.random() * 500), lastProbed: Date.now() - i * 3600000,
    })),
    attackPlans: [],
  }
}

/** Builds a state tree matching the production profile: 12 accounts, ~37 villages. */
function createProductionStateTree() {
  const villageCounts = [8, 6, 5, 4, 3, 3, 2, 2, 1, 1, 1, 1] // 37 total
  const accounts: Record<string, any> = {}
  for (let i = 0; i < villageCounts.length; i++) {
    accounts[String(i + 1)] = createAccount(i + 1, villageCounts[i])
  }
  return { accounts, nextJobId: 1000, nextAccountId: 13 }
}

/** Count all objects (plain objects, arrays) recursively. */
function countObjects(value: any, seen = new Set<any>()): number {
  if (value == null || typeof value !== 'object') return 0
  if (seen.has(value)) return 0
  seen.add(value)
  let count = 1
  if (Array.isArray(value)) {
    for (const item of value) count += countObjects(item, seen)
  } else if (value instanceof Map) {
    for (const [k, v] of value) {
      count += countObjects(k, seen)
      count += countObjects(v, seen)
    }
  } else if (value instanceof Set) {
    for (const v of value) count += countObjects(v, seen)
  } else {
    for (const key of Object.keys(value)) {
      count += countObjects(value[key], seen)
    }
  }
  return count
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetProxyStats()
})

describe('memory profiling', () => {
  test('raw state tree baseline', () => {
    const state = createProductionStateTree()
    const json = JSON.stringify(state)
    const rawSizeBytes = Buffer.byteLength(json, 'utf8')
    const objectCount = countObjects(state)

    console.log('\n=== Raw State Tree ===')
    console.log(`  JSON size:     ${fmt(rawSizeBytes)}`)
    console.log(`  Object count:  ${objectCount.toLocaleString()}`)

    // Should be in the multi-MB range to be representative
    expect(rawSizeBytes).toBeGreaterThan(500_000)
    expect(objectCount).toBeGreaterThan(5000)
  })

  test('proxy creation is lazy (not eager)', () => {
    const state = createProductionStateTree()
    const objectCount = countObjects(state)
    const { emit } = collectEvents()

    const proxy = reactive(state, emit)
    const statsAfterWrap = { ...getProxyStats() }

    // Access one deep path
    const _name = (proxy as any).accounts['1'].villages[0].village.name
    const statsAfterOneAccess = { ...getProxyStats() }

    // Access a different account's farm list
    const _targets = (proxy as any).accounts['3'].farmLists[0].targets.length
    const statsAfterSecondAccess = { ...getProxyStats() }

    console.log('\n=== Lazy Proxy Creation ===')
    console.log(`  Total objects in tree:    ${objectCount.toLocaleString()}`)
    console.log(`  After reactive():         ${statsAfterWrap.created} proxies`)
    console.log(`  After 1 deep read:        ${statsAfterOneAccess.created} proxies`)
    console.log(`  After 2nd deep read:      ${statsAfterSecondAccess.created} proxies`)
    console.log(`  Wrap is lazy:             ${statsAfterWrap.created < 10 ? 'YES' : 'NO — eagerly wraps ' + statsAfterWrap.created + ' objects'}`)

    expect(statsAfterWrap.created).toBeLessThan(10)
  })

  test('full traversal proxy count vs object count', () => {
    const state = createProductionStateTree()
    const objectCount = countObjects(state)
    const { emit } = collectEvents()

    const proxy = reactive(state, emit)
    JSON.stringify(proxy) // materialize all

    const stats = getProxyStats()

    console.log('\n=== Full Traversal ===')
    console.log(`  Raw objects:   ${objectCount.toLocaleString()}`)
    console.log(`  Proxies:       ${stats.created.toLocaleString()} (obj: ${stats.objects}, arr: ${stats.arrays}, map: ${stats.maps}, set: ${stats.sets})`)
    console.log(`  Ratio:         ${(stats.created / objectCount).toFixed(2)} proxies per object`)

    // Should be 1:1 — one proxy per object
    expect(stats.created).toBe(objectCount)
  })

  test('per-proxy heap cost (large sample)', () => {
    // Allocate enough proxies to get above GC noise floor
    const COUNT = 50_000
    const objs: any[] = []
    for (let i = 0; i < COUNT; i++) {
      objs.push({ a: i, b: `str${i}`, c: { d: i * 2 } })
    }

    // Baseline: raw objects already in heap
    gc()
    const baselineHeap = process.memoryUsage().heapUsed

    // Wrap them all
    resetProxyStats()
    const proxies: any[] = []
    for (let i = 0; i < COUNT; i++) {
      proxies.push(reactive(objs[i]))
    }

    gc()
    const afterProxies = process.memoryUsage().heapUsed
    const stats = getProxyStats()

    const proxyCost = afterProxies - baselineHeap
    const perProxy = proxyCost / stats.created

    console.log('\n=== Per-Proxy Heap Cost ===')
    console.log(`  ${COUNT.toLocaleString()} objects wrapped`)
    console.log(`  Proxies created:  ${stats.created.toLocaleString()}`)
    console.log(`  Total heap delta: ${fmt(proxyCost)}`)
    console.log(`  Per proxy:        ${perProxy.toFixed(0)} bytes`)
    console.log(`  Per proxy (incl nested): ${(proxyCost / COUNT).toFixed(0)} bytes per root object`)

    // Keep references alive for GC measurement
    expect(proxies.length).toBe(COUNT)
  })

  test('production workload: total reactive heap overhead', () => {
    // Measure the raw object heap cost first
    const rawState = createProductionStateTree()
    const json = JSON.stringify(rawState)
    const jsonSize = Buffer.byteLength(json, 'utf8')
    const objectCount = countObjects(rawState)

    // Allocate multiple copies to amplify signal above GC noise
    const COPIES = 5

    gc()
    const beforeRaw = process.memoryUsage().heapUsed
    const rawCopies: any[] = []
    for (let i = 0; i < COPIES; i++) {
      rawCopies.push(JSON.parse(json))
    }
    gc()
    const afterRaw = process.memoryUsage().heapUsed
    const rawCostPerCopy = (afterRaw - beforeRaw) / COPIES

    // Now reactive copies with full traversal
    gc()
    const beforeReactive = process.memoryUsage().heapUsed
    const reactiveCopies: any[] = []
    for (let i = 0; i < COPIES; i++) {
      resetProxyStats()
      const { emit } = collectEvents()
      const proxy = reactive(JSON.parse(json), emit)
      JSON.stringify(proxy) // materialize all proxies
      reactiveCopies.push(proxy)
    }
    gc()
    const afterReactive = process.memoryUsage().heapUsed
    const reactiveCostPerCopy = (afterReactive - beforeReactive) / COPIES

    const pureProxyOverhead = reactiveCostPerCopy - rawCostPerCopy
    const overheadFactor = rawCostPerCopy > 0 ? reactiveCostPerCopy / rawCostPerCopy : NaN

    console.log('\n========================================')
    console.log('  PRODUCTION WORKLOAD OVERHEAD')
    console.log('========================================')
    console.log(`  JSON size:             ${fmt(jsonSize)}`)
    console.log(`  Object count:          ${objectCount.toLocaleString()}`)
    console.log(`  Raw objects in heap:   ${fmt(rawCostPerCopy)}`)
    console.log(`  Reactive in heap:      ${fmt(reactiveCostPerCopy)}`)
    console.log(`  Pure proxy overhead:   ${fmt(pureProxyOverhead)}`)
    console.log(`  Overhead factor:       ${overheadFactor.toFixed(1)}x`)
    console.log('')
    console.log(`  Extrapolated to 3.5MB JSON:`)
    const scale = 3.5 * 1024 * 1024 / jsonSize
    console.log(`    Raw heap:            ${fmt(rawCostPerCopy * scale)}`)
    console.log(`    Reactive heap:       ${fmt(reactiveCostPerCopy * scale)}`)
    console.log(`    Proxy overhead:      ${fmt(pureProxyOverhead * scale)}`)
    console.log('========================================')

    // Keep alive
    expect(rawCopies.length + reactiveCopies.length).toBe(COPIES * 2)
  })

  test('read-loop growth investigation', () => {
    // The initial run showed 28MB growth from 1000 read cycles.
    // This test isolates the cause: is it proxy allocation, event emission,
    // iterator closures, or something else?
    const state = createProductionStateTree()
    const proxy = reactive(state) as any // no emit — isolate proxy overhead

    // Warm up: first traversal materializes all proxies
    JSON.stringify(proxy)
    gc()

    const statsBeforeReads = { ...getProxyStats() }
    const heapBefore = process.memoryUsage().heapUsed

    // Pattern 1: indexed access only (no iteration)
    for (let i = 0; i < 500; i++) {
      const accIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
      for (const accId of accIds) {
        const acc = proxy.accounts[accId]
        const vLen = acc.villages.length
        for (let v = 0; v < vLen; v++) {
          const village = acc.villages[v]
          const _name = village.village.name
          const _wood = village.storage.wood
          const _bLen = village.buildings.length
        }
      }
    }

    gc()
    const heapAfterIndexed = process.memoryUsage().heapUsed
    const statsAfterIndexed = { ...getProxyStats() }
    const indexedGrowth = heapAfterIndexed - heapBefore
    const indexedNewProxies = statsAfterIndexed.created - statsBeforeReads.created

    // Pattern 2: for-of iteration (creates iterators)
    const heapBeforeForOf = process.memoryUsage().heapUsed
    const statsBeforeForOf = { ...getProxyStats() }

    for (let i = 0; i < 500; i++) {
      for (const accId of Object.keys(proxy.accounts)) {
        const acc = proxy.accounts[accId]
        for (const v of acc.villages) {
          const _name = v.village.name
          const _wood = v.storage.wood
        }
      }
    }

    gc()
    const heapAfterForOf = process.memoryUsage().heapUsed
    const statsAfterForOf = { ...getProxyStats() }
    const forOfGrowth = heapAfterForOf - heapBeforeForOf
    const forOfNewProxies = statsAfterForOf.created - statsBeforeForOf.created

    console.log('\n=== Read-Loop Growth Investigation ===')
    console.log(`  Indexed access (500 cycles):`)
    console.log(`    Heap growth:    ${fmt(indexedGrowth)}`)
    console.log(`    New proxies:    ${indexedNewProxies}`)
    console.log(`  for-of iteration (500 cycles):`)
    console.log(`    Heap growth:    ${fmt(forOfGrowth)}`)
    console.log(`    New proxies:    ${forOfNewProxies}`)
  })

  test('eviction effectiveness', () => {
    const state = createProductionStateTree()
    const { emit } = collectEvents()
    const proxy = reactive(state, emit) as any

    // Materialize account 1 fully
    JSON.stringify(proxy.accounts['1'])
    const statsBeforeReplace = { ...getProxyStats() }

    // Replace it
    proxy.accounts['1'] = createAccount(1, 8)
    const statsAfterReplace = { ...getProxyStats() }

    // Materialize replacement to see if we re-create proxies
    JSON.stringify(proxy.accounts['1'])
    const statsAfterReaccess = { ...getProxyStats() }

    console.log('\n=== Eviction Effectiveness ===')
    console.log(`  Proxies before replace:   ${statsBeforeReplace.created}`)
    console.log(`  Evicted on replace:       ${statsAfterReplace.staleEvicted}`)
    console.log(`  New proxies after reaccess: ${statsAfterReaccess.created - statsAfterReplace.created}`)

    expect(statsAfterReplace.staleEvicted).toBeGreaterThan(0)
  })

  test('mutation churn: 200 scanner cycles', () => {
    const state = createProductionStateTree()
    const { emit } = collectEvents()
    const proxy = reactive(state, emit) as any

    // Warm up
    JSON.stringify(proxy)
    gc()

    const statsBaseline = { ...getProxyStats() }
    const heapBaseline = process.memoryUsage().heapUsed

    // Simulate 200 scanner cycles: replace 2 accounts per cycle
    for (let cycle = 0; cycle < 200; cycle++) {
      const accIds = Object.keys(proxy.accounts)
      for (let r = 0; r < 2; r++) {
        const accId = accIds[cycle * 2 + r < accIds.length ? (cycle * 2 + r) % accIds.length : Math.floor(Math.random() * accIds.length)]
        const villageCount = proxy.accounts[accId].villages.length
        proxy.accounts[accId] = createAccount(Number(accId), villageCount)
      }
    }

    gc()
    const heapAfter = process.memoryUsage().heapUsed
    const statsAfter = { ...getProxyStats() }

    const growth = heapAfter - heapBaseline
    const created = statsAfter.created - statsBaseline.created
    const evicted = statsAfter.staleEvicted - statsBaseline.staleEvicted

    console.log('\n=== Mutation Churn (200 cycles) ===')
    console.log(`  Heap growth:       ${fmt(growth)}`)
    console.log(`  Proxies created:   ${created.toLocaleString()}`)
    console.log(`  Proxies evicted:   ${evicted.toLocaleString()}`)
    console.log(`  Net proxy delta:   ${(created - evicted).toLocaleString()}`)
    console.log(`  Eviction ratio:    ${(evicted / created * 100).toFixed(1)}%`)
  })

  test('watchEffect overhead', () => {
    const state = createProductionStateTree()
    const proxy = reactive(state) as any

    gc()
    const heapBefore = process.memoryUsage().heapUsed

    // 50 watchers mimicking Vue components
    const stops: (() => void)[] = []
    for (let i = 0; i < 50; i++) {
      const accId = String((i % 12) + 1)
      const stop = watchEffect(() => {
        const acc = proxy.accounts[accId]
        if (!acc) return
        const _v = acc.villages.length
        for (let vi = 0; vi < acc.villages.length; vi++) {
          const v = acc.villages[vi]
          const _n = v.village.name
          const _w = v.storage?.wood
        }
      })
      stops.push(stop)
    }

    gc()
    const heapAfterWatch = process.memoryUsage().heapUsed
    const watchCost = heapAfterWatch - heapBefore

    // Trigger updates to see re-execution cost
    for (let i = 0; i < 20; i++) {
      proxy.accounts['1'].villages[0].storage.wood = i * 100
    }

    gc()
    const heapAfterTrigger = process.memoryUsage().heapUsed

    // Cleanup
    for (const stop of stops) stop()
    gc()
    const heapAfterCleanup = process.memoryUsage().heapUsed

    console.log('\n=== watchEffect Overhead ===')
    console.log(`  50 watchers:          ${fmt(watchCost)}`)
    console.log(`  Per watcher:          ${fmt(watchCost / 50)}`)
    console.log(`  After 20 triggers:    ${fmt(heapAfterTrigger - heapAfterWatch)}`)
    console.log(`  Reclaimed on stop:    ${fmt(heapAfterWatch - heapAfterCleanup)}`)
  })

  test('pathConcatCache bounded', () => {
    const state = createProductionStateTree()
    const proxy = reactive(state) as any

    // Traverse all paths
    JSON.stringify(proxy)

    const stats = getProxyStats()
    console.log('\n=== Path Cache ===')
    console.log(`  pathConcatCache size: ${stats.pathConcatCacheSize}`)

    expect(stats.pathConcatCacheSize).toBeLessThanOrEqual(1000)
  })

  test('emit event collector memory', () => {
    // Check if collected events themselves are a significant memory source
    const state = createProductionStateTree()
    const { events, emit } = collectEvents()

    gc()
    const before = process.memoryUsage().heapUsed

    const proxy = reactive(state, emit)
    // Full traversal generates initial replace event only

    // Simulate many mutations
    for (let i = 0; i < 100; i++) {
      ;(proxy as any).accounts['1'].villages[0].storage.wood = i * 100
      ;(proxy as any).accounts['1'].villages[0].storage.clay = i * 90
      ;(proxy as any).accounts['1'].villages[0].storage.iron = i * 80
      ;(proxy as any).accounts['1'].villages[0].storage.crop = i * 70
    }

    gc()
    const after = process.memoryUsage().heapUsed

    console.log('\n=== Event Collector Memory ===')
    console.log(`  Events collected: ${events.length}`)
    console.log(`  Heap growth:      ${fmt(after - before)}`)
    console.log(`  Per event:        ${events.length > 0 ? fmt((after - before) / events.length) : 'N/A'}`)

    // Events include oldValue references — check if those hold large objects
    const eventWithOldValue = events.find(e => e.oldValue !== undefined && typeof e.oldValue === 'object')
    console.log(`  Events with object oldValues: ${events.filter(e => e.oldValue !== undefined && typeof e.oldValue === 'object').length}`)
  })
})
