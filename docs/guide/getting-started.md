# Getting Started

## Installation

Install the library using your package manager of choice:

```bash
# Using bun (recommended for best performance)
bun add @yiin/reactive-proxy-state

# Using npm
npm install @yiin/reactive-proxy-state

# Using yarn
yarn add @yiin/reactive-proxy-state

# Using pnpm
pnpm add @yiin/reactive-proxy-state
```

## Quick Start

Here's a minimal example demonstrating the core functionality of `reactive-proxy-state`:

```js
import { reactive, watchEffect } from "@yiin/reactive-proxy-state";

// Create a reactive state object
const state = reactive({
  count: 0,
  message: "Hello",
});

// Create an effect that automatically reruns when dependencies change
watchEffect(() => {
  console.log(`Count is ${state.count}, message is "${state.message}"`);
});
// Output: Count is 0, message is "Hello"

// Modify the state - the effect will automatically rerun
state.count++;
// Output: Count is 1, message is "Hello"

state.message = "Reactive State is awesome!";
// Output: Count is 1, message is "Reactive State is awesome!"
```

## Basic Usage Patterns

### Using Reactive Objects

For nested objects, arrays, maps, and sets:

```js
import { reactive, watchEffect } from "@yiin/reactive-proxy-state";

const user = reactive({
  name: "Alice",
  age: 30,
  preferences: {
    theme: "dark",
    notifications: true,
  },
  hobbies: ["reading", "hiking"],
});

watchEffect(() => {
  console.log(`${user.name} is ${user.age} years old`);
  console.log(`Theme: ${user.preferences.theme}`);
  console.log(`Hobbies: ${user.hobbies.join(", ")}`);
});

// Updating properties triggers the effect
user.age = 31;
user.preferences.theme = "light";
user.hobbies.push("coding");
```

### Using Refs for Primitive Values

```js
import { ref, watchEffect } from "@yiin/reactive-proxy-state";

const count = ref(0);
const enabled = ref(true);

watchEffect(() => {
  console.log(`Count: ${count.value}, Enabled: ${enabled.value}`);
});

// Updating .value triggers the effect
count.value++;
enabled.value = false;
```

### Using Computed Properties

```js
import { ref, computed, watchEffect } from "@yiin/reactive-proxy-state";

const width = ref(5);
const height = ref(10);

// Read-only computed
const area = computed(() => width.value * height.value);

// Writable computed
const perimeter = computed({
  get: () => 2 * (width.value + height.value),
  set: (newValue) => {
    // Adjust width to match new perimeter (keeping height constant)
    width.value = newValue / 2 - height.value;
  },
});

watchEffect(() => {
  console.log(`Rectangle: ${width.value} x ${height.value}`);
  console.log(`Area: ${area.value}, Perimeter: ${perimeter.value}`);
});

// Change width directly
width.value = 8;

// Change through writable computed
perimeter.value = 50; // Adjusts width to make perimeter 50
```

## Next Steps

- Read the [Core Concepts](/guide/core-concepts) to understand how the reactivity system works
- Explore the [API Reference](/api/) for detailed documentation of all functions and types
- Browse the [Cookbook](/guide/cookbook) for ready-made patterns
- See more detailed examples in the example repository (coming soon)
