import ts from 'typescript'
import path from 'path'
import fs from 'fs'
import merge from '../merger/merge.js'

export default async function buildProject(projectDir: string, skipFiles?: (filePath: string) => boolean) {
    console.log('Compiling TypeScript...')

    const tsconfigPath = path.join(projectDir, 'tsconfig.json')
    if (!fs.existsSync(tsconfigPath)) {
        console.error('ERROR: tsconfig.json not found in project root')
        return
    }

    // Parse tsconfig.json
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        projectDir,
        {},
        tsconfigPath
    )

    // Filter OUT the merged file (__MERGED.ts)
    const cleanFileList = parsed.fileNames.filter(f => {
        const base = path.basename(f)
        return base !== '__MERGED.ts'
    })

    // Create TypeScript program
    const program = ts.createProgram({
        rootNames: cleanFileList,
        options: parsed.options
    })

    // Perform compilation
    const emitResult = program.emit()

    const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)
    if (allDiagnostics.length > 0) {
        console.log('TypeScript compilation errors:')
        for (const diag of allDiagnostics) {
            const msg = ts.flattenDiagnosticMessageText(diag.messageText, '\n')
            if (diag.file) {
                const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start || 0)
                console.log(`${diag.file.fileName} (${line + 1},${character + 1}): ${msg}`)
            } else {
                console.log(msg)
            }
        }
        return
    }

    console.log('TypeScript compiled successfully.')

    // Now run the merger
    console.log('Merging files...')
    merge({
        entryFile: path.join(projectDir, 'src', 'main.ts'),
        skipFiles
    })

    console.log('Build complete.')
}
