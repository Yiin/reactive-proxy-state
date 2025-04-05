import { reactive } from "../src/reactive"; // Adjust path if needed
import { StateEvent } from "../src/types"; // Adjust path if needed
import { performance } from 'node:perf_hooks'; // Use Node's performance for timing

// --- Helper Functions ---

function createComplexEntityState() {
    return {
        id: Math.random().toString(36).substring(7),
        status: "active",
        counter: 0,
        metadata: {
            name: "Entity Name",
            createdAt: new Date(),
            tags: ["tag1", "tag2", "initial"],
            config: new Map<string, any>([
                ["featureA", true],
                ["retries", 3],
                ["nested", { timeout: 5000 }]
            ])
        },
        data: [
            { value: 10, label: "A" },
            { value: 20, label: "B" },
            { value: 30, label: "C" }
        ],
        // Add more complexity as needed
        // nestedSet: new Set([1, 2, 3])
    };
}

// Define a series of mutations to apply
function applyMutations(state: any) {
    state.counter++;
    state.status = "updated";
    state.metadata.name = "New Entity Name";
    state.metadata.tags.push("updated");
    if (state.metadata.tags.length > 5) {
        state.metadata.tags.shift();
    }
    state.metadata.config.set("retries", (state.metadata.config.get("retries") ?? 0) + 1);
    state.metadata.config.set("newKey", { timestamp: Date.now() });
    if (state.metadata.config.has("featureA")) {
         state.metadata.config.delete("featureA");
    }
    state.data[0].value += 5;
    state.data.push({ value: state.counter * 10, label: `D${state.counter}`});
     if (state.data.length > 10) {
        state.data.splice(1, 1); // Remove second element
    }
    // Add mutations for Set if using:
    // state.nestedSet.add(state.counter);
    // state.nestedSet.delete(state.counter - 5);
}

// --- Manual Benchmark ---

const WARMUP_RUNS = 10;
const BENCHMARK_RUNS = 100; // Number of measurement runs
const MUTATIONS_PER_RUN = 1000; // Number of mutation sequences per run

function runBenchmark(name: string, setupFn: () => any, taskFn: (state: any) => void) {
    console.log(`\nRunning benchmark: ${name}`);

    // Warm-up phase
    for (let i = 0; i < WARMUP_RUNS; i++) {
        const state = setupFn();
        for (let j = 0; j < MUTATIONS_PER_RUN; j++) {
            taskFn(state);
        }
    }

    // Measurement phase
    const timings: number[] = [];
    for (let i = 0; i < BENCHMARK_RUNS; i++) {
        const state = setupFn(); // Setup fresh state for each run
        const start = performance.now();
        for (let j = 0; j < MUTATIONS_PER_RUN; j++) {
            taskFn(state);
        }
        const end = performance.now();
        timings.push(end - start);
    }

    // Calculate statistics
    const totalTime = timings.reduce((sum, t) => sum + t, 0);
    const avgTime = totalTime / BENCHMARK_RUNS;
    const minTime = Math.min(...timings);
    const maxTime = Math.max(...timings);
    const opsPerRun = MUTATIONS_PER_RUN; // Operations (mutation sequences) per timing measurement
    const avgOpsPerSec = (opsPerRun / (avgTime / 1000)).toFixed(2); // Avg ops/sec across runs

    console.log(`  Runs: ${BENCHMARK_RUNS}, Mutations per run: ${MUTATIONS_PER_RUN}`);
    console.log(`  Avg time per run: ${avgTime.toFixed(4)} ms`);
    console.log(`  Min time per run: ${minTime.toFixed(4)} ms`);
    console.log(`  Max time per run: ${maxTime.toFixed(4)} ms`);
    console.log(`  Avg ops/sec (mutation sequences): ${avgOpsPerSec}`);
    return { avgTime, avgOpsPerSec };
}

console.log("Starting Benchmarks...");

// Benchmark Plain Object
const plainResults = runBenchmark(
    "Plain Object Mutations",
    () => createComplexEntityState(), // Setup: create plain object
    (state) => applyMutations(state) // Task: apply mutations
);

// Benchmark Wrapped Object
let collectedEvents: StateEvent[] = []; // Keep events outside to avoid impacting timing too much
const emit = (event: StateEvent) => {
    // In a real scenario, processing/sending events adds overhead.
    // For this benchmark, we just collect to measure proxy overhead primarily.
    // To be more realistic, you could add minimal processing here.
     collectedEvents.push(event);
};

const wrappedResults = runBenchmark(
    "Wrapped Object Mutations",
    () => reactive(createComplexEntityState(), emit), // Setup: create wrapped object
    (state) => { // Task: apply mutations and clear events per sequence if desired
        applyMutations(state);
        collectedEvents = []; // Clear events to avoid memory buildup during benchmark
    }
);

// Benchmark Wrapping Cost
const wrappingResults = runBenchmark(
    "Object Wrapping Cost",
    () => createComplexEntityState(), // Setup: create plain object
    (plainState) => { // Task: wrap the object
        const wrapped = reactive(plainState, emit);
        // Prevent potential compiler optimization by using the result slightly
        if (wrapped && Math.random() < 0.00001) console.log("Wrapped");
    }
);

console.log("\n--- Summary ---");
console.log(`Plain Object Ops/Sec: ${plainResults.avgOpsPerSec}`);
console.log(`Wrapped Object Ops/Sec: ${wrappedResults.avgOpsPerSec}`);
console.log(`Wrapping Cost Ops/Sec: ${wrappingResults.avgOpsPerSec}`);

const overheadFactor = parseFloat(plainResults.avgOpsPerSec) / parseFloat(wrappedResults.avgOpsPerSec);
console.log(`\nWrapped object mutations are roughly ${overheadFactor.toFixed(2)}x slower than plain object mutations.`);

// Estimate overhead for 10k entities per second
const overheadPerSequenceMs = (wrappedResults.avgTime / MUTATIONS_PER_RUN) - (plainResults.avgTime / MUTATIONS_PER_RUN);
const totalOverheadMs = 10000 * overheadPerSequenceMs;
console.log(`Estimated total overhead for 10k entities/sec: ${totalOverheadMs.toFixed(2)} ms`);

// --- Run Command ---
// bun test --bench benchmarks/state-sync.bench.ts 