#!/usr/bin/env node

import { build } from "../dist/cli/build.js"
import { updateSDK } from "../dist/scripts/update-sdk.js"

const command = process.argv[2]

if (command === "build") {
  build()
} else if (command === "update-sdk") {
  updateSDK()
} else {
  console.log("BF6MOD CLI")
  console.log("")
  console.log("Usage:")
  console.log("  bf6mod build")
  console.log("  bf6mod update-sdk")
  console.log("")
}
