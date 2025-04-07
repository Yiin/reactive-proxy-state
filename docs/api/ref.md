# ref

Creates a reactive reference to hold any value type. The value is accessed through the `.value` property, which is reactive.

## Signatures

```ts
function ref<T>(value: T): Ref<T>
function ref<T>(): Ref<T | undefined>
```

## Return Value

Returns a reactive reference object with a `.value` property that contains the inner value. Unlike `reactive()`, `ref()` can be used with primitive values (string, number, boolean) as well as objects.

## Type Declarations

```ts
interface Ref<T = any> {
  value: T
}
```

## Examples

### Basic Usage

```ts
import { ref, watchEffect } from '@yiin/reactive-proxy-state';

const count = ref(0);
console.log(count.value); // 0

watchEffect(() => {
  console.log(`Count is: ${count.value}`);
});
// Output: Count is: 0

// Updating .value triggers the effect
count.value++;
// Output: Count is: 1
```

### With Different Value Types

References can hold any value type:

```ts
// Primitive values
const message = ref('hello');
const enabled = ref(true);
const price = ref(9.99);

// Objects
const user = ref({ name: 'Alice', age: 30 });
const items = ref(['apple', 'banana']);
const settings = ref(new Map([['theme', 'dark']]));

// Null/undefined
const nullValue = ref(null);
const undefinedValue = ref();  // defaults to undefined
```

### Reactivity with Object Values

When an object is wrapped in a ref, the object itself isn't made deeply reactive:

```ts
import { ref, watchEffect } from '@yiin/reactive-proxy-state';

const user = ref({ name: 'Alice' });

watchEffect(() => {
  console.log(`User name is: ${user.value.name}`);
});
// Output: User name is: Alice

// This mutation triggers the effect because it replaces the entire .value
user.value = { name: 'Bob' };
// Output: User name is: Bob

// IMPORTANT: This mutation doesn't trigger the effect because
// the ref is only tracking changes to .value itself, not its properties
user.value.name = 'Charlie';
// No output - effect not triggered
```

To make an object deeply reactive, use `reactive()` and track the object itself, or combine both:

```ts
import { ref, reactive, watchEffect } from '@yiin/reactive-proxy-state';

// Option 1: Use reactive directly
const user = reactive({ name: 'Alice' });

// Option 2: Wrap a reactive object in a ref
const userRef = ref(reactive({ name: 'Alice' }));

watchEffect(() => {
  // Option 1
  console.log(`User name is: ${user.name}`);
  
  // Option 2
  console.log(`User ref name is: ${userRef.value.name}`);
});

// Both will trigger the effect
user.name = 'Bob';
userRef.value.name = 'Charlie';
```

## Helper Functions

### `isRef()`

```ts
function isRef<T>(value: any): value is Ref<T>
```

Checks if a value is a ref object.

#### Example

```ts
import { ref, isRef } from '@yiin/reactive-proxy-state';

const count = ref(0);
console.log(isRef(count));           // true
console.log(isRef({ value: 0 }));    // false
console.log(isRef(0));               // false
```

### `unref()`

```ts
function unref<T>(ref: Ref<T> | T): T
```

Returns the inner value if the argument is a ref, otherwise returns the argument itself.

#### Example

```ts
import { ref, unref } from '@yiin/reactive-proxy-state';

const count = ref(0);
console.log(unref(count));    // 0
console.log(unref(1));        // 1
```

## Notes and Best Practices

1. **Always use `.value` to access or modify the ref**:
   ```ts
   const count = ref(0);
   count.value++;  // Correct
   count++;        // Wrong - count is an object, not a number
   ```

2. **Object Reactivity**: `ref()` only tracks changes to the `.value` property itself. For deep reactivity of objects, use `reactive()` or combine with it.

3. **Avoid Unnecessary Refs**: Don't create refs for values that won't change.

4. **Type Narrowing**: TypeScript can properly narrow ref types:
   ```ts
   const maybeNull = ref<string | null>(null);
   
   if (maybeNull.value !== null) {
     // TypeScript knows maybeNull.value is a string here
     console.log(maybeNull.value.toUpperCase());
   }
   ```

5. **Default Values**: It's a good practice to always provide initial values that match your expected types, though you can use type parameters to specify types when needed:
   ```ts
   // Explicit typing
   const name = ref<string | undefined>(undefined);
   ``` 