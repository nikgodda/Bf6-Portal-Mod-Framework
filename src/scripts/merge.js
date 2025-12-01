import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const visited = new Set()
const ordered = []

function resolveFile(filePath) {
    if (visited.has(filePath)) return
    visited.add(filePath)

    if (!fs.existsSync(filePath)) {
        console.error('File not found: ' + filePath)
        process.exit(1)
    }

    const code = fs.readFileSync(filePath, 'utf8')

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

function resolveImport(baseFile, reqPath) {
    const baseDir = path.dirname(baseFile)

    let abs = null

    if (reqPath.startsWith('src/')) {
        abs = path.resolve(process.cwd(), reqPath)
    } else {
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

// ------------------------------------------------------------
// DUPLICATE CHECK
// ------------------------------------------------------------

function findTopLevelDecls(file) {
    const code = fs.readFileSync(file, 'utf8')
    const lines = code.split(/\r?\n/)
    const decls = []
    let depth = 0

    for (let line of lines) {
        const opens = (line.match(/{/g) || []).length
        const closes = (line.match(/}/g) || []).length
        depth += opens - closes

        if (depth !== 0) continue

        const reg =
            /^\s*(export\s+)?(class|interface|enum|type|const|let|var)\s+([A-Za-z0-9_]+)/

        const m = line.match(reg)
        if (m) {
            const kind = m[2]
            const name = m[3]
            decls.push({ name, kind, file })
        }
    }

    return decls
}

function enforceIdentifierUniqueness(files) {
    const map = new Map()

    for (const file of files) {
        const decls = findTopLevelDecls(file)
        for (const d of decls) {
            if (map.has(d.name)) {
                const a = map.get(d.name)
                console.error(
                    '\nMERGE ERROR: Duplicate top-level identifier detected!'
                )
                console.error(`   Identifier: ${d.name}`)
                console.error(`   Kind:       ${d.kind}\n`)
                console.error(`   First found in: ${a.file}`)
                console.error(`   Found again in: ${d.file}\n`)
                process.exit(1)
            }
            map.set(d.name, d)
        }
    }
}

// ------------------------------------------------------------

export default function merge(entryFileInput) {
    const entryFile =
        entryFileInput ?? path.resolve(process.cwd(), 'src/main.ts')

    const absEntry = path.resolve(entryFile)
    resolveFile(absEntry)

    enforceIdentifierUniqueness(ordered)

    let output = ''

    // Insert modlib import
    output += "import * as modlib from 'modlib'\n\n"

    for (const file of ordered) {
        let code = fs.readFileSync(file, 'utf8')

        // Strip imports
        code = code.replace(/import[\s\S]*?from\s+['"][^'"]+['"]\s*;?/g, '')

        // Strip exports
        code = code
            .replace(/^\s*export\s*{[^}]+};?\s*$/gm, '')
            .replace(/^\s*export\s+\*.*$/gm, '')
            .replace(/^\s*export\s+default\s+.*$/gm, '')

        // Normalize line endings, trim trailing spaces
        code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        code = code.replace(/[ \t]+$/gm, '')

        output +=
            '// -------- FILE: ' +
            path.relative(process.cwd(), file) +
            ' --------\n'
        output += code.trim() + '\n\n'
    }

    const outputPath = path.resolve(process.cwd(), '__SCRIPT.ts')
    fs.writeFileSync(outputPath, output, 'utf8')

    console.log('\n__SCRIPT.ts generated successfully\n')
}
