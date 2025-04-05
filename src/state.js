import { pathCache, setInPathCache } from './utils';
// Pre-allocate helper functions to avoid recreation
function getValue(obj, key) {
    if (obj instanceof Map)
        return obj.get(key);
    return obj[key];
}
function setValue(obj, key, value) {
    if (obj instanceof Map)
        obj.set(key, value);
    else
        obj[key] = value;
}
function deleteValue(obj, key) {
    if (obj instanceof Map)
        obj.delete(key);
    else
        delete obj[key];
}
// Cache for action handlers to avoid switch statement overhead
const actionHandlers = {
    'set': function (parent, key, event) {
        setValue(parent, key, event.newValue);
    },
    'delete': function (parent, key) {
        deleteValue(parent, key);
    },
    'array-push': function (targetArray, _keyIgnored, event) {
        if (!Array.isArray(targetArray)) {
            console.warn(`Expected Array at path ${event.path.join('.')}`);
            return;
        }
        if (!event.items) {
            console.warn('array-push event missing items');
            return;
        }
        // Note: event.key is the starting index, but push always adds to the end.
        targetArray.push(...event.items);
    },
    'array-pop': function (targetArray, _keyIgnored, event) {
        if (!Array.isArray(targetArray)) {
            console.warn(`Expected Array at path ${event.path.join('.')}`);
            return;
        }
        // We don't need event.key or event.oldValue to perform the pop.
        if (targetArray.length > 0) {
            targetArray.pop();
        }
    },
    'array-splice': function (targetArray, _keyIgnored, event) {
        if (!Array.isArray(targetArray)) {
            console.warn(`Expected Array at path ${event.path.join('.')}`);
            return;
        }
        if (event.key === undefined || event.deleteCount === undefined) {
            console.warn('array-splice event missing key or deleteCount');
            return;
        }
        // Call splice with appropriate arguments
        if (event.items && event.items.length > 0) {
            targetArray.splice(event.key, event.deleteCount, ...event.items);
        }
        else {
            targetArray.splice(event.key, event.deleteCount);
        }
    },
    'array-shift': function (targetArray, _keyIgnored, event) {
        if (!Array.isArray(targetArray)) {
            console.warn(`Expected Array at path ${event.path.join('.')}`);
            return;
        }
        // We don't need event.key or event.oldValue to perform the shift.
        if (targetArray.length > 0) {
            targetArray.shift();
        }
    },
    'array-unshift': function (targetArray, _keyIgnored, event) {
        if (!Array.isArray(targetArray)) {
            console.warn(`Expected Array at path ${event.path.join('.')}`);
            return;
        }
        if (!event.items) {
            console.warn('array-unshift event missing items');
            return;
        }
        // We don't need event.key to perform unshift
        targetArray.unshift(...event.items);
    },
    'map-set': function (parent, key, event) {
        const target = getValue(parent, key);
        if (target instanceof Map) {
            target.set(event.key, event.newValue);
        }
        else {
            console.warn(`Expected Map at path ${key}`);
        }
    },
    'map-delete': function (parent, key, event) {
        const target = getValue(parent, key);
        if (target instanceof Map) {
            target.delete(event.key);
        }
        else {
            console.warn(`Expected Map at path ${key}`);
        }
    },
    'map-clear': function (parent, key, event) {
        const target = getValue(parent, key);
        if (target instanceof Map) {
            target.clear();
        }
        else {
            console.warn(`Expected Map at path ${key}`);
        }
    },
    'set-add': function (targetSet, _keyIgnored, event) {
        if (targetSet instanceof Set) {
            targetSet.add(event.value);
        }
        else {
            console.warn(`Expected Set at path ${event.path.join('.')}`);
        }
    },
    'set-delete': function (targetSet, _keyIgnored, event) {
        if (targetSet instanceof Set) {
            targetSet.delete(event.value);
        }
        else {
            console.warn(`Expected Set at path ${event.path.join('.')}`);
        }
    },
    'set-clear': function (targetSet, _keyIgnored, event) {
        if (targetSet instanceof Set) {
            targetSet.clear();
        }
        else {
            console.warn(`Expected Set at path ${event.path.join('.')}`);
        }
    }
};
export function updateState(root, event) {
    const { action, path } = event;
    if (path.length === 0) {
        console.warn('Event path is empty');
        return;
    }
    const handler = actionHandlers[action];
    if (!handler) {
        throw new Error(`Unhandled action: ${action}`);
    }
    // Determine target and key based on action type
    let targetForHandler;
    let keyForHandler = null; // Key is only relevant for set/delete/map actions
    if (action === 'set' || action === 'delete' || action.startsWith('map-')) {
        // Actions where path leads to parent, last element is key
        if (path.length === 1) {
            targetForHandler = root;
            keyForHandler = path[0];
        }
        else {
            const parentPathKey = path.slice(0, -1).join('.');
            let parent = pathCache.get(root)?.get(parentPathKey);
            if (parent === undefined) {
                parent = path.slice(0, -1).reduce((acc, key) => acc ? getValue(acc, key) : undefined, root);
                if (parent !== undefined)
                    setInPathCache(root, parentPathKey, parent);
            }
            if (parent === undefined) {
                console.warn(`Parent path ${parentPathKey} not found for action ${action}`);
                return;
            }
            targetForHandler = parent;
            keyForHandler = path[path.length - 1];
        }
    }
    else if (action.startsWith('array-') || action.startsWith('set-')) {
        // Actions where path leads directly to the collection (Array or Set)
        if (path.length === 1) {
            targetForHandler = getValue(root, path[0]);
        }
        else {
            const parentPathKey = path.slice(0, -1).join('.');
            let parent = pathCache.get(root)?.get(parentPathKey);
            if (parent === undefined) {
                parent = path.slice(0, -1).reduce((acc, key) => acc ? getValue(acc, key) : undefined, root);
                if (parent !== undefined)
                    setInPathCache(root, parentPathKey, parent);
            }
            if (parent === undefined) {
                console.warn(`Parent path ${parentPathKey} not found for action ${action}`);
                return;
            }
            targetForHandler = getValue(parent, path[path.length - 1]);
        }
        if (targetForHandler === undefined) {
            console.warn(`Target collection at path ${path.join('.')} not found for action ${action}`);
            return;
        }
    }
    else {
        // Should not happen if handler exists
        console.error(`Unexpected action type passed checks: ${action}`);
        return;
    }
    // Call the handler with the appropriately determined target and key
    handler(targetForHandler, keyForHandler, event);
}
