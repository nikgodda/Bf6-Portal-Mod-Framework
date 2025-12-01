#!/usr/bin/env node

// ------------------------------------------------------------
// CLI argument parsing for skip option
// Example: bf6mod build --skip=index.ts,ui/index.ts
// ------------------------------------------------------------
const rawArgs = process.argv.slice(2)
const skipArg = rawArgs.find((a) => a.startsWith('--skip='))

let skipList = []
if (skipArg) {
    skipList = skipArg
        .replace('--skip=', '')
        .split(',')
        .map((x) => x.trim())
}

// Import build command from compiled dist folder
const { default: buildProject } = await import('../dist/commands/build.js')

async function main() {
    const args = rawArgs.filter((a) => !a.startsWith('--skip='))
    const cmd = args[0]

    if (!cmd) {
        console.log('Usage: bf6mod <command>')
        console.log('Available commands: build, watch, update-sdk')
        return
    }

    if (cmd === 'build') {
        const projectDir = process.cwd()

        await buildProject(
            projectDir,
            (filePath) => {
                if (skipList.length === 0) return false
                return skipList.some((skip) => filePath.endsWith(skip))
            }
        )

        return
    }

    if (cmd === 'watch') {
        const { watchProject } = require('../dist/commands/watch.js')
        await watchProject()
        return
    }

    if (cmd === 'update-sdk') {
        const { updateSDK } = require('../dist/scripts/update-sdk.js')
        await updateSDK()
        return
    }

    console.log('Unknown command:', cmd)
}

main().catch((err) => {
    console.error('Error:', err)
    process.exit(1)
}) 
