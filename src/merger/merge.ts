import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const visited = new Set<string>()
const ordered: string[] = []

function resolveFile(filePath: string) {
    if (visited.has(filePath)) return
    visited.add(filePath)

    if (!fs.existsSync(filePath)) {
        console.error('File not found: ' + filePath)
        process.exit(1)
    }

    const code = fs.readFileSync(filePath, 'utf8')

    // Detect relative imports
    const importRegex =
        /import\s+(?:[\s\S]*?)?from\s+["'](\.\/.*?|\.{2}\/.*?)["'];?/g

    let match
    while ((match = importRegex.exec(code))) {
        const importPath = match[1]
        const resolved = resolveImport(filePath, importPath)
        if (resolved) resolveFile(resolved)
    }

    ordered.push(filePath)
}

function resolveImport(baseFile: string, reqPath: string) {
    const baseDir = path.dirname(baseFile)
    const candidates = [
        reqPath + '.ts',
        reqPath + '.tsx',
        reqPath + '.js',
        path.join(reqPath, 'index.ts'),
        path.join(reqPath, 'index.tsx'),
    ]

    for (const candidate of candidates) {
        const abs = path.resolve(baseDir, candidate)
        if (fs.existsSync(abs)) return abs
    }

    return null
}

export default function merge(entryFileInput?: string) {
    const entryFile =
        entryFileInput ?? path.resolve(process.cwd(), 'src/main.ts')

    const absEntry = path.resolve(entryFile)
    resolveFile(absEntry)

    let output = ''

    // Keep modlib import at top
    output += "import * as modlib from 'modlib'\n\n"

    for (const file of ordered) {
        let code = fs.readFileSync(file, 'utf8')

        // ------------------------------------------------------------
        // 1. REMOVE ALL IMPORTS (ES Module)
        // ------------------------------------------------------------
        code = code.replace(/^\s*import\s+.*$/gm, '')

        // ------------------------------------------------------------
        // 2. REMOVE ES-MODULE EXPORTS ONLY
        //    These must be removed:
        //      export { ... }
        //      export * from ...
        //      export default ...
        //
        //    DO NOT remove:
        //      export namespace
        //      export class / export abstract class
        //      export enum / export function
        // ------------------------------------------------------------
        code = code
            // export { ... }
            .replace(/^\s*export\s*{[^}]+};?\s*$/gm, '')
            // export * from ...
            .replace(/^\s*export\s+\*.*$/gm, '')
            // export default Something
            .replace(/^\s*export\s+default\s+.*$/gm, '')

        // ------------------------------------------------------------
        // 3. DO NOT strip `export class`, `export abstract`, etc.
        //    They belong to namespaces and MUST remain untouched.
        // ------------------------------------------------------------

        // Normalize EOL
        code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

        // Trim trailing whitespace
        code = code.replace(/[ \t]+$/gm, '')

        output +=
            '// -------- FILE: ' +
            path.relative(process.cwd(), file) +
            ' --------\n'
        output += code.trim() + '\n\n'
    }

    const outputPath = path.resolve(process.cwd(), '__MERGED.ts')
    fs.writeFileSync(outputPath, output, 'utf8')

    console.log('\n__MERGED.ts generated successfully\n')
}
