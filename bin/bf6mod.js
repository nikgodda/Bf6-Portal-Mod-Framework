#!/usr/bin/env node

import path from 'path'
import merge from '../dist/merger/merge.js'

async function main() {
    const args = process.argv.slice(2)
    const cmd = args[0]

    if (!cmd) {
        console.log('Usage: bf6mod <command>')
        console.log('Available commands: build, watch, update-sdk')
        return
    }

    const projectDir = process.cwd()

    if (cmd === 'build') {
        const entryFile = path.join(projectDir, 'src', 'main.ts')
        merge(entryFile)
        console.log('Build complete.')
        return
    }

    if (cmd === 'watch') {
        const { watchProject } = await import('../dist/commands/watch.js')
        await watchProject()
        return
    }

    if (cmd === 'update-sdk') {
        const { updateSDK } = await import('../dist/scripts/update-sdk.js')
        await updateSDK()
        return
    }

    console.log('Unknown command:', cmd)
}

main().catch((err) => {
    console.error('Error:', err)
    process.exit(1)
})
