#!/usr/bin/env node

import path from 'path'
import fs from 'fs'
import merge from '../dist/merger/merge.js'

// --------------------------------------------
// SAFE CONFIG LOADER (NO WARNINGS, NO MJS)
// --------------------------------------------
async function loadConfig(configPath) {
    if (!fs.existsSync(configPath)) return null

    try {
        const code = fs.readFileSync(configPath, 'utf8')

        // Load as ESM from memory — avoids Windows paths, avoids warnings
        const dataUrl =
            `data:text/javascript;base64,` +
            Buffer.from(code).toString('base64')

        const module = await import(dataUrl)
        return module.default ?? module
    } catch (err) {
        console.warn('Warning: Could not load bf6mod.config.js:', err)
        return null
    }
}

// --------------------------------------------
// MAIN CLI
// --------------------------------------------
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
        const configPath = path.join(projectDir, 'bf6mod.config.js')
        let skipList = []

        const cfg = await loadConfig(configPath)
        if (cfg && Array.isArray(cfg.skip)) {
            skipList = cfg.skip
            console.log('Loaded bf6mod.config.js')
        }

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
    // UPDATE SDK COMMAND
    // -------------------------------
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
