import fs from 'fs'
import path from 'path'

interface MergeOptions {
    entryFile: string
    skipFiles?: (file: string) => boolean
    namespace?: string
}

const visited = new Set<string>()
const ordered: string[] = []

// ------------------------------------------------------------
// Resolve imports
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// DFS + skip system
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Collect modules by folder (Entities, UI, AI, Types, etc.)
// ------------------------------------------------------------
function collectModules(): Record<string, string[]> {
    const groups: Record<string, string[]> = {}

    for (const file of ordered) {
        const rel = path.relative(process.cwd(), file).replace(/\\/g, '/')

        // Match "src/<folder>/<file>.ts"
        const parts = rel.split('/')
        if (parts.length >= 3 && parts[0] === 'src') {
            const folder = parts[1]
            const fileName = parts[2].replace(/\..*$/, '') // remove extension

            if (!groups[folder]) groups[folder] = []
            groups[folder].push(fileName)
        }
    }

    return groups
}

// ------------------------------------------------------------
// Runtime namespace generator (recommended, real object)
// ------------------------------------------------------------
function generateRuntimeNamespace(
    groups: Record<string, string[]>,
    rootNS: string
): string {
    let out = `// ----- AUTO-GENERATED PORTAL NAMESPACE -----\n`
    out += `export const ${rootNS} = {\n`

    for (const folder of Object.keys(groups)) {
        const sub = capitalize(folder)
        out += `  ${sub}: {\n`

        for (const file of groups[folder]) {
            const moduleName = capitalize(file)
            const symbolName = capitalize(file)

            // Example output:
            // AreaTrigger: AreaTriggerModule.AreaTrigger,
            out += `    ${symbolName}: ${moduleName}Module.${symbolName},\n`
        }

        out += `  },\n`
    }

    out += `} as const;\n\n`
    return out
}

function capitalize(str: string): string {
    return str[0].toUpperCase() + str.slice(1)
}

// ------------------------------------------------------------
// Strip imports
// ------------------------------------------------------------
function stripImports(code: string): string {
    code = code.replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"]\s*;?/gm, '')
    code = code.replace(/^\s*export\s+import\s+.*?;/gm, '')
    return code
}

// ------------------------------------------------------------
// MAIN MERGE FUNCTION
// ------------------------------------------------------------
export default function merge(options: MergeOptions) {
    const skip = options.skipFiles ?? (() => false)
    const namespace = options.namespace ?? 'Portal'

    resolveFile(options.entryFile, skip)

    let output = ''
    output += `import * as modlib from 'modlib'\n\n`

    const groups = collectModules()
    const nsBlock = generateRuntimeNamespace(groups, namespace)

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

    output += nsBlock

    fs.writeFileSync('__MERGED.ts', output, 'utf8')
    console.log('__MERGED.ts generated successfully')
}
