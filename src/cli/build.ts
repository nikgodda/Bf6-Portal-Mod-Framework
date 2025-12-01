import chokidar from 'chokidar'
import path from 'path'

async function loadMerge() {
    const mod: any = await import('../scripts/merge.js')
    const mergeFn = mod.default ?? mod.merge

    if (!mergeFn) {
        console.error('ERROR: merge.js does not export a merge function')
        return null
    }

    return mergeFn
}

async function loadStrings() {
    const mod: any = await import('../scripts/strings.js')
    // auto-run on import (strings.js runs immediately)
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

        // Strings must run AFTER merge, because it reads __SCRIPT.ts
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

        // Initial merge
        console.log('Initial merge...')
        await mergeFn()

        // Watch changes, run merge only
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
