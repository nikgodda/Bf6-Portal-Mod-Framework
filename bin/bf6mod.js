#!/usr/bin/env node

const path = require('path')
const fs = require('fs')

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
        // Try to load config
        let config = {}
        const configPath = path.join(projectDir, 'bf6mod.config.js')
        if (fs.existsSync(configPath)) {
            console.log('Loaded bf6mod.config.js')
            config = require(configPath)
        }

        const merge = require('../dist/merger/merge.js').default

        merge(path.join(projectDir, 'src', 'main.ts'))

        console.log('Build complete.')
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
