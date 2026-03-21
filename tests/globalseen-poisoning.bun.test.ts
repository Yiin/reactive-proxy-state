import { expect, test, describe } from 'bun:test'
import { reactive, watch, updateState } from '../src/index'
import { globalSeen, deepEqualCache } from '../src/utils'

/**
 * Reproduces the production bug where updateState sets a value on a
 * newly-added array element, but the value doesn't stick.
 *
 * Production scenario:
 * 1. Large state tree with multiple accounts watched by a persist watcher
 * 2. Client adds a build plan item (sets array length, then sets element)
 * 3. Between add and property mutation, another account's mutation arrives
 * 4. Client rapidly sets targetLevel on the new item — VALUE MISMATCH
 *
 * Server logs show:
 *   accounts: proxy → 28: proxy → villages: RAW-OBJECT → ...
 *   serverBefore: always 1, rawValue: always 1 after set to 2,3,4...
 */

describe('production bug: updateState mutation not sticking', () => {
  test('rapid targetLevel changes after adding build plan item (single account)', () => {
    const raw = {
      accounts: {
        28: {
          villages: [
            { village: { id: 1 }, settings: { buildPlan: [] as any[], other: false } },
            { village: { id: 2 }, settings: { buildPlan: [] as any[], other: false } },
            { village: { id: 3 }, settings: { buildPlan: [] as any[], other: false } },
          ],
        },
      },
    }

    const state = reactive(raw)
    let watchCount = 0
    const stop = watch(state, () => { watchCount++ })

    const BP = ['accounts', '28', 'villages', 2, 'settings', 'buildPlan']

    // Add item
    updateState(state, { action: 'set', path: [...BP, 'length'], newValue: 1, oldValue: 0 })
    updateState(state, {
      action: 'set',
      path: [...BP, 0],
      newValue: { kind: 'building', location: 20, targetLevel: 1, buildingType: 22 },
    })

    // Rapid targetLevel changes
    for (let lvl = 2; lvl <= 20; lvl++) {
      updateState(state, {
        action: 'set',
        path: [...BP, 0, 'targetLevel'],
        newValue: lvl,
        oldValue: lvl - 1,
      })
      const proxy = (state as any).accounts['28'].villages[2].settings.buildPlan[0].targetLevel
      const rawVal = raw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
      if (proxy !== lvl || rawVal !== lvl) {
        console.log(`FAIL at level ${lvl}: proxy=${proxy} raw=${rawVal}`)
      }
      expect(rawVal).toBe(lvl)
      expect(proxy).toBe(lvl)
    }

    stop()
  })

  test('interleaved mutations from different accounts (production pattern)', () => {
    // This matches the production log pattern:
    // 1. account 28: buildPlan.length = 1
    // 2. account 28: buildPlan[0] = {...}
    // 3. account 23: trainingPriorities change  ← triggers watch cycle for entire tree
    // 4. persist flush
    // 5. account 28: buildPlan[0].targetLevel = 2  ← VALUE MISMATCH
    const raw = {
      accounts: {
        23: {
          villages: [
            {
              village: { id: 100 },
              settings: { trainingPriorities: [{ minTrainAmount: 2 }], buildPlan: [] as any[] },
            },
          ],
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

    const state = reactive(raw)

    // Persist watcher (like production)
    let persistCount = 0
    const stop = watch(state, () => { persistCount++ })

    const BP28 = ['accounts', '28', 'villages', 2, 'settings', 'buildPlan']

    // Step 1-2: Add build plan item for account 28
    updateState(state, { action: 'set', path: [...BP28, 'length'], newValue: 1, oldValue: 0 })
    updateState(state, {
      action: 'set',
      path: [...BP28, 0],
      newValue: { kind: 'building', location: 20, targetLevel: 1, buildingType: 22 },
    })

    // Verify add worked
    expect(raw.accounts[28].villages[2].settings.buildPlan[0]).toEqual({
      kind: 'building', location: 20, targetLevel: 1, buildingType: 22,
    })

    // Step 3: Account 23 mutation (triggers watch cycle for entire tree)
    updateState(state, {
      action: 'set',
      path: ['accounts', '23', 'villages', 0, 'settings', 'trainingPriorities', 0, 'minTrainAmount'],
      newValue: 3,
      oldValue: 2,
    })

    // Step 4: Simulate persist (reads through proxy, like JSON.stringify would)
    const snapshot = JSON.parse(JSON.stringify(state))

    // Step 5: Rapid targetLevel changes
    const failures: string[] = []
    for (let lvl = 2; lvl <= 20; lvl++) {
      updateState(state, {
        action: 'set',
        path: [...BP28, 0, 'targetLevel'],
        newValue: lvl,
        oldValue: lvl - 1,
      })
      const proxyVal = (state as any).accounts['28'].villages[2].settings.buildPlan[0].targetLevel
      const rawVal = raw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
      if (proxyVal !== lvl || rawVal !== lvl) {
        failures.push(`level=${lvl}: proxy=${proxyVal} raw=${rawVal}`)
      }
    }

    if (failures.length > 0) {
      console.log('FAILURES:', failures)
    }

    const finalProxy = (state as any).accounts['28'].villages[2].settings.buildPlan[0].targetLevel
    const finalRaw = raw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
    expect(finalRaw).toBe(20)
    expect(finalProxy).toBe(20)

    stop()
  })

  test('globalSeen state after watch cycles', () => {
    // Directly inspect globalSeen to understand what happens
    const raw = {
      accounts: {
        23: { data: 'hello' },
        28: {
          villages: [
            { settings: { buildPlan: [] as any[] } },
          ],
        },
      },
    }

    const state = reactive(raw)
    const stop = watch(state, () => {})

    // Add item
    updateState(state, { action: 'set', path: ['accounts', '28', 'villages', 0, 'settings', 'buildPlan', 'length'], newValue: 1, oldValue: 0 })
    updateState(state, {
      action: 'set',
      path: ['accounts', '28', 'villages', 0, 'settings', 'buildPlan', 0],
      newValue: { kind: 'test', targetLevel: 1 },
    })

    const rawItem = raw.accounts[28].villages[0].settings.buildPlan[0]
    const gsEntry = globalSeen.get(rawItem)
    console.log('After add:')
    console.log('  rawItem:', rawItem)
    console.log('  globalSeen entry exists:', !!gsEntry)
    console.log('  entry is different from rawItem:', gsEntry !== rawItem)
    console.log('  entry has __v_isReactive:', gsEntry?.__v_isReactive)

    // Trigger watch cycle via different account
    updateState(state, {
      action: 'set',
      path: ['accounts', '23', 'data'],
      newValue: 'world',
      oldValue: 'hello',
    })

    const gsEntry2 = globalSeen.get(rawItem)
    console.log('After watch cycle (other account mutation):')
    console.log('  globalSeen entry exists:', !!gsEntry2)
    console.log('  same as before:', gsEntry2 === gsEntry)
    console.log('  entry has __v_isReactive:', gsEntry2?.__v_isReactive)

    // Now try the mutation
    updateState(state, {
      action: 'set',
      path: ['accounts', '28', 'villages', 0, 'settings', 'buildPlan', 0, 'targetLevel'],
      newValue: 5,
      oldValue: 1,
    })

    const proxyVal = (state as any).accounts['28'].villages[0].settings.buildPlan[0].targetLevel
    const rawVal = raw.accounts[28].villages[0].settings.buildPlan[0].targetLevel
    console.log('After set targetLevel=5:')
    console.log('  proxy reads:', proxyVal)
    console.log('  raw reads:', rawVal)

    expect(rawVal).toBe(5)
    expect(proxyVal).toBe(5)

    stop()
  })

  test('with deepEqualCache cleared between cycles', () => {
    // Test if deepEqualCache is causing stale comparisons
    const raw = {
      accounts: {
        28: {
          villages: [
            { settings: { buildPlan: [] as any[] } },
          ],
        },
      },
    }

    const state = reactive(raw)
    const stop = watch(state, () => {})

    const BP = ['accounts', '28', 'villages', 0, 'settings', 'buildPlan']

    updateState(state, { action: 'set', path: [...BP, 'length'], newValue: 1, oldValue: 0 })
    updateState(state, {
      action: 'set',
      path: [...BP, 0],
      newValue: { kind: 'building', targetLevel: 1 },
    })

    // Set via proxy directly (not updateState) to check if the issue is in updateState's path resolution
    ;(state as any).accounts['28'].villages[0].settings.buildPlan[0].targetLevel = 5

    const proxyVal = (state as any).accounts['28'].villages[0].settings.buildPlan[0].targetLevel
    const rawVal = raw.accounts[28].villages[0].settings.buildPlan[0].targetLevel
    console.log('Direct proxy set targetLevel=5:')
    console.log('  proxy reads:', proxyVal)
    console.log('  raw reads:', rawVal)

    expect(rawVal).toBe(5)
    expect(proxyVal).toBe(5)

    // Now try via updateState
    updateState(state, {
      action: 'set',
      path: [...BP, 0, 'targetLevel'],
      newValue: 10,
      oldValue: 5,
    })

    const proxyVal2 = (state as any).accounts['28'].villages[0].settings.buildPlan[0].targetLevel
    const rawVal2 = raw.accounts[28].villages[0].settings.buildPlan[0].targetLevel
    console.log('updateState set targetLevel=10:')
    console.log('  proxy reads:', proxyVal2)
    console.log('  raw reads:', rawVal2)

    expect(rawVal2).toBe(10)
    expect(proxyVal2).toBe(10)

    stop()
  })

  test('path types: string vs number indices', () => {
    // Production paths come as strings from WS events
    // Check if string "0" vs number 0 matters
    const raw = {
      items: [{ nested: [{ value: 1 }] }],
    }

    const state = reactive(raw)
    const stop = watch(state, () => {})

    // Using string indices (like WS events produce)
    updateState(state, {
      action: 'set',
      path: ['items', '0', 'nested', '0', 'value'],
      newValue: 42,
      oldValue: 1,
    })

    expect(raw.items[0].nested[0].value).toBe(42)
    expect((state as any).items[0].nested[0].value).toBe(42)

    // Now add a new element and modify it
    updateState(state, { action: 'set', path: ['items', '0', 'nested', 'length'], newValue: 2, oldValue: 1 })
    updateState(state, {
      action: 'set',
      path: ['items', '0', 'nested', '1'],
      newValue: { value: 100 },
    })
    updateState(state, {
      action: 'set',
      path: ['items', '0', 'nested', '1', 'value'],
      newValue: 200,
      oldValue: 100,
    })

    const result = raw.items[0].nested[1].value
    console.log('String index nested mutation:', result)
    expect(result).toBe(200)

    stop()
  })
})
