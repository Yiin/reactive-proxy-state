import { describe, test, expect, mock } from 'bun:test';
import { trackVueReactiveEvents, StateEvent, reactive as rpsReactive, updateState } from '../src/index';
import { reactive as vueReactive } from 'vue';

describe('Vue 3 adapter (trackVueReactiveEvents)', () => {
  test('emits initial replace and basic set/delete events', () => {
    const emit = mock((ev: StateEvent) => {});
    const vueState = vueReactive({ count: 0, nested: { n: 1 }, arr: [1] });
    const stop = trackVueReactiveEvents(vueState, emit, { emitInitialReplace: true });

    // first call is replace
    expect(emit).toHaveBeenCalledTimes(1);
    const rep = emit.mock.calls[0][0] as StateEvent;
    expect(rep.action).toBe('replace');
    expect(rep.path).toEqual([]);

    // reset
    emit.mock.calls.length = 0;

    // root set
    vueState.count = 1;
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toEqual({ action: 'set', path: ['count'], oldValue: 0, newValue: 1 });

    // nested set
    vueState.nested.n = 2;
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[1][0]).toEqual({ action: 'set', path: ['nested', 'n'], oldValue: 1, newValue: 2 });

    // delete property
    delete (vueState as any).nested.n;
    const del = emit.mock.calls[2][0] as StateEvent;
    expect(del.action).toBe('delete');
    expect(del.path).toEqual(['nested', 'n']);
    stop();
  });

  test('arrays produce index/length sets sufficient for updateState', () => {
    const emitted: StateEvent[] = [];
    const vueState = vueReactive({ arr: [] as number[] });
    const stop = trackVueReactiveEvents(vueState, (e) => emitted.push(e));
    emitted.length = 0; // ignore initial replace

    vueState.arr.push(1, 2);
    vueState.arr.splice(1, 1, 3);
    vueState.arr.pop();
    // events for reference only; kept to validate shape locally

    // apply to RPS state
    const remote = rpsReactive({ arr: [] as number[] });
    for (const ev of emitted) updateState(remote, ev);

    expect(remote.arr).toEqual(vueState.arr);
    stop();
  });

  test('Map/Set operations map to RPS events and sync via updateState', () => {
    const emitted: StateEvent[] = [];
    const vueState = vueReactive({ mp: new Map<string, any>(), st: new Set<number>() });
    const stop = trackVueReactiveEvents(vueState, (e) => emitted.push(e));
    emitted.length = 0;

    vueState.mp.set('a', 1);
    vueState.mp.set('b', { x: 1 });
    vueState.mp.delete('a');
    vueState.st.add(5);
    vueState.st.delete(5);

    const remote = rpsReactive({ mp: new Map<string, any>(), st: new Set<number>() });
    for (const ev of emitted) updateState(remote, ev);

    expect(remote.mp.get('b')).toEqual({ x: 1 });
    expect(remote.mp.has('a')).toBe(false);
    expect(remote.st.has(5)).toBe(false);
    stop();
  });

  test('disable initial replace when requested', () => {
    const emit = mock((ev: StateEvent) => {});
    const vueState = vueReactive({ a: 1 });
    const stop = trackVueReactiveEvents(vueState, emit, { emitInitialReplace: false });
    expect(emit).toHaveBeenCalledTimes(0);
    vueState.a = 2;
    expect(emit).toHaveBeenCalledTimes(1);
    stop();
  });

  test('object diffs: added, changed, removed props', () => {
    const emitted: StateEvent[] = [];
    const vueState = vueReactive({ obj: { a: 1, b: 2 } as any });
    const stop = trackVueReactiveEvents(vueState, (e) => emitted.push(e));
    emitted.length = 0;

    vueState.obj.a = 10;          // change
    vueState.obj.c = 'x';          // add
    delete vueState.obj.b;         // remove

    const remote = rpsReactive({ obj: { a: 1, b: 2 } as any });
    for (const ev of emitted) updateState(remote, ev);
    expect(remote).toEqual(vueState);
    stop();
  });

  test('arrays: unshift, shift, mid insert, sparse assignment', () => {
    const emitted: StateEvent[] = [];
    const vueState = vueReactive({ arr: [1, 3] as any[] });
    const stop = trackVueReactiveEvents(vueState, (e) => emitted.push(e));
    emitted.length = 0;

    vueState.arr.unshift(0, -1);        // front insert
    vueState.arr.shift();               // remove first
    vueState.arr.splice(2, 0, 2);       // mid insert
    (vueState.arr as any)[5] = 'x';     // sparse assign beyond length

    const remote = rpsReactive({ arr: [1, 3] as any[] });
    for (const ev of emitted) updateState(remote, ev);
    expect(remote.arr).toEqual(vueState.arr);
    stop();
  });

  test('nested arrays of objects: item add and property change', () => {
    const emitted: StateEvent[] = [];
    const vueState = vueReactive({ todos: [{ id: 1, text: 'a' }] as any[] });
    const stop = trackVueReactiveEvents(vueState, (e) => emitted.push(e));
    emitted.length = 0;

    vueState.todos.push({ id: 2, text: 'b' });
    vueState.todos[0].text = 'a!';

    const remote = rpsReactive({ todos: [{ id: 1, text: 'a' }] as any[] });
    for (const ev of emitted) updateState(remote, ev);
    expect(remote.todos).toEqual(vueState.todos);
    stop();
  });

  test('nested: add new array property then push (acc.jobs scenario)', () => {
    const emitted: StateEvent[] = [];
    const vueState = vueReactive({ accounts: [{ id: 1 } as any] });
    const stop = trackVueReactiveEvents(vueState, (e) => emitted.push(e));
    emitted.length = 0;

    // find current account and add a new array property, then push to it
    const acc = vueState.accounts.find((a: any) => a.id === 1)!;
    if (!acc.jobs) {
      acc.jobs = [{ name: 'sched-1' }];
    } else {
      acc.jobs.push({ name: 'sched-1' });
    }
    acc.jobs.push({ name: 'sched-2' });

    // quick visibility for debugging
    // console.log('emitted', JSON.stringify(emitted, null, 2));
    // apply emitted events to RPS state and compare
    const remote = rpsReactive({ accounts: [{ id: 1 } as any] });
    for (const ev of emitted) updateState(remote, ev);

    expect(remote).toEqual(vueState);
    stop();
  });

  test('Map with object values: inner mutation emits map-set replacement', () => {
    const emitted: StateEvent[] = [];
    const vueState = vueReactive({ mp: new Map([[ 'k', { x: 1 } ]]) });
    const stop = trackVueReactiveEvents(vueState, (e) => emitted.push(e));
    emitted.length = 0;

    // mutate inside the object stored in the Map
    (vueState.mp.get('k') as any).x = 2;

    const remote = rpsReactive({ mp: new Map([[ 'k', { x: 1 } ]]) });
    for (const ev of emitted) updateState(remote, ev);
    expect(remote.mp.get('k')).toEqual({ x: 2 });
    stop();
  });

  test('Set with objects: only membership changes emit events', () => {
    const emitted: StateEvent[] = [];
    const o = { x: 1 };
    const vueState = vueReactive({ st: new Set([o]) });
    const stop = trackVueReactiveEvents(vueState, (e) => emitted.push(e));
    emitted.length = 0;

    // mutating object inside set should not emit membership events
    o.x = 2;
    expect(emitted.length).toBe(0);

    // adding and removing object should emit
    const o2 = { x: 3 };
    vueState.st.add(o2);
    vueState.st.delete(o2);

    const remote = rpsReactive({ st: new Set([o]) });
    for (const ev of emitted) updateState(remote, ev);
    expect(remote.st.has(o2)).toBe(false);
    expect(remote.st.has(o)).toBe(true);
    stop();
  });

  test('setting properties to undefined vs delete', () => {
    const emitted: StateEvent[] = [];
    const vueState = vueReactive({ obj: { a: 1, b: 2 } as any });
    const stop = trackVueReactiveEvents(vueState, (e) => emitted.push(e));
    emitted.length = 0;

    vueState.obj.a = undefined;
    delete vueState.obj.b;

    const remote = rpsReactive({ obj: { a: 1, b: 2 } as any });
    for (const ev of emitted) updateState(remote, ev);
    expect('a' in remote.obj).toBe(true);
    expect(remote.obj.a).toBeUndefined();
    expect('b' in remote.obj).toBe(false);
    stop();
  });

  test('Date and BigInt values are preserved via deepClone', () => {
    const emitted: StateEvent[] = [];
    const now = new Date('2022-01-01T00:00:00Z');
    const big = BigInt(123);
    const vueState = vueReactive({ now, big } as any);
    const stop = trackVueReactiveEvents(vueState, (e) => emitted.push(e));
    emitted.length = 0;

    // Mutate both
    (vueState as any).now = new Date('2022-01-02T00:00:00Z');
    (vueState as any).big = BigInt(456);

    const remote = rpsReactive({ now, big } as any);
    for (const ev of emitted) updateState(remote, ev);
    expect(remote.now instanceof Date).toBe(true);
    expect(+remote.now).toBe(+new Date('2022-01-02T00:00:00Z'));
    expect(remote.big).toBe(BigInt(456));
    stop();
  });
});
