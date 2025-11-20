#!/usr/bin/env node

// Load the compiled CLI handler from dist
// src/cli/build.ts exports:  export default async function run(args)
import run from '../dist/cli/build.js'

// Pass command line arguments (ignoring "node" and script path)
run(process.argv.slice(2))
