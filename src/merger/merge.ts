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

    const importRegex =
        /import\s+(type\s+)?(?:[\s\S]*?)?from\s+["'](\.\/.*?|\.{2}\/.*?|src\/.*?)["'];?/g

    let match
    while ((match = importRegex.exec(code))) {
        const importPath = match[2]
        const resolved = resolveImport(filePath, importPath)
        if (resolved) {
            resolveFile(resolved)
        }
    }

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
// TOP-LEVEL DECLARATION PARSE
// ----------------------------

interface Decl {
    name: string
    kind: string
    file: string
}

// --- CHANGE: improved regex, supports "export abstract class"
const declRegex =
    /^\s*(export\s+)?(abstract\s+)?(class|interface|enum|type|const|let|var)\s+([A-Za-z0-9_]+)/

function findTopLevelDecls(file: string): Decl[] {
    const code = fs.readFileSync(file, 'utf8')
    const lines = code.split(/\r?\n/)
    const decls: Decl[] = []
    let depth = 0

    for (let line of lines) {
        const opens = (line.match(/{/g) || []).length
        const closes = (line.match(/}/g) || []).length
        const depthAtStart = depth
        depth += opens - closes

        if (depthAtStart !== 0) continue

        const m = line.match(declRegex)
        if (m) {
            // --- CHANGE: kind at m[3], name at m[4]
            const kind = m[3]
            const name = m[4]
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
// INHERITANCE ORDERING
// ----------------------------

// Build map: class name -> file
function buildClassMap(files: string[]): Map<string, string> {
    const classMap = new Map<string, string>()

    for (const file of files) {
        const decls = findTopLevelDecls(file)
        for (const d of decls) {
            if (d.kind === 'class') {
                if (!classMap.has(d.name)) {
                    classMap.set(d.name, file)
                }
            }
        }
    }

    return classMap
}

// --- CHANGE: improved inheritance regex, handles "export abstract class"
const inheritRegex =
    /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_]+)\s+extends\s+([A-Za-z0-9_]+)/g

function computeInheritanceOrder(files: string[]): string[] {
    if (files.length <= 1) return files.slice()

    const classMap = buildClassMap(files)

    // Graph: baseFile -> derivedFiles
    const edges = new Map<string, Set<string>>()
    const inDegree = new Map<string, number>()

    for (const f of files) {
        edges.set(f, new Set())
        inDegree.set(f, 0)
    }

    // Scan for "class Child extends Parent"
    for (const file of files) {
        const code = fs.readFileSync(file, 'utf8')
        let m: RegExpExecArray | null

        while ((m = inheritRegex.exec(code))) {
            const child = m[1]
            const parent = m[2]

            const parentFile = classMap.get(parent)
            if (!parentFile) continue
            if (parentFile === file) continue

            const set = edges.get(parentFile)!
            if (!set.has(file)) {
                set.add(file)
                inDegree.set(file, (inDegree.get(file) || 0) + 1)
            }
        }
    }

    // Kahn topological sort, stable order
    const queue: string[] = []
    for (const f of files) {
        if ((inDegree.get(f) || 0) === 0) queue.push(f)
    }

    const result: string[] = []
    while (queue.length > 0) {
        const f = queue.shift()!
        result.push(f)

        const nextSet = edges.get(f)!
        for (const nxt of nextSet) {
            const deg = (inDegree.get(nxt) || 0) - 1
            inDegree.set(nxt, deg)
            if (deg === 0) queue.push(nxt)
        }
    }

    if (result.length !== files.length) {
        console.warn('')
        console.warn(
            'WARNING: Inheritance cycle detected. Falling back to import order.'
        )
        console.warn('')
        return files.slice()
    }

    return result
}

// ----------------------------

export default function merge(entryFileInput?: string) {
    const entryFile =
        entryFileInput ?? path.resolve(process.cwd(), 'src/main.ts')

    const absEntry = path.resolve(entryFile)
    resolveFile(absEntry)

    const importOrdered = ordered.slice()

    enforceIdentifierUniqueness(importOrdered)

    const finalOrdered = computeInheritanceOrder(importOrdered)

    let output = ''

    output += "import * as modlib from 'modlib'\n\n"

    for (const file of finalOrdered) {
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
