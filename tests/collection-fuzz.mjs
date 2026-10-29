import assert from 'node:assert/strict';
const imported = await import(process.argv[2]);
const { reactive, toRaw, updateState } = imported.default ?? imported;
const seeds = Number(process.argv[3] ?? 400);
const steps = Number(process.argv[4] ?? 300);
const aliases = process.argv[5] !== 'noalias';
const symbol = Symbol.for('rpsfix11.metadata');
function normalize(value) {
  if (value === null || typeof value !== 'object') return value;
  value = toRaw(value);
  const entries = value instanceof Map ? [...value].map(([k, v]) => [normalize(k), normalize(v)])
    : value instanceof Set ? [...value].map(normalize)
    : Array.isArray(value) ? value.map(normalize) : null;
  const props = Reflect.ownKeys(value).filter(key => Object.prototype.propertyIsEnumerable.call(value, key))
    .filter(key => !Array.isArray(value) || typeof key === 'symbol' || !/^\d+$/.test(key))
    .map(key => [typeof key === 'symbol' ? `symbol:${String(key)}` : key, normalize(value[key])]);
  return [value instanceof Map ? 'map' : value instanceof Set ? 'set' : Array.isArray(value) ? 'array' : 'object', entries, props];
}
let operations = 0;
for (let seed = 1; seed <= seeds; seed++) {
  let rand = seed;
  const next = n => { rand = (Math.imul(rand, 1664525) + 1013904223) >>> 0; return rand % n; };
  const pool = Array.from({ length: 12 }, (_, i) => ({ id: i % 3 }));
  const memberSet = new Set(pool.slice(0, 4));
  const memberMap = new Map(pool.slice(0, 4).map((key, i) => [key, i]));
  const rows = [];
  const raw = { set: memberSet, map: memberMap, rows, nested: 0 };
  if (aliases) { raw.setAlias = memberSet; raw.mapAlias = memberMap; raw.rowsAlias = rows; }
  let remote;
  let nested = false;
  const state = reactive(raw, event => {
    if (!event.path.length) { remote = event.newValue; return; }
    updateState(remote, event);
    if (nested) { nested = false; state.nested++; }
  }, [], { async: seed % 2 === 0 });
  await Promise.resolve();
  for (let step = 0; step < steps; step++) {
    const member = pool[next(pool.length)];
    nested = next(19) === 0;
    switch (next(10)) {
      case 0: state.set.add(member); break;
      case 1: state.set.delete(member); break;
      case 2: state.map.set(member, step); break;
      case 3: state.map.delete(member); break;
      case 4: {
        const payload = [step];
        const data = { n: step };
        payload.extra = data;
        payload[symbol] = aliases ? data : { n: step };
        const map = new Map([[member, step]]);
        map.extra = { n: step };
        map[symbol] = { n: step };
        const set = new Set([member]);
        set.extra = { n: step };
        set[symbol] = { n: step };
        state.rows.push({ payload, map, set });
        break;
      }
      case 5: state.rows.reverse(); break;
      case 6: if (state.rows.length) { const row = toRaw(state.rows).at(-1); state.rows.pop(); state.rows.unshift(row); } break;
      case 7: if (state.rows.length) { state.rows[0].map.delete(member); state.rows[0].set.delete(member); } break;
      case 8: state.set.delete(member); state.set.add(member); state.map.delete(member); state.map.set(member, step); break;
      case 9: if (state.rows.length > 8) state.rows.splice(0, 3); break;
    }
    await Promise.resolve();
    nested = false;
    assert.deepEqual(normalize(remote), normalize(toRaw(state)), `seed=${seed} step=${step} aliases=${aliases}`);
    operations++;
  }
}
console.log(JSON.stringify({ seeds, steps, aliases, operations, failures: 0 }));
