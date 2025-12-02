import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Inline colors
const C = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT = process.cwd()
const SCRIPT_FILE = path.join(ROOT, '__SCRIPT.ts')
const OUTFILE = path.join(ROOT, '__STRINGS.json')

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function ensureNamespace(obj, parts) {
    let cur = obj
    for (const p of parts) {
        if (typeof cur[p] !== 'object' || cur[p] === null) {
            cur[p] = {}
        }
        cur = cur[p]
    }
    return cur
}

function countPlaceholders(str) {
    const m = str.match(/\{\}/g)
    return m ? m.length : 0
}

function loadExistingStrings() {
    if (!fs.existsSync(OUTFILE)) return {}
    try {
        return JSON.parse(fs.readFileSync(OUTFILE, 'utf8'))
    } catch {
        console.error('Failed to parse __STRINGS.json')
        process.exit(1)
    }
}

// ------------------------------------------------------------
// @stringkeys parser — supports nested namespaces (a.b.c)
// ------------------------------------------------------------
function parseStringKeys(content) {
    const anns = []
    const lines = content.split(/\r?\n/)

    for (const line of lines) {
        const m = line.match(/\/\/\s*@stringkeys\s+([A-Za-z0-9_.]+)\s*:\s*(.+)/)
        if (!m) continue

        const ns = m[1] // supports dots now
        const raw = m[2].trim()

        const tokens = raw
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        const values = []

        for (const t of tokens) {
            // range detection
            const rangeMatch = t.match(/^(.+)\.\.(.+)$/)
            if (rangeMatch) {
                const start = rangeMatch[1].trim()
                const end = rangeMatch[2].trim()

                const sNum = Number(start)
                const eNum = Number(end)

                // numeric range
                if (!isNaN(sNum) && !isNaN(eNum)) {
                    for (let i = sNum; i <= eNum; i++) values.push(String(i))
                    continue
                }

                // alphabetical range
                if (start.length === 1 && end.length === 1) {
                    const s = start.charCodeAt(0)
                    const e = end.charCodeAt(0)
                    for (let c = s; c <= e; c++) {
                        values.push(String.fromCharCode(c))
                    }
                    continue
                }

                continue
            }

            values.push(t)
        }

        anns.push({ ns, values })
    }

    return anns
}

// ------------------------------------------------------------
// Extract static & dynamic keys
// ------------------------------------------------------------
function extractKeyRefs(content) {
    const refs = []

    // Static: mod.Message("some.key")
    const staticMsg = /mod\.Message\s*\(\s*(['"])([^"'`]+)\1\s*(?:,([^)]*))?\)/g
    let m
    while ((m = staticMsg.exec(content)) !== null) {
        const params = m[3]
        const paramCount = params ? params.split(',').length : 0
        refs.push({
            key: m[2],
            paramCount,
            dynamic: false,
        })
    }

    // Static: mod.stringkeys.x
    const staticSK = /mod\.stringkeys\.([A-Za-z0-9_$.]+)/g
    while ((m = staticSK.exec(content)) !== null) {
        refs.push({
            key: m[1],
            paramCount: 0,
            dynamic: false,
        })
    }

    // Dynamic: mod.Message(`ns.sub.${value}`)
    const dynamicMsg =
        /mod\.Message\s*\(\s*`([A-Za-z0-9_.]+)\.\$\{(.*?)\}`\s*(?:,([^)]*))?\)/g

    while ((m = dynamicMsg.exec(content)) !== null) {
        const ns = m[1] // now supports nested namespaces
        const params = m[3]
        const paramCount = params ? params.split(',').length : 0

        refs.push({
            namespace: ns,
            paramCount,
            dynamic: true,
        })
    }

    return refs
}

// ------------------------------------------------------------
// Insert/update string key
// ------------------------------------------------------------
function updateKey(fullKey, paramCount, strings) {
    const parts = fullKey.split('.')
    const leaf = parts.pop()
    const parent = ensureNamespace(strings, parts)

    let value = parent[leaf]

    if (value === undefined) {
        value = fullKey
        if (paramCount > 0) value += ' ' + '{}'.repeat(paramCount)
        parent[leaf] = value
        console.log(`${C.blue}Added:${C.reset} ${fullKey}`)
        return true
    }

    const existingPH = countPlaceholders(value)
    if (existingPH < paramCount) {
        parent[leaf] = value + ' ' + '{}'.repeat(paramCount - existingPH)
        console.log(`${C.yellow}Updated placeholders:${C.reset} ${fullKey}`)
        return true
    }

    return false
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
export default function run() {
    if (!fs.existsSync(SCRIPT_FILE)) {
        console.error('__SCRIPT.ts not found. Run merge first.')
        process.exit(1)
    }

    const content = fs.readFileSync(SCRIPT_FILE, 'utf8')
    const strings = loadExistingStrings()
    const annotations = parseStringKeys(content)
    const refs = extractKeyRefs(content)

    let changed = false

    // Dynamic keys with @stringkeys
    for (const ref of refs) {
        if (!ref.dynamic) continue

        const ann = annotations.find((a) => a.ns === ref.namespace)
        if (!ann) continue

        for (const val of ann.values) {
            const fullKey = `${ref.namespace}.${val}`
            changed = updateKey(fullKey, ref.paramCount, strings) || changed
        }
    }

    // Static keys
    for (const ref of refs) {
        if (ref.dynamic) continue
        changed = updateKey(ref.key, ref.paramCount, strings) || changed
    }

    // Write output
    if (changed) {
        fs.writeFileSync(
            OUTFILE,
            JSON.stringify(strings, null, 2) + '\n',
            'utf8'
        )
        console.log(`${C.yellow}Upload __STRINGS.json to Portal UI.${C.reset}`)
        return true
    }

    return false
}
