#!/usr/bin/env node

import path from 'path'
import fs from 'fs'
import merge from '../dist/merger/merge.js'

// ------------------------------------------------------------
// SAFE CONFIG LOADER (loads bf6mod.config.js as ESM via data URL)
// ------------------------------------------------------------
async function loadConfig(configPath) {
    if (!fs.existsSync(configPath)) return null

    try {
        const code = fs.readFileSync(configPath, 'utf8')

        // Convert the content to an ESM module via a data: URL
        const dataUrl =
            `data:text/javascript;base64,` +
            Buffer.from(code).toString('base64')

        const mod = await import(dataUrl)
        return mod.default ?? mod
    } catch (err) {
        console.warn('Warning: Could not load bf6mod.config.js:', err)
        return null
    }
}

// ------------------------------------------------------------
// MAIN CLI ENTRY
// ------------------------------------------------------------
async function main() {
    const args = process.argv.slice(2)
    const cmd = args[0]

    if (!cmd) {
        console.log('Usage: bf6mod <command>')
        console.log('Available commands: build, watch, update-sdk')
        return
    }

    const projectDir = process.cwd()

    // --------------------------------------------------------
    // BUILD
    // --------------------------------------------------------
    if (cmd === 'build') {
        const configPath = path.join(projectDir, 'bf6mod.config.js')
        let skipList = []
        let rootNamespace = 'Portal'

        const cfg = await loadConfig(configPath)
        if (cfg) {
            if (Array.isArray(cfg.skip)) {
                skipList = cfg.skip
            }
            if (typeof cfg.namespace === 'string') {
                rootNamespace = cfg.namespace
            }
            console.log('Loaded bf6mod.config.js')
        }

        merge({
            entryFile: path.join(projectDir, 'src', 'main.ts'),
            skipFiles: (filePath) =>
                skipList.some((skip) => filePath.endsWith(skip)),
            namespace: rootNamespace,
        })

        console.log('Build complete.')
        return
    }

    // --------------------------------------------------------
    // WATCH
    // --------------------------------------------------------
    if (cmd === 'watch') {
        const { watchProject } = await import('../dist/commands/watch.js')
        await watchProject()
        return
    }

    // --------------------------------------------------------
    // UPDATE SDK
    // --------------------------------------------------------
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
