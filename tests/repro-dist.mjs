/**
 * Run with: node tests/repro-dist.mjs
 *
 * Uses the DIST build (not source) to match production exactly.
 */
import { reactive, watch, updateState, isReactive, toRaw } from '../dist/index.js'

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (!cond) {
    console.error(`  FAIL: ${msg}`)
    failed++
  } else {
    passed++
  }
}

// ---- Test 1: interleaved multi-account (production pattern) ----
console.log('=== Test 1: interleaved multi-account ===')
{
  const raw = {
    accounts: {
      23: {
        villages: [{
          village: { id: 100 },
          settings: { trainingPriorities: [{ minTrainAmount: 2 }], buildPlan: [] },
        }],
      },
      28: {
        villages: [
          { village: { id: 200 }, settings: { buildPlan: [], other: false } },
          { village: { id: 201 }, settings: { buildPlan: [], other: false } },
          { village: { id: 202 }, settings: { buildPlan: [], other: false } },
        ],
      },
    },
  }

  const state = reactive(raw)
  let persistCount = 0
  const stop = watch(state, () => { persistCount++ })

  const BP28 = ['accounts', '28', 'villages', 2, 'settings', 'buildPlan']

  // Step 1-2: Add build plan item
  updateState(state, { action: 'set', path: [...BP28, 'length'], newValue: 1, oldValue: 0 })
  updateState(state, {
    action: 'set',
    path: [...BP28, 0],
    newValue: { kind: 'building', location: 20, targetLevel: 1, buildingType: 22 },
  })

  assert(
    raw.accounts[28].villages[2].settings.buildPlan[0].targetLevel === 1,
    'initial add should set targetLevel=1'
  )

  // Step 3: Account 23 mutation (triggers watch cycle)
  updateState(state, {
    action: 'set',
    path: ['accounts', '23', 'villages', 0, 'settings', 'trainingPriorities', 0, 'minTrainAmount'],
    newValue: 3,
    oldValue: 2,
  })

  // Step 4: Simulate persist read
  JSON.parse(JSON.stringify(state))

  // Step 5: Rapid targetLevel changes
  for (let lvl = 2; lvl <= 20; lvl++) {
    updateState(state, {
      action: 'set',
      path: [...BP28, 0, 'targetLevel'],
      newValue: lvl,
      oldValue: lvl - 1,
    })
    const proxyVal = state.accounts['28'].villages[2].settings.buildPlan[0].targetLevel
    const rawVal = raw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
    assert(rawVal === lvl, `raw targetLevel should be ${lvl}, got ${rawVal}`)
    assert(proxyVal === lvl, `proxy targetLevel should be ${lvl}, got ${proxyVal}`)
  }

  console.log(`  persistCount: ${persistCount}`)
  stop()
}

// ---- Test 2: string indices (WS events use strings) ----
console.log('\n=== Test 2: string indices ===')
{
  const raw = {
    accounts: {
      28: {
        villages: [
          { settings: { buildPlan: [] } },
        ],
      },
    },
  }

  const state = reactive(raw)
  const stop = watch(state, () => {})

  // All string paths (matching WS event format)
  updateState(state, { action: 'set', path: ['accounts', '28', 'villages', '0', 'settings', 'buildPlan', 'length'], newValue: 1, oldValue: 0 })
  updateState(state, {
    action: 'set',
    path: ['accounts', '28', 'villages', '0', 'settings', 'buildPlan', '0'],
    newValue: { kind: 'building', targetLevel: 1 },
  })

  // Trigger watch via unrelated mutation
  state.accounts['28'].villages[0].settings.buildPlan.length // just read to register deps

  updateState(state, {
    action: 'set',
    path: ['accounts', '28', 'villages', '0', 'settings', 'buildPlan', '0', 'targetLevel'],
    newValue: 5,
    oldValue: 1,
  })

  const rawVal = raw.accounts[28].villages[0].settings.buildPlan[0].targetLevel
  const proxyVal = state.accounts['28'].villages[0].settings.buildPlan[0].targetLevel
  assert(rawVal === 5, `raw should be 5, got ${rawVal}`)
  assert(proxyVal === 5, `proxy should be 5, got ${proxyVal}`)

  stop()
}

// ---- Test 3: muted emit + watch (exact server pattern) ----
console.log('\n=== Test 3: muted emit + watch (server pattern) ===')
{
  let muteKnowledge = 0
  const raw = {
    accounts: {
      23: { data: 'hello' },
      28: {
        villages: [
          { settings: { buildPlan: [] } },
          { settings: { buildPlan: [] } },
          { settings: { buildPlan: [] } },
        ],
      },
    },
  }

  const knowledge = reactive(raw, (ev) => {
    if (muteKnowledge > 0) return
  })

  const stop = watch(knowledge, () => {
    // simulate scheduleKnowledgePersist — does nothing sync
  })

  function applyKnowledgeEvent(event) {
    try {
      muteKnowledge++
      updateState(knowledge, event)
    } finally {
      muteKnowledge--
    }
  }

  const BP = ['accounts', '28', 'villages', 2, 'settings', 'buildPlan']

  // Add item (like server receiving WS events)
  applyKnowledgeEvent({ action: 'set', path: [...BP, 'length'], newValue: 1, oldValue: 0 })
  applyKnowledgeEvent({
    action: 'set',
    path: [...BP, 0],
    newValue: { kind: 'building', location: 20, targetLevel: 1, buildingType: 22 },
  })

  // Other account mutation (triggers watch cycle)
  applyKnowledgeEvent({
    action: 'set',
    path: ['accounts', '23', 'data'],
    newValue: 'world',
    oldValue: 'hello',
  })

  // Rapid targetLevel changes
  for (let lvl = 2; lvl <= 20; lvl++) {
    applyKnowledgeEvent({
      action: 'set',
      path: [...BP, 0, 'targetLevel'],
      newValue: lvl,
      oldValue: lvl - 1,
    })

    const rawVal = raw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
    const proxyVal = knowledge.accounts['28'].villages[2].settings.buildPlan[0].targetLevel
    assert(rawVal === lvl, `[muted] raw should be ${lvl}, got ${rawVal}`)
    assert(proxyVal === lvl, `[muted] proxy should be ${lvl}, got ${proxyVal}`)
  }

  stop()
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
