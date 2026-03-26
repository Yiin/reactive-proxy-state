/**
 * Full client→server pipeline reproduction test for the build plan mutation bug.
 *
 * Simulates the EXACT production flow:
 * 1. Client: Vue reactive state + trackVueReactiveEvents captures mutations
 * 2. Transport: JSON.stringify/parse (simulating Socket.IO WebSocket)
 * 3. Server: RPS reactive state + watch + muted applyKnowledgeEvent
 *
 * The bug: user adds a build plan item and rapidly increases targetLevel,
 * but the server's reactive state doesn't persist the changes.
 */
import { describe, test, expect } from 'bun:test'
import {
  reactive as rpsReactive,
  updateState,
  watch,
  deepClone,
  toRaw,
  isReactive,
  type StateEvent,
} from '../src/index'
import { trackVueReactiveEvents } from '../src/integrations/vue3'
import { reactive as vueReactive, toRaw as vueToRaw } from 'vue'
import { globalSeen } from '../src/utils'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Simulate JSON serialization through Socket.IO
function serializeEvent(ev: StateEvent): StateEvent {
  return JSON.parse(JSON.stringify(ev))
}

// Deep version that unwraps Vue proxies before serialization
function deepToRaw(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj
  const raw = vueToRaw(obj)
  if (Array.isArray(raw)) return raw.map(deepToRaw)
  if (raw instanceof Date) return new Date(raw.getTime())
  const result: Record<string, any> = {}
  for (const key of Object.keys(raw)) {
    result[key] = deepToRaw(raw[key])
  }
  return result
}

function serializeEventDeep(ev: StateEvent): StateEvent {
  return JSON.parse(JSON.stringify(deepToRaw(ev)))
}

