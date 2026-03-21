/**
 * Run with: node tests/repro-async.mjs
 *
 * Tests with async timing between mutations (matching WS event delivery)
 * and with a persist timer (matching production's scheduleKnowledgePersist).
 * Runs multiple attempts to catch intermittent failures.
 */
import { reactive, watch, updateState, toRaw, isReactive } from '../dist/index.js'

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

let totalPassed = 0
let totalFailed = 0
const ATTEMPTS = 50

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
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

  let muteKnowledge = 0
  const knowledge = reactive(raw, (ev) => {
    if (muteKnowledge > 0) return
  })

  // Persist timer (like production)
  let pendingPersistTimer = null
  function scheduleKnowledgePersist() {
    if (pendingPersistTimer) clearTimeout(pendingPersistTimer)
    pendingPersistTimer = setTimeout(() => {
      pendingPersistTimer = null
      try { JSON.parse(JSON.stringify(knowledge)) } catch {}
    }, 40)
  }

  const stop = watch(knowledge, () => {
    scheduleKnowledgePersist()
  })

  // Runtime sync (like production)
  let pendingRuntimeSync = null
  function scheduleRuntimeSync() {
    if (pendingRuntimeSync) return
    pendingRuntimeSync = setTimeout(() => {
      pendingRuntimeSync = null
      for (const account of Object.values(knowledge.accounts ?? {})) {
        const acc = account.account
      }
    }, 0)
  }

  function applyKnowledgeEvent(event) {
    try {
      muteKnowledge++
      updateState(knowledge, event)
    } finally {
      muteKnowledge--
    }
  }

  const BP28 = ['accounts', '28', 'villages', 2, 'settings', 'buildPlan']

  // Add build plan item
  applyKnowledgeEvent({ action: 'set', path: [...BP28, 'length'], newValue: 1, oldValue: 0 })
  applyKnowledgeEvent({
    action: 'set',
    path: [...BP28, 0],
    newValue: { kind: 'building', location: 20, targetLevel: 1, buildingType: 22 },
  })

  // Wait for persist + runtime sync timers
  await delay(50)

  // Account 23 mutation (triggers watch cycle for entire tree)
  applyKnowledgeEvent({
    action: 'set',
    path: ['accounts', '23', 'villages', 0, 'settings', 'trainingPriorities', 0, 'minTrainAmount'],
    newValue: 3,
    oldValue: 2,
  })

  // Wait for persist
  await delay(50)

  // Rapid targetLevel changes with small async gaps
  let attemptFailed = false
  for (let lvl = 2; lvl <= 20; lvl++) {
    await delay(Math.random() < 0.3 ? 1 : 0) // random small delays

    applyKnowledgeEvent({
      action: 'set',
      path: [...BP28, 0, 'targetLevel'],
      newValue: lvl,
      oldValue: lvl - 1,
    })

    const proxyVal = knowledge.accounts['28'].villages[2].settings.buildPlan[0].targetLevel
    const rawVal = raw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
    if (rawVal !== lvl || proxyVal !== lvl) {
      if (!attemptFailed) {
        console.log(`ATTEMPT ${attempt} FAILED at level ${lvl}: proxy=${proxyVal} raw=${rawVal}`)
        attemptFailed = true
      }
      totalFailed++
    } else {
      totalPassed++
    }
  }

  stop()
  if (pendingPersistTimer) clearTimeout(pendingPersistTimer)
  if (pendingRuntimeSync) clearTimeout(pendingRuntimeSync)

  // Small delay between attempts
  await delay(10)
}

console.log(`\n${totalPassed} passed, ${totalFailed} failed across ${ATTEMPTS} attempts`)
if (totalFailed > 0) process.exit(1)
else console.log('ALL PASSED')
