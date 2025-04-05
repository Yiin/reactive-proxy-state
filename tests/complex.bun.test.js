import { expect, test, describe } from "bun:test";
import { wrapState, updateState } from '../src/index';
// Helper function to create an event emitter that collects events
function createEventCollector() {
    const events = [];
    const emit = (event) => events.push(event);
    return { events, emit };
}
describe("Complex Tests", () => {
    test("wrapState handles complex nested operations", () => {
        const { events, emit } = createEventCollector();
        const state = wrapState({
            users: [
                { name: "Alice", tags: new Set(["admin"]) },
                { name: "Bob", tags: new Set(["user"]) }
            ],
            roles: new Map([
                ["admin", { permissions: ["read", "write"] }],
                ["user", { permissions: ["read"] }]
            ]),
            metadata: {
                created: new Date('2024-01-01'),
                settings: {
                    theme: "dark",
                    features: new Set(["dashboard", "reports"])
                }
            }
        }, emit);
        // Modify nested array element
        state.users[0].name = "Alice Smith";
        // Add to nested set
        state.users[0].tags.add("superuser");
        // Modify nested map
        state.roles.get("admin").permissions.push("delete");
        // Add to nested array
        state.users.push({ name: "Charlie", tags: new Set(["user"]) });
        expect(events.length).toBe(4);
        expect(events[0].action).toBe('set');
        expect(events[0].path).toEqual(['users', '0', 'name']);
        expect(events[0].newValue).toBe('Alice Smith');
        expect(events[1].action).toBe('set-add');
        expect(events[1].path).toEqual(['users', '0', 'tags']);
        expect(events[1].value).toBe('superuser');
        expect(events[2].action).toBe('array-push');
        expect(events[2].path).toEqual(['roles', 'admin', 'permissions']);
        expect(events[2].key).toBe(2);
        expect(events[2].items).toEqual(['delete']);
        expect(events[3].action).toBe('array-push');
        expect(events[3].path).toEqual(['users']);
        expect(events[3].key).toBe(2);
        expect(events[3].items).toEqual([{ name: "Charlie", tags: new Set(["user"]) }]);
    });
    test("updateState handles complex nested operations", () => {
        const state = {
            users: [
                { name: "Alice", tags: new Set(["admin"]) },
                { name: "Bob", tags: new Set(["user"]) }
            ],
            roles: new Map([
                ["admin", { permissions: ["read", "write"] }],
                ["user", { permissions: ["read"] }]
            ]),
            metadata: {
                created: new Date('2024-01-01'),
                settings: {
                    theme: "dark",
                    features: new Set(["dashboard", "reports"])
                }
            }
        };
        const events = [
            { action: 'set', path: ['users', '0', 'name'], newValue: 'Alice Smith' },
            { action: 'set-add', path: ['users', '0', 'tags'], value: 'superuser' },
            { action: 'array-push', path: ['roles', 'admin', 'permissions'], key: 2, items: ['delete'] },
            { action: 'array-push', path: ['users'], key: 2, items: [{ name: "Charlie", tags: new Set(["user"]) }] }
        ];
        events.forEach(event => updateState(state, event));
        expect(state.users[0].name).toBe('Alice Smith');
        expect(state.users[0].tags.has('superuser')).toBe(true);
        expect(state.roles.get('admin').permissions).toContain('delete');
        expect(state.users[2].name).toBe('Charlie');
        expect(state.users[2].tags.has('user')).toBe(true);
    });
});