describe('full pipeline: Vue client → WS → RPS server', () => {
  test('basic: add build plan item then change targetLevel', () => {
    // === CLIENT SIDE ===
    const clientRaw = {
      accounts: {
        28: {
          villages: [
            { village: { id: 200 }, settings: { buildPlan: [] as any[], other: false } },
            { village: { id: 201 }, settings: { buildPlan: [] as any[], other: false } },
            { village: { id: 202 }, settings: { buildPlan: [] as any[], other: false } },
          ],
        },
      },
    }
    const clientState = vueReactive(clientRaw)

    const clientEvents: StateEvent[] = []
    const { stop: stopTracking } = trackVueReactiveEvents(clientState, (ev) => {
      clientEvents.push(ev)
    })
    clientEvents.length = 0 // ignore initial replace

    // === SERVER SIDE ===
    const serverRaw = deepClone(clientRaw) as typeof clientRaw
    const serverState = rpsReactive(serverRaw)
    let muteKnowledge = 0
    let watchCount = 0
    const stopWatch = watch(serverState, () => { watchCount++ })

    function applyOnServer(event: StateEvent) {
      try {
        muteKnowledge++
        updateState(serverState, event)
      } finally {
        muteKnowledge--
      }
    }

    // === USER ACTION: Add building to build plan ===
    clientState.accounts[28].villages[2].settings.buildPlan.push({
      kind: 'building',
      location: 20,
      targetLevel: 1,
      buildingType: 22,
    })

    // Transport events to server
    for (const ev of clientEvents) {
      applyOnServer(serializeEventDeep(ev))
    }
    clientEvents.length = 0

    // Verify initial add
    expect(serverRaw.accounts[28].villages[2].settings.buildPlan[0].targetLevel).toBe(1)

    // === USER ACTION: Rapidly increase targetLevel ===
    for (let lvl = 2; lvl <= 20; lvl++) {
      clientState.accounts[28].villages[2].settings.buildPlan[0].targetLevel = lvl

      // Transport each event individually (like rapid WS messages)
      for (const ev of clientEvents) {
        applyOnServer(serializeEventDeep(ev))
      }
      clientEvents.length = 0

      const proxyVal = (serverState as any).accounts['28'].villages[2].settings.buildPlan[0].targetLevel
      const rawVal = serverRaw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
      expect(rawVal).toBe(lvl)
      expect(proxyVal).toBe(lvl)
    }

    stopTracking()
    stopWatch()
  })

  test('interleaved: multi-account with watch + persist simulation', () => {
    // === CLIENT SIDE ===
    const clientRaw = {
      accounts: {
        23: {
          villages: [{
            village: { id: 100 },
            settings: { trainingPriorities: [{ minTrainAmount: 2 }], buildPlan: [] as any[] },
          }],
        },
        28: {
          villages: [
            { village: { id: 200 }, settings: { buildPlan: [] as any[], other: false } },
            { village: { id: 201 }, settings: { buildPlan: [] as any[], other: false } },
            { village: { id: 202 }, settings: { buildPlan: [] as any[], other: false } },
          ],
        },
      },
    }
    const clientState = vueReactive(clientRaw)

    const clientEvents: StateEvent[] = []
    let muteClient = 0
    const { stop: stopTracking } = trackVueReactiveEvents(clientState, (ev) => {
      if (muteClient > 0) return
      clientEvents.push(ev)
    })
    clientEvents.length = 0

    // === SERVER SIDE ===
    const serverRaw = deepClone(clientRaw) as typeof clientRaw
    const serverState = rpsReactive(serverRaw)
    let muteKnowledge = 0
    let persistCount = 0
    const stopWatch = watch(serverState, () => { persistCount++ })

    function applyOnServer(event: StateEvent) {
      try {
        muteKnowledge++
        updateState(serverState, event)
      } finally {
        muteKnowledge--
      }
    }

    function flushClientEvents() {
      const events = clientEvents.splice(0)
      for (const ev of events) {
        applyOnServer(serializeEventDeep(ev))
      }
    }

    // === Step 1: Add build plan item (client side) ===
    clientState.accounts[28].villages[2].settings.buildPlan.push({
      kind: 'building',
      location: 20,
      targetLevel: 1,
      buildingType: 22,
    })
    flushClientEvents()

    expect(serverRaw.accounts[28].villages[2].settings.buildPlan[0].targetLevel).toBe(1)

    // === Step 2: Account 23 mutation on server (simulating server-side event) ===
    // This is applied directly on the server (like a WS event from a different account context)
    applyOnServer({
      action: 'set',
      path: ['accounts', '23', 'villages', 0, 'settings', 'trainingPriorities', 0, 'minTrainAmount'],
      newValue: 3,
      oldValue: 2,
    })

    // Simulate persist flush (reads entire tree through proxy)
    JSON.parse(JSON.stringify(serverState))

    // === Step 3: Rapid targetLevel changes (client side) ===
    const failures: string[] = []
    for (let lvl = 2; lvl <= 20; lvl++) {
      clientState.accounts[28].villages[2].settings.buildPlan[0].targetLevel = lvl
      flushClientEvents()

      const proxyVal = (serverState as any).accounts['28'].villages[2].settings.buildPlan[0].targetLevel
      const rawVal = serverRaw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
      if (proxyVal !== lvl || rawVal !== lvl) {
        failures.push(`level=${lvl}: proxy=${proxyVal} raw=${rawVal}`)
      }
    }

    if (failures.length > 0) {
      console.log('FAILURES:', failures)
    }

    expect(serverRaw.accounts[28].villages[2].settings.buildPlan[0].targetLevel).toBe(20)
    expect((serverState as any).accounts['28'].villages[2].settings.buildPlan[0].targetLevel).toBe(20)

    stopTracking()
    stopWatch()
  })

  test('async timing: persist timer + runtime sync between mutations', async () => {
    const ATTEMPTS = 20

    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      // === CLIENT SIDE ===
      const clientRaw = {
        accounts: {
          23: {
            villages: [{
              village: { id: 100 },
              settings: { trainingPriorities: [{ minTrainAmount: 2 }], buildPlan: [] as any[] },
            }],
          },
          28: {
            villages: [
              { village: { id: 200 }, settings: { buildPlan: [] as any[], other: false } },
              { village: { id: 201 }, settings: { buildPlan: [] as any[], other: false } },
              { village: { id: 202 }, settings: { buildPlan: [] as any[], other: false } },
            ],
          },
        },
      }
      const clientState = vueReactive(clientRaw)

      const clientEvents: StateEvent[] = []
      const { stop: stopTracking } = trackVueReactiveEvents(clientState, (ev) => {
        clientEvents.push(ev)
      })
      clientEvents.length = 0

      // === SERVER SIDE ===
      const serverRaw = deepClone(clientRaw) as typeof clientRaw
      const serverState = rpsReactive(serverRaw)
      let muteKnowledge = 0

      // Persist timer (matches production's scheduleKnowledgePersist)
      let pendingPersistTimer: ReturnType<typeof setTimeout> | null = null
      function scheduleKnowledgePersist() {
        if (pendingPersistTimer) clearTimeout(pendingPersistTimer)
        pendingPersistTimer = setTimeout(() => {
          pendingPersistTimer = null
          try { JSON.parse(JSON.stringify(serverState)) } catch {}
        }, 40)
      }

      const stopWatch = watch(serverState, () => {
        scheduleKnowledgePersist()
      })

      // Runtime sync (matches production's scheduleRuntimeSync)
      let pendingRuntimeSync: ReturnType<typeof setTimeout> | null = null
      function scheduleRuntimeSync() {
        if (pendingRuntimeSync) return
        pendingRuntimeSync = setTimeout(() => {
          pendingRuntimeSync = null
          for (const account of Object.values((serverState as any).accounts ?? {})) {
            const acc = (account as any).account
          }
        }, 0)
      }

      function applyOnServer(event: StateEvent) {
        try {
          muteKnowledge++
          updateState(serverState, event)
        } finally {
          muteKnowledge--
        }
        scheduleRuntimeSync()
      }

      function flushClientEvents() {
        const events = clientEvents.splice(0)
        for (const ev of events) {
          applyOnServer(serializeEventDeep(ev))
        }
      }

      // === Step 1: Add building ===
      clientState.accounts[28].villages[2].settings.buildPlan.push({
        kind: 'building',
        location: 20,
        targetLevel: 1,
        buildingType: 22,
      })
      flushClientEvents()

      // Wait for persist + runtime sync timers
      await delay(10)

      // === Step 2: Account 23 mutation (triggers watch cycle for entire tree) ===
      applyOnServer({
        action: 'set',
        path: ['accounts', '23', 'villages', 0, 'settings', 'trainingPriorities', 0, 'minTrainAmount'],
        newValue: 3,
        oldValue: 2,
      })

      // Wait for persist
      await delay(10)

      // === Step 3: Rapid targetLevel changes with small async gaps ===
      let attemptFailed = false
      for (let lvl = 2; lvl <= 20; lvl++) {
        // Random small delays like network jitter
        if (Math.random() < 0.3) await delay(1)

        clientState.accounts[28].villages[2].settings.buildPlan[0].targetLevel = lvl
        flushClientEvents()

        const proxyVal = (serverState as any).accounts['28'].villages[2].settings.buildPlan[0].targetLevel
        const rawVal = serverRaw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
        if (rawVal !== lvl || proxyVal !== lvl) {
          if (!attemptFailed) {
            console.log(`ATTEMPT ${attempt} FAILED at level ${lvl}: proxy=${proxyVal} raw=${rawVal}`)
            attemptFailed = true
          }
          expect(rawVal).toBe(lvl)
          expect(proxyVal).toBe(lvl)
        }
      }

      stopTracking()
      stopWatch()
      if (pendingPersistTimer) clearTimeout(pendingPersistTimer)
      if (pendingRuntimeSync) clearTimeout(pendingRuntimeSync)

      await delay(5) // small delay between attempts
    }
  })

  test('server-only: events constructed manually (matching WS format)', () => {
    // This matches what the server actually receives from the client
    const serverRaw = {
      accounts: {
        23: {
          villages: [{
            village: { id: 100 },
            settings: { trainingPriorities: [{ minTrainAmount: 2 }], buildPlan: [] as any[] },
          }],
        },
        28: {
          villages: [
            { village: { id: 200 }, settings: { buildPlan: [] as any[], other: false } },
            { village: { id: 201 }, settings: { buildPlan: [] as any[], other: false } },
            { village: { id: 202 }, settings: { buildPlan: [] as any[], other: false } },
          ],
        },
      },
    }

    const serverState = rpsReactive(serverRaw)
    let muteKnowledge = 0
    const stopWatch = watch(serverState, () => {
      // Simulate persist: full tree serialization
      try { JSON.parse(JSON.stringify(serverState)) } catch {}
    })

    function applyOnServer(event: StateEvent) {
      try {
        muteKnowledge++
        updateState(serverState, event)
      } finally {
        muteKnowledge--
      }
    }

    const BP28 = ['accounts', '28', 'villages', 2, 'settings', 'buildPlan']

    // Add item (events as they come from diffAndCloneArray)
    applyOnServer({ action: 'set', path: [...BP28, 'length'], newValue: 1, oldValue: 0 })
    applyOnServer({
      action: 'set',
      path: [...BP28, 0],
      newValue: { kind: 'building', location: 20, targetLevel: 1, buildingType: 22 },
    })

    // Account 23 mutation (triggers watch for entire tree)
    applyOnServer({
      action: 'set',
      path: ['accounts', '23', 'villages', 0, 'settings', 'trainingPriorities', 0, 'minTrainAmount'],
      newValue: 3,
      oldValue: 2,
    })

    // Simulate persist read
    JSON.parse(JSON.stringify(serverState))

    // Rapid targetLevel changes
    for (let lvl = 2; lvl <= 20; lvl++) {
      applyOnServer({
        action: 'set',
        path: [...BP28, 0, 'targetLevel'],
        newValue: lvl,
        oldValue: lvl - 1,
      })
      const proxyVal = (serverState as any).accounts['28'].villages[2].settings.buildPlan[0].targetLevel
      const rawVal = serverRaw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
      expect(rawVal).toBe(lvl)
      expect(proxyVal).toBe(lvl)
    }

    stopWatch()
  })

  test('globalSeen consistency after watch + deepEqual cycles', () => {
    // Directly verify that globalSeen entries remain consistent
    const serverRaw = {
      accounts: {
        28: {
          villages: [
            { settings: { buildPlan: [] as any[] } },
          ],
        },
      },
    }

    const serverState = rpsReactive(serverRaw)
    let persistCycles = 0
    const stopWatch = watch(serverState, () => {
      persistCycles++
      // Simulate persist: full read through proxy tree
      JSON.parse(JSON.stringify(serverState))
    })

    const BP = ['accounts', '28', 'villages', 0, 'settings', 'buildPlan']

    // Add item
    updateState(serverState, { action: 'set', path: [...BP, 'length'], newValue: 1, oldValue: 0 })
    updateState(serverState, {
      action: 'set',
      path: [...BP, 0],
      newValue: { kind: 'building', targetLevel: 1 },
    })

    // Check globalSeen for the raw build plan item
    const rawItem = serverRaw.accounts[28].villages[0].settings.buildPlan[0]
    const gsEntry = globalSeen.get(rawItem)
    expect(gsEntry).toBeDefined()
    // The entry should be a proxy wrapping rawItem (not a clone)
    if (gsEntry) {
      expect(toRaw(gsEntry)).toBe(rawItem)
    }

    // Trigger multiple watch cycles via mutations
    for (let i = 0; i < 5; i++) {
      updateState(serverState, {
        action: 'set',
        path: [...BP, 0, 'targetLevel'],
        newValue: i + 2,
        oldValue: i + 1,
      })

      // Verify globalSeen still points to the proxy wrapping rawItem
      const entry = globalSeen.get(rawItem)
      expect(entry).toBeDefined()
      if (entry) {
        expect(toRaw(entry)).toBe(rawItem)
      }

      // Verify the value actually changed
      expect(rawItem.targetLevel).toBe(i + 2)
    }

    stopWatch()
  })

  test('events with string indices (matching exact WS JSON format)', () => {
    const serverRaw = {
      accounts: {
        28: {
          villages: [
            { settings: { buildPlan: [] as any[] } },
            { settings: { buildPlan: [] as any[] } },
            { settings: { buildPlan: [] as any[] } },
          ],
        },
      },
    }

    const serverState = rpsReactive(serverRaw)
    const stopWatch = watch(serverState, () => {
      JSON.parse(JSON.stringify(serverState))
    })

    // ALL string paths (matching what comes out of JSON.parse on WS events)
    const BP = ['accounts', '28', 'villages', '2', 'settings', 'buildPlan']

    updateState(serverState, { action: 'set', path: [...BP, 'length'], newValue: 1, oldValue: 0 })
    updateState(serverState, {
      action: 'set',
      path: [...BP, '0'],
      newValue: { kind: 'building', targetLevel: 1 },
    })

    // Trigger watch cycle via unrelated read
    JSON.parse(JSON.stringify(serverState))

    for (let lvl = 2; lvl <= 10; lvl++) {
      updateState(serverState, {
        action: 'set',
        path: [...BP, '0', 'targetLevel'],
        newValue: lvl,
        oldValue: lvl - 1,
      })

      const rawVal = serverRaw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
      const proxyVal = (serverState as any).accounts['28'].villages[2].settings.buildPlan[0].targetLevel
      expect(rawVal).toBe(lvl)
      expect(proxyVal).toBe(lvl)
    }

    stopWatch()
  })

  test('watch callback does synchronous persist (worst case)', () => {
    // What if persist happens SYNCHRONOUSLY in the watch callback?
    // This is the most aggressive scenario — deepEqual + traverse + JSON.stringify all in one cycle
    const serverRaw = {
      accounts: {
        23: { data: 'hello' },
        28: {
          villages: [
            { settings: { buildPlan: [] as any[] } },
            { settings: { buildPlan: [] as any[] } },
            { settings: { buildPlan: [] as any[] } },
          ],
        },
      },
    }

    const serverState = rpsReactive(serverRaw)
    let muteKnowledge = 0

    // Aggressive persist: synchronous JSON.stringify + re-read
    const stopWatch = watch(serverState, () => {
      const snapshot = JSON.parse(JSON.stringify(serverState))
      // Also simulate reading specific values (like a UI subscription would)
      for (const acc of Object.values((serverState as any).accounts ?? {})) {
        const villages = (acc as any).villages
        if (Array.isArray(villages)) {
          for (const v of villages) {
            v.settings?.buildPlan?.length
          }
        }
      }
    })

    function applyOnServer(event: StateEvent) {
      try {
        muteKnowledge++
        updateState(serverState, event)
      } finally {
        muteKnowledge--
      }
    }

    const BP = ['accounts', '28', 'villages', 2, 'settings', 'buildPlan']

    applyOnServer({ action: 'set', path: [...BP, 'length'], newValue: 1, oldValue: 0 })
    applyOnServer({
      action: 'set',
      path: [...BP, 0],
      newValue: { kind: 'building', location: 20, targetLevel: 1, buildingType: 22 },
    })

    // Trigger watch via different account mutation
    applyOnServer({
      action: 'set',
      path: ['accounts', '23', 'data'],
      newValue: 'world',
      oldValue: 'hello',
    })

    // Rapid targetLevel changes
    for (let lvl = 2; lvl <= 20; lvl++) {
      applyOnServer({
        action: 'set',
        path: [...BP, 0, 'targetLevel'],
        newValue: lvl,
        oldValue: lvl - 1,
      })

      const rawVal = serverRaw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
      const proxyVal = (serverState as any).accounts['28'].villages[2].settings.buildPlan[0].targetLevel
      expect(rawVal).toBe(lvl)
      expect(proxyVal).toBe(lvl)
    }

    stopWatch()
  })
})
