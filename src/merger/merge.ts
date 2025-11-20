import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Track file resolution order
const visited = new Set<string>()
const ordered: string[] = []

// Track all top-level identifiers for duplicate detection
const nameRegistry = new Map<string, string>() // name → filePath

// Useful paths
const projectRoot = process.cwd()
const srcRoot = path.resolve(projectRoot, 'src')

/* ------------------------------------------------------------
 *  Resolve imports and dependency order
 * ------------------------------------------------------------ */
function resolveFile(filePath: string) {
    if (visited.has(filePath)) return
    visited.add(filePath)

    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`)
        process.exit(1)
    }

    const code = fs.readFileSync(filePath, 'utf8')

    // Match any import path: from "xxx"
    const importRegex = /import\s+(?:[\s\S]*?)?from\s+["'](.+?)["']/g

    let match
    while ((match = importRegex.exec(code))) {
        const importPath = match[1]
        const resolved = resolveImport(filePath, importPath)
        if (resolved) resolveFile(resolved)
    }

    ordered.push(filePath)
}

/* ------------------------------------------------------------
 *  Import path resolver
 * ------------------------------------------------------------ */
function resolveImport(baseFile: string, reqPath: string) {
    const baseDir = path.dirname(baseFile)

    // Case 1: standard relative imports (./ or ../)
    if (reqPath.startsWith('.')) {
        const candidates = [
            reqPath + '.ts',
            reqPath + '.tsx',
            reqPath + '.js',
            path.join(reqPath, 'index.ts'),
            path.join(reqPath, 'index.tsx'),
        ]
        for (const c of candidates) {
            const abs = path.resolve(baseDir, c)
            if (fs.existsSync(abs)) return abs
        }
    }

    // Case 2: import from src/ folder (absolute path inside project)
    // e.g. import {...} from "Core/Player/APlayerBase"
    const absFromSrc = path.resolve(srcRoot, reqPath + '.ts')
    if (fs.existsSync(absFromSrc)) return absFromSrc

    const absFromSrcIndex = path.resolve(srcRoot, reqPath, 'index.ts')
    if (fs.existsSync(absFromSrcIndex)) return absFromSrcIndex

    return null
}

/* ------------------------------------------------------------
 *  Main merge function
 * ------------------------------------------------------------ */
export default function merge(entryFileInput?: string) {
    const entryFile = entryFileInput ?? path.resolve(srcRoot, 'main.ts')

    const absEntry = path.resolve(entryFile)
    resolveFile(absEntry)

    let output = ''

    // Add modlib import at top of merged file
    output += `import * as modlib from 'modlib'\n\n`

    /* --------------------------------------------------------
     *  Process files in dependency order
     * -------------------------------------------------------- */
    for (const file of ordered) {
        let code = fs.readFileSync(file, 'utf8')

        /* ----------------------------------------------------
         * 1. Detect duplicate exported or global identifiers
         * ---------------------------------------------------- */
        const declRegex =
            /^\s*(?:export\s+)?(?:abstract\s+)?(class|interface|type|enum|const|let|var)\s+([A-Za-z0-9_]+)/gm

        let match
        while ((match = declRegex.exec(code))) {
            const kind = match[1]
            const identifier = match[2]

            if (nameRegistry.has(identifier)) {
                console.error(
                    `\n❌ MERGE ERROR: Duplicate top-level identifier detected!\n` +
                        `   Name: ${identifier}\n` +
                        `   Kind: ${kind}\n\n` +
                        `   First defined in: ${nameRegistry.get(
                            identifier
                        )}\n` +
                        `   Again found in:   ${file}\n\n` +
                        `➡ Rename one of these identifiers.\n`
                )
                process.exit(1)
            }

            nameRegistry.set(identifier, file)
        }

        /* ----------------------------------------------------
         * 2. Remove all import statements
         * ---------------------------------------------------- */
        code = code.replace(/^\s*import\s+.*from\s+['"].+['"]\s*;?\s*$/gm, '')

        /* ----------------------------------------------------
         * 3. Strip "export" but keep definitions
         * ---------------------------------------------------- */
        code = code.replace(
            /^\s*export\s+(abstract\s+)?(?=class|interface|type|enum|const|let|var)/gm,
            '$1'
        )

        /* ----------------------------------------------------
         * 4. Normalize formatting
         * ---------------------------------------------------- */
        code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        code = code.replace(/[ \t]+$/gm, '') // strip trailing spaces

        /* ----------------------------------------------------
         * 5. Write header + code
         * ---------------------------------------------------- */
        output += `// -------- FILE: ${path.relative(
            projectRoot,
            file
        )} --------\n`
        output += code.trim() + '\n\n'
    }

    /* --------------------------------------------------------
     *  Write merged file
     * -------------------------------------------------------- */
    const outputPath = path.resolve(projectRoot, '__MERGED.ts')
    fs.writeFileSync(outputPath, output, 'utf8')

    console.log('\n__MERGED.ts generated successfully 🚀\n')
}
