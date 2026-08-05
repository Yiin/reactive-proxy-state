/**
 * Reproduces the pathCache staleness bug:
 *
 * 1. Set buildPlan[0] = obj1 → later set buildPlan[0].targetLevel = X
 *    → pathCache caches "...buildPlan.0" → proxy wrapping obj1
 * 2. Remove: buildPlan.length = 0
 * 3. Re-add: buildPlan.length = 1, buildPlan[0] = obj2
 * 4. Set buildPlan[0].targetLevel = Y
 *    → pathCache lookup finds STALE proxy wrapping obj1
 *    → mutation goes to detached obj1, not obj2 in the raw tree
 */
import { describe, test, expect } from 'bun:test'
import { reactive, updateState, watch } from '../src/index'
import { pathCache } from '../src/utils'

describe('pathCache staleness after array element replacement', () => {
  test('replacing array element at same index after remove+re-add', () => {
    const raw = {
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

    const state = reactive(raw)
    const stop = watch(state, () => {})

    const BP = ['accounts', '28', 'villages', 2, 'settings', 'buildPlan']

    // === Attempt 1: Add item, modify, remove ===
    updateState(state, { action: 'set', path: [...BP, 'length'], newValue: 1, oldValue: 0 })
    updateState(state, {
      action: 'set',
      path: [...BP, 0],
      newValue: { kind: 'building', targetLevel: 1, buildingType: 9 },
    })

    // Modify targetLevel (populates pathCache for "...buildPlan.0")
    for (let lvl = 2; lvl <= 5; lvl++) {
      updateState(state, {
        action: 'set',
        path: [...BP, 0, 'targetLevel'],
        newValue: lvl,
        oldValue: lvl - 1,
      })
      expect(raw.accounts[28].villages[2].settings.buildPlan[0].targetLevel).toBe(lvl)
    }

    // Remove the building
    updateState(state, { action: 'set', path: [...BP, 'length'], newValue: 0, oldValue: 1 })

    // === Attempt 2: Add NEW item at same index ===
    updateState(state, { action: 'set', path: [...BP, 'length'], newValue: 1, oldValue: 0 })
    updateState(state, {
      action: 'set',
      path: [...BP, 0],
      newValue: { kind: 'building', targetLevel: 1, buildingType: 22 },
    })

    // Trigger watch cycle (like an interleaved account mutation would)
    // This isn't strictly necessary for the bug — it's the pathCache that matters

    // Modify targetLevel on the NEW item
    for (let lvl = 2; lvl <= 20; lvl++) {
      updateState(state, {
        action: 'set',
        path: [...BP, 0, 'targetLevel'],
        newValue: lvl,
        oldValue: lvl - 1,
      })

      const rawVal = raw.accounts[28].villages[2].settings.buildPlan[0].targetLevel
      const proxyVal = (state as any).accounts['28'].villages[2].settings.buildPlan[0].targetLevel

      expect(rawVal).toBe(lvl)
      expect(proxyVal).toBe(lvl)
    }

    stop()
  })

  test('minimal reproduction: set, remove, re-set at same path', () => {
    const raw = { items: [{ nested: [] as any[] }] }
    const state = reactive(raw)
    const stop = watch(state, () => {})

    // Step 1: Add element, modify property (populates pathCache)
    updateState(state, { action: 'set', path: ['items', 0, 'nested', 'length'], newValue: 1, oldValue: 0 })
    updateState(state, {
      action: 'set',
      path: ['items', 0, 'nested', 0],
      newValue: { value: 10 },
    })
    updateState(state, {
      action: 'set',
      path: ['items', 0, 'nested', 0, 'value'],
      newValue: 20,
      oldValue: 10,
    })
    expect(raw.items[0].nested[0].value).toBe(20)

    // Step 2: Remove
    updateState(state, { action: 'set', path: ['items', 0, 'nested', 'length'], newValue: 0, oldValue: 1 })

    // Step 3: Re-add at same index
    updateState(state, { action: 'set', path: ['items', 0, 'nested', 'length'], newValue: 1, oldValue: 0 })
    updateState(state, {
      action: 'set',
      path: ['items', 0, 'nested', 0],
      newValue: { value: 100 },
    })

    // Step 4: Modify property on new element (BUG: stale pathCache entry)
    updateState(state, {
      action: 'set',
      path: ['items', 0, 'nested', 0, 'value'],
      newValue: 200,
      oldValue: 100,
    })

    expect(raw.items[0].nested[0].value).toBe(200)
    expect((state as any).items[0].nested[0].value).toBe(200)

    stop()
  })

  test('pathCache goes stale when proxy set trap replaces array (provisioner scenario)', () => {
    // Reproduces the exact Travian Vanguard bug:
    // 1. Frontend sends mutation: jobs.length = 8 (from 7) → populates pathCache
    // 2. Between mutations, scheduler tick runs provisioner which does:
    //    account.jobs = account.jobs.filter(j => validKind(j.kind))
    //    → The sparse array (length 8, only 7 filled) gets filtered to 7 elements
    //    → deepEqual fails (different length) → set trap fires → raw array replaced
    //    → pathCache still points to OLD 8-element sparse array
    // 3. Frontend sends mutation: jobs[7] = {new job}
    //    → updateState looks up pathCache → gets OLD array → sets on detached array
    //    → Job is lost!
    const raw = {
      accounts: {
        21: {
          jobs: [
            { id: 1, kind: 'job.scan', props: {} },
            { id: 2, kind: 'job.build', props: {} },
          ],
        },
      },
    }

    const state = reactive(raw) as any
    const stop = watch(state, () => {})

    // Step 1: updateState modifies a nested job property → populates pathCache for "accounts.21.jobs"
    updateState(state, {
      action: 'set',
      path: ['accounts', '21', 'jobs', 0, 'kind'],
      newValue: 'job.scanUpdated',
      oldValue: 'job.scan',
    })
    expect(raw.accounts[21].jobs[0].kind).toBe('job.scanUpdated')

    // Step 2: Frontend mutation extends array length (creates sparse slot at index 2)
    // The apply-guard refuses a bare length-grow event (Change 3), so create the sparse
    // slot with a direct JS mutation first; the updateState call below then just resolves
    // and caches the (already-sparse) array, matching the original scenario.
    raw.accounts[21].jobs.length = 3
    updateState(state, {
      action: 'set',
      path: ['accounts', '21', 'jobs', 'length'],
      newValue: 3,
      oldValue: 2,
    })
    // pathCache now has "accounts.21.jobs" → the 3-element sparse array

    // Step 3: Scheduler tick runs provisioner, which filters the sparse array
    // filter() skips holes → produces a 2-element dense array (different from the 3-element sparse one)
    const oldJobs = raw.accounts[21].jobs
    state.accounts[21].jobs = state.accounts[21].jobs.filter(
      (j: any) => j && typeof j.kind === 'string'
    )

    // The raw array IS replaced (deepEqual fails because lengths differ)
    expect(raw.accounts[21].jobs).not.toBe(oldJobs)
    expect(raw.accounts[21].jobs.length).toBe(2)

    // Step 4: Frontend mutation sets the new job at index 2
    updateState(state, {
      action: 'set',
      path: ['accounts', '21', 'jobs', 'length'],
      newValue: 3,
      oldValue: 2,
    })
    updateState(state, {
      action: 'set',
      path: ['accounts', '21', 'jobs', 2],
      newValue: { id: 3, kind: 'job.farmList', props: { delay: 180 } },
    })

    // BUG: without fix, the job is set on the OLD detached array, not the current one
    expect(raw.accounts[21].jobs.length).toBe(3)
    expect(raw.accounts[21].jobs[2]).toEqual({ id: 3, kind: 'job.farmList', props: { delay: 180 } })
    expect(state.accounts[21].jobs[2].kind).toBe('job.farmList')

    // Step 5: Modify a property on the new job
    updateState(state, {
      action: 'set',
      path: ['accounts', '21', 'jobs', 2, 'kind'],
      newValue: 'job.farmListUpdated',
      oldValue: 'job.farmList',
    })
    expect(raw.accounts[21].jobs[2].kind).toBe('job.farmListUpdated')
    expect(state.accounts[21].jobs[2].kind).toBe('job.farmListUpdated')

    stop()
  })

  test('pathCache goes stale when proxy set trap replaces nested object', () => {
    // Same issue but with plain objects, not arrays
    const raw = {
      config: {
        settings: { theme: 'dark', nested: { value: 1 }, extra: 'keep' },
      },
    }

    const state = reactive(raw) as any
    const stop = watch(state, () => {})

    // Populate pathCache for "config.settings"
    updateState(state, {
      action: 'set',
      path: ['config', 'settings', 'theme'],
      newValue: 'light',
      oldValue: 'dark',
    })
    expect(raw.config.settings.theme).toBe('light')

    // Replace settings via proxy set trap with a DIFFERENT object (extra field removed)
    // This passes deepEqual check because content differs
    state.config.settings = { theme: 'light', nested: { value: 1 } }

    // Modify nested property via updateState
    updateState(state, {
      action: 'set',
      path: ['config', 'settings', 'nested', 'value'],
      newValue: 42,
      oldValue: 1,
    })

    expect(raw.config.settings.nested.value).toBe(42)
    expect(state.config.settings.nested.value).toBe(42)

    stop()
  })
})
