import { isReactive } from './reactive';
import { StateEvent } from './types';
import { pathCache, setInPathCache, evictDescendantsFromPathCache } from './utils';

// helper to abstract getting a value from a map or object property
function getValue(obj: any, key: any): any {
    if (obj instanceof Map) return obj.get(key);
    return obj[key];
}

// helper to abstract setting a value on a map or object property
function setValue(obj: any, key: any, value: any): void {
    if (obj instanceof Map) obj.set(key, value);
    else obj[key] = value;
}

// helper to abstract deleting a key from a map or object
function deleteValue(obj: any, key: any): void {
    if (obj instanceof Map) obj.delete(key);
    else delete obj[key];
}

/**
 * Validate that a cached path reference is still reachable from the root.
 * External proxy mutations (e.g. `obj.arr = obj.arr.filter(...)`) replace
 * objects without going through updateState, so the pathCache can hold stale
 * references to detached objects. This verifies by walking one step from the
 * grandparent and comparing the reference at the last path segment.
 *
 * Returns the cached value if valid, or undefined if stale (evicting the entry).
 */
function validateCachedPath(root: any, fullPath: (string | number | symbol)[], pathKey: string, cached: any): any {
    if (fullPath.length === 0) return cached;

    // Walk from root to the grandparent (all segments except the last)
    const lastKey = fullPath[fullPath.length - 1];
    let grandparent = root;
    for (let i = 0; i < fullPath.length - 1; i++) {
        grandparent = grandparent ? getValue(grandparent, fullPath[i]) : undefined;
        if (grandparent === undefined) break;
    }

    if (grandparent === undefined) {
        evictDescendantsFromPathCache(root, pathKey);
        return undefined;
    }

    // Check if the value at the last segment is the same reference as cached
    const actual = getValue(grandparent, lastKey);
    if (actual === cached) return cached;

    // Stale reference — evict this entry and all descendants
    evictDescendantsFromPathCache(root, pathKey);
    return undefined;
}

