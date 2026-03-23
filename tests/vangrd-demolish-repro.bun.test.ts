/**
 * Reproduction test for vangrd demolish plan sync issue.
 *
 * The app uses Vue 3 reactive for the knowledge tree and trackVueReactiveEvents
 * to emit RPS StateEvents to the server. The server applies them via updateState.
 *
 * Bug: pushing items to a deeply nested array (village.settings.demolishPlan)
 * does not emit any mutation events, so the server never sees the change.
 *
 * This file replicates the exact data shape and access patterns from the app:
 *   knowledge.accounts[accountId].villages[i].settings.demolishPlan
 */
import { describe, test, expect } from 'bun:test'
import { trackVueReactiveEvents, updateState, reactive as rpsReactive } from '../src/index'
import type { StateEvent } from '../src/types'
import { reactive as vueReactive } from 'vue'

// ── Helpers ──────────────────────────────────────────────────────────

function collectEvents(vueState: any) {
  const events: StateEvent[] = []
  const stop = trackVueReactiveEvents(vueState, (e) => events.push(e), {
    emitInitialReplace: false
  })
  return { events, stop }
}

/** Mirrors useVillageSettings(): find village by ID, return its settings */
function findSettings(state: any, accountId: number, villageId: number) {
  const account = state.accounts[accountId]
  const village = account.villages.find((v: any) => v.village.id === villageId)
  return village.settings
}

// ── Fixtures ─────────────────────────────────────────────────────────

