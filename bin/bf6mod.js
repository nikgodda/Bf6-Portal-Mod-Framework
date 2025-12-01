#!/usr/bin/env node

import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'
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

    // -------------------------------
    // BUILD COMMAND
    // -------------------------------
    if (cmd === 'build') {
        // Try to load bf6mod.config.js
        const configPath = path.join(projectDir, 'bf6mod.config.js')
        let skipList = []

        if (fs.existsSync(configPath)) {
            try {
                const fileUrl = pathToFileURL(configPath).href
                const cfg = (await import(fileUrl)).default

                if (Array.isArray(cfg.skip)) {
                    skipList = cfg.skip
                    console.log('Loaded bf6mod.config.js')
                }
            } catch (err) {
                console.warn('Warning: Could not load bf6mod.config.js:', err)
            }
        }

        // Run merger
        merge({
            entryFile: path.join(projectDir, 'src', 'main.ts'),
            skipFiles: (filePath) =>
                skipList.some((skip) => filePath.endsWith(skip)),
        })

        console.log('Build complete.')
        return
    }

    // -------------------------------
    // WATCH COMMAND
    // -------------------------------
    if (cmd === 'watch') {
        const { watchProject } = await import('../dist/commands/watch.js')
        await watchProject()
        return
    }

    // -------------------------------
    // UPDATE-SDK COMMAND
    // -------------------------------
    if (cmd === 'update-sdk') {
        const { updateSDK } = await import('../dist/scripts/update-sdk.js')
        await updateSDK()
        return
    }

    // -------------------------------
    // UNKNOWN COMMAND
    // -------------------------------
    console.log('Unknown command:', cmd)
}

main().catch((err) => {
    console.error('Error:', err)
    process.exit(1)
})
