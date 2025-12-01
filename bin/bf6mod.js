#!/usr/bin/env node

import path from 'path'
import merge from '../dist/merger/merge.js'
import fs from 'fs'

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
        // Load config
        const configPath = path.join(projectDir, 'bf6mod.config.js')
        let skipList = []

        if (fs.existsSync(configPath)) {
            try {
                const cfg = (await import(configPath)).default
                skipList = cfg.skip ?? []
                console.log('Loaded bf6mod.config.js')
            } catch (err) {
                console.warn('Warning: Could not load bf6mod.config.js', err)
            }
        }

        merge({
            entryFile: path.join(projectDir, 'src', 'main.ts'),
            skipFiles: (file) => skipList.some((s) => file.endsWith(s)),
        })

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
