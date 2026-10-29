import assert from 'node:assert/strict';
const sourceModule = await import(process.argv[2]);
const replicaModule = await import(process.argv[3]);
const { reactive } = sourceModule.default ?? sourceModule;
const { reactive: makeReplica, updateState, toRaw } = replicaModule.default ?? replicaModule;
for (const async of [false, true]) {
  const a = { id: 1 }, b = { id: 1 };
  const replica = makeReplica({});
  const state = reactive({ set: new Set([a, b]), map: new Map([[a, 1], [b, 2]]) }, event => updateState(replica, event), [], { async });
  await Promise.resolve();
  state.set.delete(a);
  state.map.delete(a);
  await Promise.resolve();
  assert.equal(replica.set.size, 1);
  assert.deepEqual([...toRaw(replica).map.values()], [2]);
  state.set.add(a);
  state.set.delete(b);
  state.map.set(b, 3);
  state.map.delete(b);
  await Promise.resolve();
  assert.equal(replica.set.size, 1);
  assert.equal(replica.map.size, 0);
  state.set.delete(a);
  await Promise.resolve();
  assert.equal(replica.set.size, 0);
}
console.log('collection membership crosses library instances');
