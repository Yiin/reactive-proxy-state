import { expect, test, describe } from 'bun:test'
import { reactive, deepClone, getProxyStats, resetProxyStats } from '../src/index'
import { ReactiveFlags } from '../src/constants'

/**
 * Reproduces the production hang/OOM in bd vangrd-fi56i: deepClone recurses
 * forever when the raw tree it is walking contains a stored reactive proxy
 * that references an ancestor. Each traversal lap through the proxy mints a
 * "new" identity at the get trap, so the `seen` WeakMap cycle guard never
 * fires for that node.
 */

describe('deepClone: proxy-proof traversal', () => {
  test('clones a reactive proxy over a cyclic raw object and terminates', () => {
    const raw: any = {}
    raw.self = raw

    const proxy = reactive(raw)
    const clone = deepClone(proxy)

    expect(clone.self).toBe(clone)
    expect((clone as any)[ReactiveFlags.IS_REACTIVE]).toBeUndefined()
  })

  test('terminates when a stored proxy inside the raw tree references an ancestor', () => {
    const raw: any = { child: {} }
    const proxy = reactive(raw)
    const rawChild = raw.child
    // Contaminate the raw tree: the child holds a reactive proxy pointing
    // back at the root, forming a cycle through proxy identity rather than
    // raw identity. This hung deepClone before the fix.
    rawChild.parentRef = proxy

    const clone = deepClone(proxy)

    expect(clone.child.parentRef).toBe(clone)
    expect((clone.child.parentRef as any)[ReactiveFlags.IS_REACTIVE]).toBeUndefined()
  })

  test('terminates when the stored proxy is nested two levels deep', () => {
    const raw: any = { level1: { level2: {} } }
    const proxy = reactive(raw)
    const rawLevel2 = raw.level1.level2
    rawLevel2.parentRef = proxy

    const clone = deepClone(proxy)

    expect(clone.level1.level2.parentRef).toBe(clone)
    expect((clone.level1.level2.parentRef as any)[ReactiveFlags.IS_REACTIVE]).toBeUndefined()
  })

  test('proxy allocation during clone is bounded (repeat clones allocate none)', () => {
    resetProxyStats()

    const raw: any = {
      accounts: {} as Record<string, any>,
    }
    for (let i = 0; i < 50; i++) {
      raw.accounts[i] = {
        villages: [{ id: i, settings: { buildPlan: [{ kind: 'building', targetLevel: i }] } }],
      }
    }

    const proxy = reactive(raw)
    // Reads deliberately go through the get traps (vue3 dep tracking), so the
    // first clone may lazily create child wrappers — but they are cached, so
    // a second clone of the same tree must allocate zero new proxies. The
    // incident mode was unbounded allocation per traversal lap.
    deepClone(proxy)
    const statsBefore = getProxyStats()
    deepClone(proxy)
    const statsAfter = getProxyStats()

    expect(statsAfter.created).toBe(statsBefore.created)
  })
})