// dispatch table for applying state events based on action type
// this avoids a large switch statement and makes adding new actions easier
const actionHandlers: { [key: string]: (target: any, key: any, event: StateEvent) => void } = {
    'set': function(parent: any, key: any, event: StateEvent) {
        setValue(parent, key, event.newValue);
    },
    'delete': function(parent: any, key: any) {
        deleteValue(parent, key);
    },
    'array-push': function(targetArray: any[], _keyIgnored: any, event: StateEvent) {
        if (!Array.isArray(targetArray)) {
            console.warn(`expected array at path ${event.path.join('.')}`); return;
        }
        if (!event.items) { console.warn('array-push event missing items'); return; }
        // event.key is the starting index, but push always adds to end
        targetArray.push(...event.items);
    },
    'array-pop': function(targetArray: any[], _keyIgnored: any, event: StateEvent) {
        if (!Array.isArray(targetArray)) {
             console.warn(`expected array at path ${event.path.join('.')}`); return;
        }
        // event info (key, oldvalue) not needed to perform pop
        if (targetArray.length > 0) {
            targetArray.pop();
        }
    },
    'array-splice': function(targetArray: any[], _keyIgnored: any, event: StateEvent) {
         if (!Array.isArray(targetArray)) {
             console.warn(`expected array at path ${event.path.join('.')}`); return;
         }
         if (event.key === undefined || event.deleteCount === undefined) {
             console.warn('array-splice event missing key or deletecount'); return;
         }
         // handle splice with or without items to insert
         if (event.items && event.items.length > 0) {
            targetArray.splice(event.key, event.deleteCount, ...event.items);
         } else {
            targetArray.splice(event.key, event.deleteCount);
         }
    },
    'array-shift': function(targetArray: any[], _keyIgnored: any, event: StateEvent) {
         if (!Array.isArray(targetArray)) {
             console.warn(`expected array at path ${event.path.join('.')}`); return;
         }
        // event info not needed to perform shift
         if (targetArray.length > 0) {
            targetArray.shift();
         }
    },
    'array-unshift': function(targetArray: any[], _keyIgnored: any, event: StateEvent) {
         if (!Array.isArray(targetArray)) {
             console.warn(`expected array at path ${event.path.join('.')}`); return;
         }
        if (!event.items) { console.warn('array-unshift event missing items'); return; }
        // event.key (always 0) not needed to perform unshift
        targetArray.unshift(...event.items);
    },
    // note: for map/set operations originating from the proxy wrapper (e.g., map.set(k,v)),
    // the *event path* points to the map itself, and event.key/event.value hold the map's key/value.
    // however, the actionHandlers expect `target` to be the collection and `key` to be the map/set key.
    // the logic in `updateState` below handles finding the correct target collection first.
    'map-set': function(targetMap: Map<any, any>, _parentKeyIgnored: any, event: StateEvent) {
        if (!(targetMap instanceof Map)) {
             console.warn(`expected map at path ${event.path.join('.')}`); return;
        }
        targetMap.set(event.key, event.newValue);
    },
    'map-delete': function(targetMap: Map<any, any>, _parentKeyIgnored: any, event: StateEvent) {
         if (!(targetMap instanceof Map)) {
             console.warn(`expected map at path ${event.path.join('.')}`); return;
         }
        targetMap.delete(event.key);
    },
    'map-clear': function(targetMap: Map<any, any>, _parentKeyIgnored: any, event: StateEvent) {
         if (!(targetMap instanceof Map)) {
             console.warn(`expected map at path ${event.path.join('.')}`); return;
         }
        targetMap.clear();
    },
    'set-add': function(targetSet: Set<any>, _keyIgnored: any, event: StateEvent) {
         if (!(targetSet instanceof Set)) {
             console.warn(`expected set at path ${event.path.join('.')}`); return;
         }
        targetSet.add(event.value);
    },
    'set-delete': function(targetSet: Set<any>, _keyIgnored: any, event: StateEvent) {
         if (!(targetSet instanceof Set)) {
             console.warn(`expected set at path ${event.path.join('.')}`); return;
         }
        targetSet.delete(event.value);
    },
    'set-clear': function(targetSet: Set<any>, _keyIgnored: any, event: StateEvent) {
         if (!(targetSet instanceof Set)) {
             console.warn(`expected set at path ${event.path.join('.')}`); return;
         }
        targetSet.clear();
    },
    'replace': function(target: any, _keyIgnored: any, event: StateEvent) {
        const newValue = event.newValue;
        if (newValue === undefined || newValue === null) {
            console.warn('replace action requires newValue');
            return;
        }

        // determine type and replace content accordingly
        if (Array.isArray(target) && Array.isArray(newValue)) {
            target.splice(0, target.length, ...newValue);
        } else if (target instanceof Map && newValue instanceof Map) {
            const newValueEntries = [...newValue.entries()];
            target.clear();
            for (const [key, value] of newValueEntries) {
                target.set(key, value);
            }
        } else if (target instanceof Set && newValue instanceof Set) {
            const newValueEntries = [...newValue.values()];
            target.clear();
            for (const value of newValueEntries) {
                target.add(value);
            }
        } else if (typeof target === 'object' && target !== null && typeof newValue === 'object' && newValue !== null) {
            // plain object replacement
            Object.keys(target).forEach(key => delete target[key]);
            Object.assign(target, newValue);
        } else {
            console.warn(`Type mismatch or unsupported type for 'replace' action at path ${event.path.join('.')}. Target type: ${typeof target} ${target.constructor.name}, New value type: ${typeof newValue} ${newValue.constructor.name}`);
        }
    }
};

/**
 * Applies a state change event to a plain javascript object/array (the target state)
 * 
 * @param root - The root object/array to apply the event to
 * @param event - The state change event to apply
 */
