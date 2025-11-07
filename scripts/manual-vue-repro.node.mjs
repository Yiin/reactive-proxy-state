import { reactive as vueReactive } from 'vue';
import { trackVueReactiveEvents } from '../dist/index.js';

const vueState = vueReactive({ knowledge: { accounts: [{ id: 1 }] } });
console.log('setup: created vueState (node)');

const stop = trackVueReactiveEvents(vueState, (e) =>
  console.log('event:', JSON.stringify(e))
);

// find current account and add a new array property, then push to it
const acc = vueState.knowledge.accounts.find((a) => a.id === 1);
if (!acc.jobs) {
  acc.jobs = [{ name: 'sched-1' }];
} else {
  acc.jobs.push({ name: 'sched-1' });
}
acc.jobs.push({ name: 'sched-2' });

console.log('done');
stop();

