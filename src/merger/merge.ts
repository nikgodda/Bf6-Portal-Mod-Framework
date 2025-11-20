import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const visited = new Set<string>()
const ordered: string[] = []

// Duplicate identifier tracking (global + exported)
const nameRegistry = new Map<string, string>() // identifier → filePath

function resolveFile(filePath: string) {
    if (visited.has(filePath)) return
    visited.add(filePath)

    if (!fs.existsSync(filePath)) {
        console.error('File not found: ' + filePath)
        process.exit(1)
    }

    const code = fs.readFileSync(filePath, 'utf8')

    // Matches:
    //  - ./something
    //  - ../something
    //  - src/something
    const importRegex =
        /import\s+(?:[\s\S]*?)?from\s+["'](\.\/.*?|\.{2}\/.*?|src\/.*?)["'];?/g

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

    let abs: string | null = null

    // Case 1: src/... imports (absolute from project root)
    if (reqPath.startsWith('src/')) {
        abs = path.resolve(process.cwd(), reqPath)
    }

    // Case 2: relative imports ./ or ../
    else {
        abs = path.resolve(baseDir, reqPath)
    }

    const candidates = [
        abs + '.ts',
        abs + '.tsx',
        abs + '.js',
        path.join(abs, 'index.ts'),
        path.join(abs, 'index.tsx'),
    ]

    for (const c of candidates) {
        if (fs.existsSync(c)) return c
    }

    return null
}

export default function merge(entryFileInput?: string) {
    const entryFile =
        entryFileInput ?? path.resolve(process.cwd(), 'src/main.ts')

    const absEntry = path.resolve(entryFile)
    resolveFile(absEntry)

    let output = ''

    // Keep modlib import at the top
    output += "import * as modlib from 'modlib'\n\n"

    for (const file of ordered) {
        let code = fs.readFileSync(file, 'utf8')

        // ----------------------------------------------------------
        // Duplicate identifier detection (exported + global)
        // ----------------------------------------------------------
        const declRegex =
            /^\s*(?:export\s+)?(?:abstract\s+)?(class|interface|type|enum|const|let|var)\s+([A-Za-z0-9_]+)/gm

        let match2
        while ((match2 = declRegex.exec(code))) {
            const kind = match2[1]
            const identifier = match2[2]

            if (!identifier) continue

            if (nameRegistry.has(identifier)) {
                console.error(
                    `\n❌ MERGE ERROR: Duplicate top-level identifier detected!\n` +
                    `   Identifier: ${identifier}\n` +
                    `   Kind:       ${kind}\n\n` +
                    `   First found in: ${nameRegistry.get(identifier)}\n` +
                    `   Found again in: ${file}\n\n` +
                    `➡ Rename one of these identifiers to avoid conflict.\n`
                )
                process.exit(1)
            }

            nameRegistry.set(identifier, file)
        }

        // ----------------------------------------------------------
        // 1. Remove ES module imports
        // ----------------------------------------------------------
        code = code.replace(/^\s*import\s+.*$/gm, '')

        // ----------------------------------------------------------
        // 2. Remove ES module exports ONLY
        // ----------------------------------------------------------
        code = code
            .replace(/^\s*export\s*{[^}]+};?\s*$/gm, '') // export { ... }
            .replace(/^\s*export\s+\*.*$/gm, '') // export * from ...
            .replace(/^\s*export\s+default\s+.*$/gm, '') // export default ...

        // (We intentionally do NOT strip "export class" etc here!)

        // ----------------------------------------------------------
        // 3. Normalize EOL
        // ----------------------------------------------------------
        code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

        // ----------------------------------------------------------
        // 4. Remove trailing whitespace
        // ----------------------------------------------------------
        code = code.replace(/[ \t]+$/gm, '')

        // ----------------------------------------------------------
        // 5. Append to output
        // ----------------------------------------------------------
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
