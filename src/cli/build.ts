import chokidar from 'chokidar'
import path from 'path'

// Loads merge.js from src/scripts/merge.js
async function loadMerge() {
    const mod: any = await import('../scripts/merge.js')
    const mergeFn = mod.default ?? mod.merge

    if (!mergeFn) {
        console.error('ERROR: merge.js does not export a merge function')
        return null
    }

    return mergeFn
}

// Loads strings.js (auto-executes on import)
async function loadStrings() {
    await import('../scripts/strings.js')
    return true
}

export default async function run(args: string[]) {
    const cmd = args[0]

    // --------------------------------------------------
    // build
    // --------------------------------------------------
    if (cmd === 'build') {
        const mergeFn = await loadMerge()
        if (mergeFn) await mergeFn()

        // Strings must run after merge because it parses __SCRIPT.ts
        await loadStrings()
        return
    }

    // --------------------------------------------------
    // update-sdk
    // --------------------------------------------------
    if (cmd === 'update-sdk') {
        await import('../scripts/update-sdk.js')
        return
    }

    // --------------------------------------------------
    // watch
    // --------------------------------------------------
    if (cmd === 'watch') {
        const projectSrc = path.join(process.cwd(), 'src')
        console.log('Watching:', projectSrc)

        const mergeFn = await loadMerge()
        if (!mergeFn) return

        // Run initial merge immediately
        console.log('Initial merge...')
        await mergeFn()

        // Watch src/ and re-run merge
        chokidar
            .watch(projectSrc, { ignoreInitial: true })
            .on('change', async (file) => {
                console.log('Changed:', file)
                await mergeFn()
            })

        return
    }

    // --------------------------------------------------
    // help
    // --------------------------------------------------
    console.log('Usage:')
    console.log('  bf6mod build')
    console.log('  bf6mod update-sdk')
    console.log('  bf6mod watch')
}
