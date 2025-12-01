import chokidar from 'chokidar'
import path from 'path'

// --------------------------------------------------
// Inline terminal colors
// --------------------------------------------------
const C = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
}

// --------------------------------------------------
// Load merge.js dynamically (ESM)
// --------------------------------------------------
async function loadMerge() {
    try {
        const mod: any = await import('../scripts/merge.js')
        const mergeFn = mod.default ?? mod.merge

        if (!mergeFn) {
            console.error(
                `${C.magenta}ERROR:${C.reset} merge.js does not export a merge() function`
            )
            return null
        }

        return mergeFn
    } catch (err) {
        console.error(
            `${C.magenta}ERROR:${C.reset} Failed to load merge.js`,
            err
        )
        return null
    }
}

export default async function run(args: string[]) {
    const cmd = args[0]

    // --------------------------------------------------
    // build → merge + strings
    // --------------------------------------------------
    if (cmd === 'build') {
        console.log(`${C.cyan}Building...${C.reset}\n`)

        const mergeFn = await loadMerge()
        if (!mergeFn) return

        await mergeFn()

        console.log(`${C.green}__SCRIPT.ts generated successfully${C.reset}`)
        console.log('')

        // run strings.js
        const stringsMod: any = await import('../scripts/strings.js')
        const stringsChanged = stringsMod?.default
            ? await stringsMod.default()
            : false

        if (stringsChanged) {
            console.log(
                `${C.green}__STRINGS.json updated successfully${C.reset}\n`
            )
        } else {
            console.log(
                `${C.green}__STRINGS.json already up to date${C.reset}\n`
            )
        }

        console.log(`${C.cyan}Build complete.${C.reset}`)
        return
    }

    // --------------------------------------------------
    // update-sdk
    // --------------------------------------------------
    if (cmd === 'update-sdk') {
        console.log(`${C.cyan}Updating SDK...${C.reset}`)
        await import('../scripts/update-sdk.js')
        return
    }

    // --------------------------------------------------
    // watch → merge only, no strings
    // --------------------------------------------------
    if (cmd === 'watch') {
        const projectSrc = path.join(process.cwd(), 'src')
        console.log(`${C.cyan}Watching:${C.reset} ${projectSrc}`)

        const mergeFn = await loadMerge()
        if (!mergeFn) return

        console.log(`${C.cyan}Initial merge...${C.reset}`)
        await mergeFn()

        chokidar
            .watch(projectSrc, { ignoreInitial: true })
            .on('all', async (event, file) => {
                console.log(`${C.yellow}Changed:${C.reset} ${file}`)
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
