# updateState

Applies a state change event to an object. This function is particularly useful for synchronizing state changes between different contexts, such as between the main thread and a worker, or between server and client.

## Signature

```ts
function updateState(target: any, event: StateEvent): void
```

## Parameters

- `target`: The object to update, which can be a plain object or contain specialized collections (Map, Set, Array).
- `event`: A `StateEvent` object describing the change to apply.

## StateEvent Interface

```ts
interface StateEvent {
  // Determines the type of operation to perform
  action: 'set' | 'delete' | 'set-add' | 'set-delete' | 'map-set' | 'array-splice';
  
  // Path to the target property as an array of keys/indices
  path: (string | number)[];
  
  // For 'set' and 'map-set' actions
  newValue?: any;
  
  // For 'set-add', 'set-delete' actions
  value?: any;
  
  // For 'array-splice' action
  key?: number;        // Start index for splice
  deleteCount?: number; // Number of elements to delete
  items?: any[];       // Elements to add (optional)
}
```

## Examples

### Setting a Property Value

```ts
import { updateState } from '@yiin/reactive-proxy-state';

const obj = { count: 0 };

// Update the 'count' property
updateState(obj, {
  action: 'set',
  path: ['count'],
  newValue: 1
});

console.log(obj.count); // 1
```

### Updating a Nested Property

```ts
import { updateState } from '@yiin/reactive-proxy-state';

const user = {
  profile: {
    name: 'John',
    settings: {
      theme: 'light'
    }
  }
};

// Update a nested property
updateState(user, {
  action: 'set',
  path: ['profile', 'settings', 'theme'],
  newValue: 'dark'
});

console.log(user.profile.settings.theme); // 'dark'
```

### Working with Maps

```ts
import { updateState } from '@yiin/reactive-proxy-state';

const state = {
  preferences: new Map([['theme', 'light']])
};

// Add a new key-value pair to the Map
updateState(state, {
  action: 'set',
  path: ['preferences', 'language'],
  newValue: 'en'
});

// Delete a key from the Map
updateState(state, {
  action: 'delete',
  path: ['preferences', 'theme']
});

console.log(state.preferences.get('language')); // 'en'
console.log(state.preferences.has('theme')); // false
```

### Working with Sets

```ts
import { updateState } from '@yiin/reactive-proxy-state';

const state = {
  tags: new Set(['important'])
};

// Add a value to the Set
updateState(state, {
  action: 'set-add',
  path: ['tags'],
  value: 'urgent'
});

// Remove a value from the Set
updateState(state, {
  action: 'set-delete',
  path: ['tags'],
  value: 'important'
});

console.log(Array.from(state.tags)); // ['urgent']
```

### Working with Arrays

```ts
import { updateState } from '@yiin/reactive-proxy-state';

const state = {
  items: ['apple', 'banana', 'orange']
};

// Add an element at a specific index
updateState(state, {
  action: 'set',
  path: ['items', '3'],
  newValue: 'pear'
});

// Remove elements using array-splice
updateState(state, {
  action: 'array-splice',
  path: ['items'],
  key: 0, // Start at index 0
  deleteCount: 1 // Remove 1 element
});

console.log(state.items); // ['banana', 'orange', 'pear']
```

### Applying Multiple Updates

You can apply multiple state events sequentially:

```ts
import { updateState } from '@yiin/reactive-proxy-state';

const state = {
  count: 0,
  user: { name: 'John' },
  items: ['apple'],
  tags: new Set(['draft'])
};

const events = [
  { action: 'set', path: ['count'], newValue: 1 },
  { action: 'set', path: ['user', 'name'], newValue: 'Jane' },
  { action: 'set', path: ['items', '1'], newValue: 'banana' },
  { action: 'set-add', path: ['tags'], value: 'important' }
];

// Apply all updates
events.forEach(event => updateState(state, event));

console.log(state.count); // 1
console.log(state.user.name); // 'Jane'
console.log(state.items); // ['apple', 'banana']
console.log(Array.from(state.tags)); // ['draft', 'important']
```

## Use Cases

1. **State Synchronization**: Apply changes from one context to another (e.g., main thread to worker).
2. **Remote State Management**: Serialize state changes for transmission over a network.
3. **Undo/Redo Functionality**: Record state events for implementing undo/redo.
4. **Time-Travel Debugging**: Replay a series of state events to reconstruct a specific state.

## Notes

- `updateState` does not validate paths or actions. It's assumed that the events are valid and match the structure of the target object.
- For optimal performance, prefer batching multiple state updates when possible.
- If applying events to a reactive state, be aware that each call to `updateState` might trigger reactive effects. 