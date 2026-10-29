# Compatibility with 1.0.44

These fixes still change some behavior of the npm-packed 1.0.44 release. They do not provide full behavioral parity.

| Remaining difference | Reason |
| --- | --- |
| Initial state, inserted items and added Set members arrive as copies. Async removed values arrive as copies too. | A listener must not change the source by updating its replica. A queued event must retain the value from its write. |
| Two places that share an object receive separate copies. Cycles within each copy remain cycles. | A shared source emits one event per place. Shared replica objects would apply those events more than once. |
| Snapshots refuse more than 100,000 extra copies of shared objects. Async removals can also fail this check. | This bounds expansion when one object appears at many places. Ordinary trees have no size limit. |
| Copies omit non-enumerable own properties, except array length and indexed values. They do not retain property descriptors, frozen status or non-enumerable markers such as `markRaw`'s flag. | Keeping these details requires inspecting descriptors throughout each copied graph. That adds work to copying and root creation. 1.0.44 delivered the original objects in initial, inserted and removed payloads, so those fields were accessible then. |
| A nested synchronous write drains waiting alias events inside the listener's call. | This keeps event order consistent with write order. A consumer that mutes all events during that call can discard waiting events. Defer the write until the listener returns to keep them. |

The limit is a new input restriction, not a limit that 1.0.44 already imposed. A chain of 17 distinct objects, each parent holding its child twice, needs 131,071 copies. Of these, 131,054 are extra copies, so the library refuses it. A chain of 16 distinct objects needs 65,535 copies and passes.

A wide graph can reach the limit with only two distinct objects. An array containing the same leaf 100,002 times needs 100,001 extra leaf copies. An array containing it 100,001 times reaches exactly 100,000 extra copies and passes.

1.0.44 could deliver these graphs without exponential work. Its initial event and inserted items used the original objects. Its assignment copy reused an object's first copy. A consumer that converts the shared graph to a tree, such as JSON serialization, still expands the repeated paths. The new limit bounds that tree expansion inside the library.

Collection copies retain membership through weak identity tokens. `updateState` uses those tokens to find an object Map key or Set member in the replica. Two different objects with equal contents have different tokens. Tokens do not hold their source objects alive. They survive further payload copies and forwarding through another reactive root in the same JavaScript realm, including separate ESM and CJS instances.

The tokens are internal to the JavaScript realm. They are not a wire format. A transport that copies each event independently needs its own stable member identifiers. 1.0.44 also failed object-member deletion when independent transport copies broke identity. Copying an event with JSON or `structuredClone` does not preserve the new tokens.

The copied Map keys and Set members are distinct objects from the source members. Calling `replicaSet.has(sourceMember)` directly does not resolve tokens. Use events through `updateState` to synchronize membership. Direct member identity across roots is part of the copy difference above.

Existing restrictions still apply. Map keys used in nested paths become strings. Set members have no addressable path for nested writes. Named array properties and symbol properties travel in supported payloads, but writes through those properties do not gain new path support. Array assignments still omit named array properties, as 1.0.44 did.

Getters on a payload that reaches its written container now cause an explicit refusal. Read-only array reorders refuse before any partial write. These cases sit outside the data-property input contract. Earlier review tests that require cyclic getters to run after a proposed write therefore remain refused.

Correct move paths, alias delivery, reorder events, splice normalization, equality checks, deep-tree handling and delivery before listener errors are bug fixes. Added error types and statistics are additive changes. The removed path-concatenation cache reports zero entries through the existing statistics field.
