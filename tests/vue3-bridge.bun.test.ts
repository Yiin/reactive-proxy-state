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
});
