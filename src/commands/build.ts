import merge from '../merger/merge'
import fs from 'fs'
import path from 'path'
import ts from 'typescript'

interface BuildOptions {
    skipFiles?: (filePath: string) => boolean
}

export async function buildProject(opts: BuildOptions = {}) {
    console.log('Compiling TypeScript...')

    const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json')
    const tsconfig = ts.readConfigFile(tsconfigPath, ts.sys.readFile).config
    const parsed = ts.parseJsonConfigFileContent(
        tsconfig,
        ts.sys,
        path.dirname(tsconfigPath)
    )

    const program = ts.createProgram(parsed.fileNames, parsed.options)
    const emit = program.emit()

    const diagnostics = ts
        .getPreEmitDiagnostics(program)
        .concat(emit.diagnostics)

    if (diagnostics.length > 0) {
        console.error('TypeScript compilation errors:')
        diagnostics.forEach((d) =>
            console.error(ts.flattenDiagnosticMessageText(d.messageText, '\n'))
        )
        process.exit(1)
    }

    console.log('Merging source files...')

    merge({
        skipFiles: opts.skipFiles ? opts.skipFiles : undefined,
    })

    console.log('Build completed.')
}
