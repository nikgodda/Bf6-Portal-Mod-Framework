import chokidar from 'chokidar'

export default async function run(args: string[]) {
    const cmd = args[0]

    if (cmd === 'build') {
        const merger = await import('../merger/merge.js')
        await merger.default?.()
        return
    }

    if (cmd === 'update-sdk') {
        await import('../scripts/update-sdk.js')
        return
    }

    if (cmd === 'watch') {
        console.log('Watching src/**/*.ts ...')
        const merger = await import('../merger/merge.js')

        chokidar.watch('src/**/*.ts').on('change', async (file) => {
            console.log('Changed:', file)
            await merger.default?.()
        })

        return
    }

    console.log('Usage:')
    console.log('  bf6mod build')
    console.log('  bf6mod update-sdk')
    console.log('  bf6mod watch')
}
