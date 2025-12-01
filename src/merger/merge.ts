import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const visited = new Set<string>()
const ordered: string[] = []

// Config object filled when merge() is called
let currentConfig: MergeConfig = {}

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

interface MergeConfig {
    skipFiles?: (filePath: string) => boolean
    entryFile?: string
}

type MergeArg = string | MergeConfig | undefined

interface Decl {
    name: string
    kind: string
    file: string
}

// ------------------------------------------------------------
// Resolve files and imports
// ------------------------------------------------------------

function resolveFile(filePath: string) {
    if (visited.has(filePath)) return

    // Skip rule
    if (currentConfig.skipFiles && currentConfig.skipFiles(filePath)) {
        visited.add(filePath)
        return
    }

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
        if (resolved) resolveFile(resolved)
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

// ------------------------------------------------------------
// Top-level declarations
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// Inheritance ordering
// ------------------------------------------------------------

const inheritRegex =
    /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_]+)\s+extends\s+([A-Za-z0-9_]+)/g

function buildClassMap(files: string[]) {
    const map = new Map<string, string>()

    for (const file of files) {
        const decls = findTopLevelDecls(file)
        for (const d of decls) {
            if (d.kind === 'class') {
                if (!map.has(d.name)) map.set(d.name, file)
            }
        }
    }

    return map
}

function computeInheritanceOrder(files: string[]): string[] {
    if (files.length <= 1) return files.slice()

    const classMap = buildClassMap(files)

    const edges = new Map<string, Set<string>>()
    const inDegree = new Map<string, number>()

    for (const f of files) {
        edges.set(f, new Set())
        inDegree.set(f, 0)
    }

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
        console.warn('WARNING: Inheritance cycle detected. Using import order.')
        console.warn('')
        return files.slice()
    }

    return result
}

// ------------------------------------------------------------
// Merge output
// ------------------------------------------------------------

export default function merge(arg?: MergeArg) {
    visited.clear()
    ordered.length = 0

    let entryFilePath: string

    if (typeof arg === 'string') {
        currentConfig = {}
        entryFilePath = path.resolve(process.cwd(), arg)
    } else {
        const opts = arg || {}
        currentConfig = {
            skipFiles: opts.skipFiles,
        }
        const entry =
            opts.entryFile ?? path.resolve(process.cwd(), 'src/main.ts')
        entryFilePath = path.resolve(entry)
    }

    resolveFile(entryFilePath)

    enforceIdentifierUniqueness(ordered)

    const finalOrdered = computeInheritanceOrder(ordered)

    let output = ''

    output += "import * as modlib from 'modlib'\n\n"

    for (const file of finalOrdered) {
        let code = fs.readFileSync(file, 'utf8')

        // Convert "export import X = Y.X" syntax
        code = code.replace(
            /^\s*export\s+import\s+([A-Za-z0-9_]+)\s*=\s*([^;]+);?/gm,
            'export const $1 = $2;'
        )

        // Remove type imports
        code = code.replace(/^import\s+type\s+.*?;?$/gm, '')

        // Remove non-namespace imports
        code = code.replace(
            /^import\s+(?!\*\s+as\s+[A-Za-z0-9_]+\s+from)[\s\S]*?from\s+['"][^'"]+['"]\s*;?$/gm,
            ''
        )

        // Remove bare imports
        code = code.replace(/^import\s+['"][^'"]+['"]\s*;?$/gm, '')

        // Remove export junk
        code = code
            .replace(/^\s*export\s*{[^}]+};?\s*$/gm, '')
            .replace(/^\s*export\s+\*.*$/gm, '')
            .replace(/^\s*export\s+default\s+.*$/gm, '')

        code = code.replace(/\r\n/g, '\n')
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