/** Minimal knowledge tree matching vangrd shape */
function createKnowledge() {
  return {
    accounts: {
      21: {
        account: { id: 21, server: 'ts31.x3.international.travian.com' },
        villages: [
          {
            village: { id: 26348, name: '01', x: 0, y: 0 },
            settings: {
              demolishPlan: [] as { location: number; targetLevel: number }[]
            },
            buildings: [
              { type: 13, level: 20, location: 27, isUnderConstruction: false }
            ]
          },
          {
            village: { id: 18285, name: '00', x: 1, y: 1 },
            settings: {
              demolishPlan: [] as { location: number; targetLevel: number }[]
            },
            buildings: []
          }
        ]
      }
    },
    nextJobId: 1,
    nextAccountId: 22
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('vangrd demolish plan sync', () => {

  test('push to existing empty demolishPlan array emits events', () => {
    const vueState = vueReactive(createKnowledge())
    const { events, stop } = collectEvents(vueState)

    // Access settings exactly like the app: find village, get .settings
    const settings = findSettings(vueState, 21, 26348)
    expect(settings.demolishPlan).toEqual([])

    // Push an item (what addItem() does in VillageDemolishSettings.vue)
    settings.demolishPlan.push({ location: 27, targetLevel: 0 })

    expect(events.length).toBeGreaterThan(0)
    // Apply to remote and verify sync
    const remote = rpsReactive(createKnowledge())
    for (const ev of events) updateState(remote, ev)
    expect(remote.accounts[21].villages[0].settings.demolishPlan).toEqual([
      { location: 27, targetLevel: 0 }
    ])

    stop()
  })

  test('push multiple items to demolishPlan emits events for each', () => {
    const vueState = vueReactive(createKnowledge())
    const { events, stop } = collectEvents(vueState)

    const settings = findSettings(vueState, 21, 26348)

    settings.demolishPlan.push({ location: 27, targetLevel: 0 })
    settings.demolishPlan.push({ location: 27, targetLevel: 0 })
    settings.demolishPlan.push({ location: 27, targetLevel: 0 })

    expect(events.length).toBeGreaterThan(0)

    const remote = rpsReactive(createKnowledge())
    for (const ev of events) updateState(remote, ev)
    expect(remote.accounts[21].villages[0].settings.demolishPlan.length).toBe(3)

    stop()
  })

  test('demolishPlan initially undefined: assign then push', () => {
    // Some villages start with demolishPlan: undefined
    const knowledge = createKnowledge()
    delete (knowledge.accounts[21].villages[0].settings as any).demolishPlan

    const vueState = vueReactive(knowledge)
    const { events, stop } = collectEvents(vueState)

    const settings = findSettings(vueState, 21, 26348)
    expect(settings.demolishPlan).toBeUndefined()

    // The app does: settings.demolishPlan ?? (settings.demolishPlan = [])
    if (!settings.demolishPlan) {
      settings.demolishPlan = []
    }
    const assignEvents = events.length
    expect(assignEvents).toBeGreaterThan(0)

    // Now push
    settings.demolishPlan.push({ location: 27, targetLevel: 0 })
    expect(events.length).toBeGreaterThan(assignEvents)

    const remote = rpsReactive(knowledge)
    for (const ev of events) updateState(remote, ev)
    expect(remote.accounts[21].villages[0].settings.demolishPlan).toEqual([
      { location: 27, targetLevel: 0 }
    ])

    stop()
  })

  test('demolishPlan initially null: assign then push', () => {
    const knowledge = createKnowledge()
    ;(knowledge.accounts[21].villages[0].settings as any).demolishPlan = null

    const vueState = vueReactive(knowledge)
    const { events, stop } = collectEvents(vueState)

    const settings = findSettings(vueState, 21, 26348)
    expect(settings.demolishPlan).toBeNull()

    // App pattern: settings.demolishPlan ?? (settings.demolishPlan = [])
    settings.demolishPlan = settings.demolishPlan ?? []
    const assignEvents = events.length
    expect(assignEvents).toBeGreaterThan(0)

    settings.demolishPlan.push({ location: 27, targetLevel: 0 })
    expect(events.length).toBeGreaterThan(assignEvents)

    const remote = rpsReactive(knowledge)
    for (const ev of events) updateState(remote, ev)
    expect(remote.accounts[21].villages[0].settings.demolishPlan).toEqual([
      { location: 27, targetLevel: 0 }
    ])

    stop()
  })

  test('splice (remove) from demolishPlan emits events', () => {
    const knowledge = createKnowledge()
    knowledge.accounts[21].villages[0].settings.demolishPlan = [
      { location: 27, targetLevel: 0 },
      { location: 29, targetLevel: 5 }
    ]

    const vueState = vueReactive(knowledge)
    const { events, stop } = collectEvents(vueState)

    const settings = findSettings(vueState, 21, 26348)
    settings.demolishPlan.splice(0, 1) // remove first item

    expect(events.length).toBeGreaterThan(0)

    const remote = rpsReactive(knowledge)
    for (const ev of events) updateState(remote, ev)
    expect(remote.accounts[21].villages[0].settings.demolishPlan).toEqual([
      { location: 29, targetLevel: 5 }
    ])

    stop()
  })

  test('mutations target correct village when accessed via .find()', () => {
    // Regression: mutations sent with wrong array index for the village
    const vueState = vueReactive(createKnowledge())
    const { events, stop } = collectEvents(vueState)

    // Access second village (index 1 in array) via .find()
    const settings = findSettings(vueState, 21, 18285)
    settings.demolishPlan.push({ location: 30, targetLevel: 0 })

    expect(events.length).toBeGreaterThan(0)

    const remote = rpsReactive(createKnowledge())
    for (const ev of events) updateState(remote, ev)

    // Verify the push landed on the correct village
    expect(remote.accounts[21].villages[1].settings.demolishPlan).toEqual([
      { location: 30, targetLevel: 0 }
    ])
    // And NOT on the first village
    expect(remote.accounts[21].villages[0].settings.demolishPlan).toEqual([])

    stop()
  })

  test('full round trip: emit → deepToRaw → serialize → updateState', () => {
    const vueState = vueReactive(createKnowledge())
    const { events, stop } = collectEvents(vueState)

    const settings = findSettings(vueState, 21, 26348)
    settings.demolishPlan.push({ location: 27, targetLevel: 0 })

    // Simulate the actual wire: JSON serialize/deserialize (like socket.io does)
    const serialized = events.map((e) => JSON.parse(JSON.stringify(e)))

    const remote = rpsReactive(createKnowledge())
    for (const ev of serialized) updateState(remote, ev)

    expect(remote.accounts[21].villages[0].settings.demolishPlan).toEqual([
      { location: 27, targetLevel: 0 }
    ])

    stop()
  })

  test('interleaved server mutations do not break client emit', () => {
    // Simulates the real app: server sends runtime mutations while user edits settings
    const vueState = vueReactive(createKnowledge())
    const { events, stop } = collectEvents(vueState)

    // Server-side mutation arrives (e.g. building scan updates)
    vueState.accounts[21].villages[0].buildings[0].level = 19

    const serverEvents = events.length
    expect(serverEvents).toBeGreaterThan(0)

    // User adds demolish item
    const settings = findSettings(vueState, 21, 26348)
    settings.demolishPlan.push({ location: 27, targetLevel: 0 })

    expect(events.length).toBeGreaterThan(serverEvents)

    stop()
  })

  test('push after watchEffect has run with empty array', () => {
    // Specifically test that the watchEffect tracks the empty array's length
    // so that a subsequent push triggers re-evaluation
    const vueState = vueReactive({
      deep: {
        nested: {
          object: {
            with: {
              an: {
                array: [] as any[]
              }
            }
          }
        }
      }
    })
    const { events, stop } = collectEvents(vueState)

    vueState.deep.nested.object.with.an.array.push({ x: 1 })

    expect(events.length).toBeGreaterThan(0)
    expect(events.some((e) =>
      e.path?.join('.').includes('array')
    )).toBe(true)

    stop()
  })
})

/**
 * Tests that replicate the exact app lifecycle:
 * 1. trackVueReactiveEvents set up on empty reactive({accounts: {}})
 * 2. Object.assign(knowledge, serverSnapshot) loads full state while muted
 * 3. Server events applied via updateState while muted
 * 4. User edits demolishPlan after unmuting
 */
describe('vangrd app lifecycle (Object.assign load)', () => {

  test('push to demolishPlan after Object.assign state load', () => {
    // 1. Create empty reactive (like module init)
    const knowledge = vueReactive<any>({ accounts: {}, nextJobId: 1, nextAccountId: 1 })

    // 2. Set up tracking (like module init, before startStateSync)
    let muted = 0
    const events: StateEvent[] = []
    const stop = trackVueReactiveEvents(knowledge, (ev) => {
      if (muted > 0) return // muted, like the real app
      events.push(ev)
    }, { emitInitialReplace: false })

    // 3. Simulate startStateSync: Object.assign while muted
    const serverSnapshot = createKnowledge()
    try {
      muted++
      Object.assign(knowledge, serverSnapshot)
    } finally {
      muted--
    }

    // 4. User adds demolish item
    const settings = findSettings(knowledge, 21, 26348)
    settings.demolishPlan.push({ location: 27, targetLevel: 0 })

    expect(events.length).toBeGreaterThan(0)

    // 5. Verify sync
    const remote = rpsReactive(createKnowledge())
    for (const ev of events) updateState(remote, ev)
    expect(remote.accounts[21].villages[0].settings.demolishPlan).toEqual([
      { location: 27, targetLevel: 0 }
    ])

    stop()
  })

  test('push after Object.assign + pending server events', () => {
    // Replicates the full startup: Object.assign, then pending events, then user edit
    const knowledge = vueReactive<any>({ accounts: {}, nextJobId: 1, nextAccountId: 1 })

    let muted = 0
    const events: StateEvent[] = []
    const stop = trackVueReactiveEvents(knowledge, (ev) => {
      if (muted > 0) return
      events.push(ev)
    }, { emitInitialReplace: false })

    // Load state
    try {
      muted++
      Object.assign(knowledge, createKnowledge())
    } finally {
      muted--
    }

    // Apply pending server events (e.g. building update arrived during load)
    const pendingEvent: StateEvent = {
      action: 'set',
      path: ['accounts', '21', 'villages', 0, 'buildings', 0, 'level'],
      oldValue: 20,
      newValue: 19
    }
    try {
      muted++
      updateState(knowledge, pendingEvent)
    } finally {
      muted--
    }

    // Now user edits demolishPlan
    const settings = findSettings(knowledge, 21, 26348)
    settings.demolishPlan.push({ location: 27, targetLevel: 0 })

    expect(events.length).toBeGreaterThan(0)

    const remote = rpsReactive(createKnowledge())
    // Apply the pending event first (server already has it)
    updateState(remote, pendingEvent)
    // Then apply user events
    for (const ev of events) updateState(remote, ev)

    expect(remote.accounts[21].villages[0].settings.demolishPlan).toEqual([
      { location: 27, targetLevel: 0 }
    ])

    stop()
  })

  test('continuous server mutations do not permanently mute client edits', () => {
    // Simulates rapid server mutations (every few seconds) interleaved with user edits
    const knowledge = vueReactive<any>({ accounts: {}, nextJobId: 1, nextAccountId: 1 })

    let muted = 0
    const events: StateEvent[] = []
    const stop = trackVueReactiveEvents(knowledge, (ev) => {
      if (muted > 0) return
      events.push(ev)
    }, { emitInitialReplace: false })

    // Initial load
    try {
      muted++
      Object.assign(knowledge, createKnowledge())
    } finally {
      muted--
    }

    // Simulate 10 rapid server mutations (storage updates, heartbeats etc.)
    for (let i = 0; i < 10; i++) {
      try {
        muted++
        knowledge.accounts[21].villages[0].buildings[0].level = 20 - i
      } finally {
        muted--
      }
    }

    // User edits demolishPlan after all server mutations
    const settings = findSettings(knowledge, 21, 26348)
    settings.demolishPlan.push({ location: 27, targetLevel: 0 })

    expect(events.length).toBeGreaterThan(0)

    stop()
  })

  test('Object.assign replaces accounts: new key effects are created', () => {
    // The root structural effect should detect the new 'accounts' subtree
    // and create a key effect for it, establishing deep deps
    const knowledge = vueReactive<any>({ accounts: {}, nextJobId: 1, nextAccountId: 1 })

    let muted = 0
    const events: StateEvent[] = []
    const stop = trackVueReactiveEvents(knowledge, (ev) => {
      if (muted > 0) return
      events.push(ev)
    }, { emitInitialReplace: false })

    // Verify accounts starts empty
    expect(Object.keys(knowledge.accounts)).toEqual([])

    // Load state: accounts goes from {} to {21: {...}}
    try {
      muted++
      Object.assign(knowledge, createKnowledge())
    } finally {
      muted--
    }

    // Now modify a deeply nested property
    knowledge.accounts[21].villages[0].settings.demolishPlan.push({
      location: 27,
      targetLevel: 0
    })

    expect(events.length).toBeGreaterThan(0)

    stop()
  })

  test('settings accessed via variable alias still triggers events', () => {
    // In the app, useVillageSettings() captures village.settings at setup time.
    // This reference must still be connected to the reactive tree.
    const knowledge = vueReactive<any>({ accounts: {}, nextJobId: 1, nextAccountId: 1 })

    let muted = 0
    const events: StateEvent[] = []
    const stop = trackVueReactiveEvents(knowledge, (ev) => {
      if (muted > 0) return
      events.push(ev)
    }, { emitInitialReplace: false })

    // Load state
    try {
      muted++
      Object.assign(knowledge, createKnowledge())
    } finally {
      muted--
    }

    // Capture settings reference (like useVillageSettings does at component setup)
    const account = knowledge.accounts[21]
    const village = account.villages.find((v: any) => v.village.id === 26348)
    const settings = village.settings

    // Use the captured reference to get the plan (like the demolishPlan() getter)
    const plan = settings.demolishPlan ?? (settings.demolishPlan = [])
    plan.push({ location: 27, targetLevel: 0 })

    expect(events.length).toBeGreaterThan(0)

    stop()
  })
})
