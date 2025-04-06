---
layout: home
hero:
  name: Reactive Proxy State
  text: Standalone Reactivity System
  tagline: A lightweight reactivity library inspired by Vue 3's reactivity system, designed for use in any JavaScript environment
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api/
    - theme: alt
      text: View on GitHub
      link: https://github.com/Yiin/reactive-proxy-state

features:
  - title: 🚀 Lightweight & Fast
    details: Small bundle size with zero dependencies, optimized for performance in both browser and Node.js environments.
  
  - title: 🧩 Framework Agnostic
    details: Use with any JavaScript framework or none at all. Perfect for state management, data synchronization, or real-time applications.
  
  - title: 🔄 Deep Reactivity
    details: Automatically tracks nested objects, arrays, Maps and Sets with deep reactivity that just works.
  
  - title: 🛠️ Familiar API
    details: Based on Vue 3's composition API, making it easy to learn if you're already familiar with Vue.
  
  - title: 📐 TypeScript Ready
    details: Built with TypeScript and ships with full type definitions for an excellent developer experience.
  
  - title: 🧪 Well Tested
    details: Comprehensive test suite ensures reactivity works correctly in all edge cases.
---

## Quick Example

```js
import { reactive, ref, computed, watchEffect } from '@yiin/reactive-proxy-state';

// Create reactive state
const count = ref(0);
const user = reactive({
  name: 'Alice',
  settings: { theme: 'dark' }
});

// Create a computed property
const greeting = computed(() => 
  `Hello, ${user.name}! Count is ${count.value}`
);

// Track changes with watchEffect
watchEffect(() => {
  console.log(greeting.value);
  console.log(`Theme: ${user.settings.theme}`);
});
// Output: Hello, Alice! Count is 0
// Output: Theme: dark

// Update state - effects automatically re-run
count.value++;
// Output: Hello, Alice! Count is 1
// Output: Theme: dark

user.name = 'Bob';
// Output: Hello, Bob! Count is 1
// Output: Theme: dark

user.settings.theme = 'light';
// Output: Hello, Bob! Count is 1
// Output: Theme: light
```

## Installation

```bash
# Using bun (recommended for best performance)
bun add @yiin/reactive-proxy-state

# Using npm
npm install @yiin/reactive-proxy-state

# Using yarn
yarn add @yiin/reactive-proxy-state
```
