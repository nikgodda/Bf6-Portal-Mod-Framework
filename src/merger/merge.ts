import fs from 'fs'
import path from 'path'

// ----------------------
// Merge Options
// ----------------------
interface MergeOptions {
    entryFile: string
    skipFiles?: (file: string) => boolean
    namespace?: string
}

// ----------------------
const visited = new Set<string>()
const ordered: string[] = []

// ----------------------
// Resolve imports
// ----------------------
function resolveImport(baseFile: string, reqPath: string): string | null {
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
    ]

    for (const c of candidates) {
        if (fs.existsSync(c)) return c
    }

    return null
}

// ----------------------
// DFS + Skip + Ordering
// ----------------------
function resolveFile(filePath: string, skip: (f: string) => boolean) {
    if (visited.has(filePath)) return
    if (skip(filePath)) return

    visited.add(filePath)

    const code = fs.readFileSync(filePath, 'utf8')

    const importRegex =
        /import\s+(?:type\s+)?(?:[\s\S]*?)?from\s+["'](\.\/.*?|\.{2}\/.*?|src\/.*?)["'];?/g

    let match
    while ((match = importRegex.exec(code))) {
        const importPath = match[1]
        const resolved = resolveImport(filePath, importPath)
        if (resolved) resolveFile(resolved, skip)
    }

    ordered.push(filePath)
}

// ----------------------
// Namespace collector
// ----------------------
function collectModules(): Record<string, string[]> {
    const groups: Record<string, string[]> = {}

    for (const file of ordered) {
        const rel = path.relative(process.cwd(), file).replace(/\\/g, '/')

        // match e.g. src/entities/foo.ts
        const parts = rel.split('/')
        if (parts.length >= 3 && parts[0] === 'src') {
            const folder = parts[1] // e.g. 'entities'
            const filename = parts[2].replace(/\..+$/, '') // no extension

            if (!groups[folder]) groups[folder] = []

            groups[folder].push(filename)
        }
    }
    return groups
}

// ----------------------
// Namespace generator
// ----------------------
function generateNamespace(
    groups: Record<string, string[]>,
    rootNS: string
): string {
    let out = `// ----- AUTO-GENERATED NAMESPACE -----\n`
    out += `export namespace ${rootNS} {\n`

    for (const folder of Object.keys(groups)) {
        const sub = folder[0].toUpperCase() + folder.slice(1)

        out += `  export namespace ${sub} {\n`

        for (const item of groups[folder]) {
            const moduleName = item[0].toUpperCase() + item.slice(1)
            const symbolName = item[0].toUpperCase() + item.slice(1)

            // Example:
            // export import AreaTrigger = AreaTriggerModule.AreaTrigger
            out += `    export import ${symbolName} = ${moduleName}Module.${symbolName};\n`
        }

        out += `  }\n`
    }

    out += `}\n\n`
    return out
}

// ----------------------
// Strip imports safely
// ----------------------
function stripImports(code: string): string {
    // Remove ALL forms of import
    code = code.replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"]\s*;?/gm, '')
    code = code.replace(/^\s*export\s+import\s+.*?;/gm, '')
    return code
}

// ----------------------
// MAIN MERGE
// ----------------------
export default function merge(options: MergeOptions) {
    const skip = options.skipFiles ?? (() => false)
    const namespace = options.namespace ?? 'Portal'

    // Order files
    resolveFile(options.entryFile, skip)

    let output = ''
    output += `import * as modlib from 'modlib'\n\n`

    // Collect folders + modules
    const groups = collectModules()
    const namespaceBlock = generateNamespace(groups, namespace)

    // Merge files
    for (const file of ordered) {
        let code = fs.readFileSync(file, 'utf8')

        code = stripImports(code)
        code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        code = code.replace(/[ \t]+$/gm, '')

        output += `// -------- FILE: ${path.relative(
            process.cwd(),
            file
        )} --------\n`
        output += code.trim() + '\n\n'
    }

    // Append namespace LAST
    output += namespaceBlock

    fs.writeFileSync('__MERGED.ts', output, 'utf8')

    console.log('__MERGED.ts generated successfully')
}
