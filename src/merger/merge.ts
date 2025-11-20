import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Track file resolution order (topological sort)
const visited = new Set<string>()
const ordered: string[] = []

// Registry to detect duplicate exported/global identifiers
const nameRegistry = new Map<string, string>() // name → filePath

function resolveFile(filePath: string) {
    if (visited.has(filePath)) return
    visited.add(filePath)

    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`)
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

    // Add modlib import at the top
    output += "import * as modlib from 'modlib'\n\n"

    // ---- MAIN MERGE LOOP ----
    for (const file of ordered) {
        let code = fs.readFileSync(file, 'utf8')

        // ---- 1. Detect export & global conflicts BEFORE stripping exports ----
        const declRegex =
            /^\s*(?:export\s+)?(?:abstract\s+)?(class|interface|type|enum|const|let|var)\s+([A-Za-z0-9_]+)/gm

        let match
        while ((match = declRegex.exec(code))) {
            const kind = match[1]
            const identifier = match[2]

            if (!identifier) continue

            if (nameRegistry.has(identifier)) {
                console.error(
                    `\n❌ MERGE ERROR: Duplicate top-level identifier detected!\n` +
                        `   Name:  ${identifier}\n` +
                        `   Kind:  ${kind}\n\n` +
                        `   First defined in: ${nameRegistry.get(
                            identifier
                        )}\n` +
                        `   Again found in:   ${file}\n\n` +
                        `➡ Rename one of these identifiers to avoid merge conflicts.\n`
                )
                process.exit(1)
            }

            nameRegistry.set(identifier, file)
        }

        // ---- 2. Strip all import statements ----
        code = code.replace(/^\s*import\s+.*from\s+['"].+['"]\s*;?\s*$/gm, '')

        // ---- 3. Strip "export" keyword but KEEP the definitions ----
        code = code.replace(
            /^\s*export\s+(abstract\s+)?(?=class|interface|type|enum|const|let|var)/gm,
            '$1'
        )

        // Normalize line endings
        code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

        // Trim trailing whitespace
        code = code.replace(/[ \t]+$/gm, '')

        // Add file header
        output +=
            '// -------- FILE: ' +
            path.relative(process.cwd(), file) +
            ' --------\n'
        output += code.trim() + '\n\n'
    }

    // Write merged file
    const outputPath = path.resolve(process.cwd(), '__MERGED.ts')
    fs.writeFileSync(outputPath, output, 'utf8')

    console.log('\n__MERGED.ts generated successfully 🚀\n')
}
