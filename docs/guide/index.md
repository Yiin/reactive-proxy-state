# Introduction

`reactive-proxy-state` is a lightweight reactivity system inspired by Vue 3's reactivity API but designed to be used standalone in any JavaScript or TypeScript environment, whether it's browser, Node.js, or any other JavaScript runtime.

## What is Reactivity?

Reactivity is a programming paradigm that allows us to automatically track dependencies between data and the code that uses that data. When the data changes, the dependent code re-executes automatically.

## Key Features

- **Simple API**: Familiar if you've used Vue 3, easy to learn if you haven't
- **Lightweight**: Focused on the core reactivity system with minimal bloat
- **Framework-agnostic**: Use in any JavaScript environment
- **TypeScript support**: Full type definitions included
- **Collection support**: Works with Arrays, Maps, Sets
- **Zero dependencies**: Standalone package with no external dependencies

## When to Use

- Building real-time state synchronization systems
- Creating custom state management solutions
- Server-side reactive data processing
- Anywhere you need automated dependency tracking and effect triggering

This library is particularly well-suited for scenarios where you need reactivity outside of a UI framework, or when you want to build custom state management with a reactive core. 