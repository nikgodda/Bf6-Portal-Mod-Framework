import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const visited = new Set<string>()
const ordered: string[] = []

// --- CIRCULAR: new tracking sets
const visiting = new Set<string>()
const dependencyStack: string[] = []

function resolveFile(filePath: string) {
    // --- CIRCULAR: if already resolved, skip
    if (visited.has(filePath)) return

    // --- CIRCULAR: detect cycle
    if (visiting.has(filePath)) {
        const startIndex = dependencyStack.indexOf(filePath)
        const cycle = [
            ...dependencyStack.slice(startIndex >= 0 ? startIndex : 0),
            filePath,
        ]

        console.error('')
        console.error('CIRCULAR DEPENDENCY DETECTED')
        console.error('The following import chain forms a cycle:')
        for (const f of cycle) {
            console.error('  ' + path.relative(process.cwd(), f))
        }
        console.error('')
        console.error('Fix this cycle by redesigning imports')
        console.error('')
        process.exit(1)
    }

    // --- CIRCULAR: mark as visiting
    visiting.add(filePath)
    dependencyStack.push(filePath)

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

    // --- CIRCULAR: finished visiting
    dependencyStack.pop()
    visiting.delete(filePath)

    visited.add(filePath)
    ordered.push(filePath)
}

function resolveImport(baseFile: string, reqPath: string) {
    const baseDir = path.dirname(baseFile)

    let abs: string | null = null

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

// ----------------------------
// TOP-LEVEL DUPLICATE CHECK
// ----------------------------

interface Decl {
    name: string
    kind: string
    file: string
}

function findTopLevelDecls(file: string): Decl[] {
    const code = fs.readFileSync(file, 'utf8')
    const lines = code.split(/\r?\n/)
    const decls: Decl[] = []
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

function enforceIdentifierUniqueness(files: string[]) {
    const map = new Map<string, Decl>()

    for (const file of files) {
        const decls = findTopLevelDecls(file)
        for (const d of decls) {
            if (map.has(d.name)) {
                const a = map.get(d.name)!
                console.error('')
                console.error('MERGE ERROR: Duplicate top-level identifier!')
                console.error('Identifier: ' + d.name)
                console.error('Kind:       ' + d.kind)
                console.error('')
                console.error('First found in: ' + a.file)
                console.error('Found again in: ' + d.file)
                console.error('')
                process.exit(1)
            }
            map.set(d.name, d)
        }
    }
}

// ----------------------------

export default function merge(entryFileInput?: string) {
    const entryFile =
        entryFileInput ?? path.resolve(process.cwd(), 'src/main.ts')

    const absEntry = path.resolve(entryFile)
    resolveFile(absEntry)

    // BEFORE merging — run duplicate check
    enforceIdentifierUniqueness(ordered)

    let output = ''

    output += "import * as modlib from 'modlib'\n\n"

    for (const file of ordered) {
        let code = fs.readFileSync(file, 'utf8')

        code = code.replace(/import[\s\S]*?from\s+['"][^'"]+['"]\s*;?/g, '')

        code = code
            .replace(/^\s*export\s*{[^}]+};?\s*$/gm, '')
            .replace(/^\s*export\s+\*.*$/gm, '')
            .replace(/^\s*export\s+default\s+.*$/gm, '')

        code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
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
