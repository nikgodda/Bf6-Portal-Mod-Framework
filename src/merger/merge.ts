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

    // Add modlib import at the very top
    output += "import * as modlib from 'modlib'\n\n"

    for (const file of ordered) {
        let code = fs.readFileSync(file, 'utf8')

        // Remove all import statements
        code = code.replace(/^\s*import\s+.*from\s+['"].+['"]\s*;?\s*$/gm, '')

        // Remove 'export' keywords
        code = code.replace(
            /^\s*export\s+(abstract\s+)?(?=class|interface|type|enum|const|let|var)/gm,
            '$1'
        )

        // Remove comments (except our FILE marker)
        code = code.replace(/\/\/[^\n]*/g, '')

        // Normalize EOL
        code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

        // Remove excessive blank lines
        code = code.replace(/\n{3,}/g, '\n\n')

        output +=
            '// -------- FILE: ' +
            path.relative(process.cwd(), file) +
            ' --------\n'
        output += code.trim() + '\n\n'
    }

    const outputPath = path.resolve('__MERGED.ts')
    fs.writeFileSync(outputPath, output, 'utf8')

    console.log('\n__MERGED.ts generated successfully\n')
}