export function updateState(root: any, event: StateEvent): void {
    const { action, path } = event;

    // Allow empty path ONLY for 'replace' action to target the root
    if (!path || (path.length === 0 && action !== 'replace')) {
        console.warn('event path is invalid for action', event);
        return;
    }

    const handler = actionHandlers[action];
    if (!handler) {
        // maybe allow custom handlers or ignore unknown actions?
        console.error(`unhandled action type: ${action}`, event);
        return;
        // throw new Error(`Unhandled action: ${action}`);
    }

    // determine the target object/collection and the specific key (if applicable)
    // based on the action type and the event path.
    let targetForHandler: any;
    let keyForHandler: any = null; // key passed to handler, relevant for set/delete

    // path resolution logic differs based on action type:
    // - set/delete: path leads to the *value* being set/deleted, so we need the parent object and the final path segment (key).
    // - array-*/map-*/set-*: path leads to the *collection* itself.

    if (action === 'set' || action === 'delete') {
        // need the parent object and the final key
        if (path.length === 1) {
            targetForHandler = root; // parent is the root object
            keyForHandler = path[0];
        } else {
            const parentPath = path.slice(0, -1);
            const parentPathKey = parentPath.join('.');
            // try cache first for performance
            let parent = pathCache.get(root)?.get(parentPathKey);
            if (parent !== undefined) {
                // Validate cached reference: external proxy mutations (e.g. arr = arr.filter())
                // can replace objects without invalidating pathCache. Verify the cached value
                // is still reachable by checking the last segment from its grandparent.
                parent = validateCachedPath(root, parentPath, parentPathKey, parent);
            }
            if (parent === undefined) {
                // traverse path manually if not in cache
                parent = parentPath.reduce((acc: any, key: any) => acc ? getValue(acc, key) : undefined, root);
                if (parent !== undefined) setInPathCache(root, parentPathKey, parent); // cache if found
            }
            if (parent === undefined) {
                console.warn(`parent path ${parentPathKey} not found for action ${action}`);
                return;
            }
            targetForHandler = parent;
            keyForHandler = path[path.length - 1];
        }
    } else if (action.startsWith('array-') || action.startsWith('map-') || action.startsWith('set-') || action === 'replace') {
        // need the target object itself (array, map, set, or object for replace)
        if (path.length === 0 && action === 'replace') {
             // special case: replace action on the root object itself
             targetForHandler = root;
        } else {
            const targetPath = path;
            const targetPathKey = targetPath.join('.');
            // try cache first
            let targetCollection = pathCache.get(root)?.get(targetPathKey);
            if (targetCollection !== undefined) {
                targetCollection = validateCachedPath(root, targetPath, targetPathKey, targetCollection);
            }
            if (targetCollection === undefined) {
                 // traverse path manually if not in cache
                 targetCollection = targetPath.reduce((acc: any, key: any) => acc ? getValue(acc, key) : undefined, root);
                 if (targetCollection !== undefined) setInPathCache(root, targetPathKey, targetCollection); // cache if found
            }

            if (targetCollection === undefined) {
                 console.warn(`target at path ${targetPathKey} not found for action ${action}`);
                 return;
            }
            targetForHandler = targetCollection;
        }
        // keyForHandler remains null for these actions as the handler operates directly on the target
    } else {
         // this should not be reachable if handler lookup succeeded
         console.error(`unexpected action type passed checks: ${action}`);
         return;
    }

    // call the appropriate handler with the resolved target and key
    handler(targetForHandler, keyForHandler, event);

    // When a 'set' replaces an object/array value, any cached paths below it
    // now point to the old (detached) object. Evict them so the next lookup
    // traverses through the new value.
    if (action === 'set' && event.newValue != null && typeof event.newValue === 'object') {
        const fullPathKey = path.join('.');
        evictDescendantsFromPathCache(root, fullPathKey);
    }
}
