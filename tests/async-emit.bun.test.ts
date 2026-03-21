import { expect, test, describe } from 'bun:test'
import { reactive, StateEvent, EmitFunction } from '../src/index'

function createEventCollector(): { events: StateEvent[]; emit: EmitFunction } {
  const events: StateEvent[] = []
  const emit: EmitFunction = (event) => events.push(event)
  return { events, emit }
}

describe('async emit', () => {
  test('emit is NOT called synchronously during mutations', () => {
    const { events, emit } = createEventCollector()
    const state = reactive({ a: 1, b: 2 }, emit, [], { async: true })

    // initial "replace" event is also deferred
    expect(events.length).toBe(0)

    state.a = 10
    state.b = 20

    // still zero -- everything is queued
    expect(events.length).toBe(0)
  })

  test('emit IS called on the next microtask with all events', async () => {
    const { events, emit } = createEventCollector()
    const state = reactive({ a: 1, b: 2 }, emit, [], { async: true })

    state.a = 10
    state.b = 20

    expect(events.length).toBe(0)

    // wait for the microtask to flush
    await Promise.resolve()

    // 1 replace + 2 sets = 3
    expect(events.length).toBe(3)
  })

  test('multiple mutations produce individual events (not coalesced)', async () => {
    const { events, emit } = createEventCollector()
    const state = reactive({ x: 0 }, emit, [], { async: true })

    state.x = 1
    state.x = 2
    state.x = 3

    await Promise.resolve()

    // replace + 3 sets = 4
    expect(events.length).toBe(4)
    // each set event is preserved separately
    const setEvents = events.filter((e) => e.action === 'set')
    expect(setEvents.length).toBe(3)
    expect(setEvents[0].newValue).toBe(1)
    expect(setEvents[1].newValue).toBe(2)
    expect(setEvents[2].newValue).toBe(3)
  })

  test('order of events is preserved', async () => {
    const { events, emit } = createEventCollector()
    const state = reactive({ a: 1, b: 2 }, emit, [], { async: true })

    state.a = 10
    state.b = 20

    await Promise.resolve()

    expect(events[0].action).toBe('replace')
    expect(events[1].action).toBe('set')
    expect(events[1].path).toEqual(['a'])
    expect(events[2].action).toBe('set')
    expect(events[2].path).toEqual(['b'])
  })

  test('nested property mutations also use async emit', async () => {
    const { events, emit } = createEventCollector()
    const state = reactive(
      { nested: { deep: { value: 0 } } },
      emit,
      [],
      { async: true }
    )

    state.nested.deep.value = 42

    // nothing synchronously
    expect(events.length).toBe(0)

    await Promise.resolve()

    // replace + 1 nested set = 2
    expect(events.length).toBe(2)
    expect(events[1].action).toBe('set')
    expect(events[1].path).toEqual(['nested', 'deep', 'value'])
    expect(events[1].newValue).toBe(42)
  })

  test('async: false (default) still works synchronously', () => {
    const { events, emit } = createEventCollector()
    const state = reactive({ a: 1 }, emit)

    // initial replace event fires synchronously
    expect(events.length).toBe(1)
    expect(events[0].action).toBe('replace')

    state.a = 10

    // set event fires synchronously
    expect(events.length).toBe(2)
    expect(events[1].action).toBe('set')
    expect(events[1].newValue).toBe(10)
  })

  test('explicit async: false still works synchronously', () => {
    const { events, emit } = createEventCollector()
    const state = reactive({ a: 1 }, emit, [], { async: false })

    expect(events.length).toBe(1)
    state.a = 10
    expect(events.length).toBe(2)
  })

  test('array mutations use async emit when enabled', async () => {
    const { events, emit } = createEventCollector()
    const state = reactive({ items: [1, 2, 3] }, emit, [], { async: true })

    state.items.push(4)

    expect(events.length).toBe(0)

    await Promise.resolve()

    // replace + array-push
    expect(events.length).toBe(2)
    expect(events[1].action).toBe('array-push')
    expect(events[1].items).toEqual([4])
  })

  test('delete property uses async emit when enabled', async () => {
    const { events, emit } = createEventCollector()
    const state = reactive({ a: 1, b: 2 } as any, emit, [], { async: true })

    delete state.b

    expect(events.length).toBe(0)

    await Promise.resolve()

    // replace + delete
    expect(events.length).toBe(2)
    expect(events[1].action).toBe('delete')
    expect(events[1].path).toEqual(['b'])
  })

  test('subsequent sync ticks after flush schedule new microtasks', async () => {
    const { events, emit } = createEventCollector()
    const state = reactive({ v: 0 }, emit, [], { async: true })

    state.v = 1

    // flush first batch
    await Promise.resolve()

    const countAfterFirst = events.length
    // replace + 1 set = 2
    expect(countAfterFirst).toBe(2)

    // second sync tick
    state.v = 2
    expect(events.length).toBe(countAfterFirst) // still 2

    await Promise.resolve()

    // +1 set = 3
    expect(events.length).toBe(3)
    expect(events[2].newValue).toBe(2)
  })
})
