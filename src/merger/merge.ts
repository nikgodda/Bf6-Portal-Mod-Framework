import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Resolve __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const visited = new Set<string>()
const ordered: string[] = []

// ----------------------------------------------
// Resolve imports recursively
// ----------------------------------------------
function resolveFile(filePath: string) {
    if (visited.has(filePath)) return
    visited.add(filePath)

    if (!fs.existsSync(filePath)) {
        console.error('File not found ' + filePath)
        process.exit(1)
    }

    const code = fs.readFileSync(filePath, 'utf8')

    const importRegex =
        /import\s+(?:[\s\S]*?)?from\s+["'](\.\/.*?|\.{2}\/.*?)["']/g
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

// ----------------------------------------------
// Format each file block safely
// ----------------------------------------------
function sanitizeCode(code: string) {
    let result = code

    // Remove all import lines
    result = result.replace(/^\s*import\s+.*?["'].*?["']\s*$/gm, '')

    // Remove export but keep class/type
    result = result.replace(
        /^\s*export\s+(abstract\s+)?(?=class|interface|type|enum|const|let|var)/gm,
        '$1'
    )

    // Ensure comments end with real newline
    result = result.replace(/\/\/[^\n]*$/gm, (m) => m + '\n')

    // Normalize EOL to LF
    result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    // Trim trailing whitespace
    result = result.replace(/[ \t]+$/gm, '')

    return result.trim()
}

// ----------------------------------------------
// Main merge logic
// ----------------------------------------------
export default function merge() {
    const entryFile = path.resolve(process.cwd(), 'src/main.ts')

    resolveFile(entryFile)

    let output = ''

    output += "import * as modlib from 'modlib'\n\n"

    for (const file of ordered) {
        const code = sanitizeCode(fs.readFileSync(file, 'utf8'))

        output +=
            '// -------- FILE: ' +
            path.relative(process.cwd(), file) +
            ' --------\n\n'
        output += code + '\n\n'
    }

    output = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    const outPath = path.resolve(process.cwd(), '__MERGED.ts')
    fs.writeFileSync(outPath, output, 'utf8')

    console.log('Merged successfully into __MERGED.ts')
}
