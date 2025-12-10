import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// inline colors
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

// annotation param map: fullKey -> paramCount
let annotationParamMap = new Map()

// ------------------------------------------------------------
// COMMENT STRIPPING
// ------------------------------------------------------------
function stripComments(code) {
    code = code.replace(/\/\*[\s\S]*?\*\//g, '')
    code = code.replace(/\/\/(?!\s*@stringkeys).*$/gm, '')
    return code
}

// ------------------------------------------------------------
// LOAD CONFIG
// ------------------------------------------------------------
function loadConfig() {
    const pkgPath = path.join(process.cwd(), 'package.json')
    if (!fs.existsSync(pkgPath)) return { warnUnusedStrings: false }

    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
        return pkg.bf6mod || { warnUnusedStrings: false }
    } catch {
        return { warnUnusedStrings: false }
    }
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
function ensureNamespace(obj, parts) {
    let cur = obj
    for (const p of parts) {
        if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {}
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
// PARSE @stringkeys (tracks paramCount per entry)
// ------------------------------------------------------------
function parseStringKeys(content) {
    const anns = []
    const lines = content.split(/\r?\n/)

    for (const line of lines) {
        const m = line.match(/@stringkeys\s+([A-Za-z0-9_.]+)\s*:\s*(.+)/)
        if (!m) continue

        const ns = m[1]
        const raw = m[2].trim()

        const tokens = raw
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        const values = []

        for (const t of tokens) {
            const range = t.match(/^(.+)\.\.(.+)$/)
            if (range) {
                const start = range[1].trim()
                const end = range[2].trim()

                const isNumStart = /^[0-9]+$/.test(start)
                const isNumEnd = /^[0-9]+$/.test(end)
                const isAlphaStart = /^[A-Za-z]$/.test(start)
                const isAlphaEnd = /^[A-Za-z]$/.test(end)

                // numeric range
                if (isNumStart && isNumEnd) {
                    const sNum = parseInt(start, 10)
                    const eNum = parseInt(end, 10)
                    if (eNum >= sNum) {
                        const width = start.length
                        for (let i = sNum; i <= eNum; i++) {
                            let v = String(i)
                            if (start[0] === '0' && v.length < width) {
                                v = v.padStart(width, '0')
                            }
                            values.push({ key: v, paramCount: 0 })
                        }
                    }
                    continue
                }

                // alphabetical range
                if (isAlphaStart && isAlphaEnd) {
                    const a = start.charCodeAt(0)
                    const b = end.charCodeAt(0)
                    if (b >= a) {
                        for (let c = a; c <= b; c++) {
                            values.push({
                                key: String.fromCharCode(c),
                                paramCount: 0,
                            })
                        }
                    }
                    continue
                }
            }

            // literal entry — extract base key and param count
            let base = t.trim()

            const spaceIdx = base.search(/\s/)
            if (spaceIdx !== -1) base = base.slice(0, spaceIdx)

            const braceIdx = base.indexOf('{')
            if (braceIdx !== -1) base = base.slice(0, braceIdx)

            if (!base) continue

            const paramCount = countPlaceholders(t)
            values.push({ key: base, paramCount })
        }

        anns.push({ ns, values })
    }

    return anns
}

// ------------------------------------------------------------
// EXTRACT STRING REFERENCES
// ------------------------------------------------------------
function extractKeyRefs(content) {
    const refs = []

    // ------------------------------------------------------------
    // FIX 1 + FIX 2 APPLIED HERE
    //
    //  - supports nested parentheses in params
    //  - supports backtick literal keys
    //  - preserves all prior working cases
    // ------------------------------------------------------------
    const staticMsg =
        /mod\.Message\s*\(\s*(['"`])([\s\S]*?)(?<!\$\{)\1\s*(?:,\s*([\s\S]*?))?\)/g

    let m
    while ((m = staticMsg.exec(content)) !== null) {
        const key = m[2].trim()
        if (!key) continue

        const params = m[3]
        let paramCount = 0

        if (params) {
            let depth = 0
            let parts = 0
            for (let i = 0; i < params.length; i++) {
                const ch = params[i]
                if (ch === '(') depth++
                else if (ch === ')') depth--
                else if (ch === ',' && depth === 0) parts++
            }
            paramCount = parts + 1
        }

        refs.push({ key, paramCount, dynamic: false })
    }

    // static SK (dot notation only)
    const staticSK =
        /mod\.stringkeys\.([A-Za-z0-9_$.]+)(?=(?!\s*\[)\s*(?:$|[\s),+]))/g

    while ((m = staticSK.exec(content)) !== null) {
        refs.push({ key: m[1], paramCount: 0, dynamic: false })
    }

    // dynamic mod.Message(`ns.${x}`)
    const dynamicMsg =
        /mod\.Message\s*\(\s*`([A-Za-z0-9_.]+)\.\$\{([\s\S]*?)\}`\s*(?:,([^)]*))?\)/g

    while ((m = dynamicMsg.exec(content)) !== null) {
        const ns = m[1]
        const params = m[3]
        const paramCount = params ? params.split(',').length : 0
        refs.push({ namespace: ns, paramCount, dynamic: true })
    }

    return refs
}

// ------------------------------------------------------------
// UPDATE / INSERT KEY
// ------------------------------------------------------------
function updateKey(fullKey, paramCount, strings) {
    const parts = fullKey.split('.')
    const leaf = parts.pop()
    const parent = ensureNamespace(strings, parts)

    const annParam = annotationParamMap.get(fullKey)
    const effectiveParamCount = annParam !== undefined ? annParam : paramCount

    let value = parent[leaf]

    if (value === undefined) {
        value = fullKey
        if (effectiveParamCount > 0) {
            value += ' ' + Array(effectiveParamCount).fill('{}').join(' ')
        }
        parent[leaf] = value
        console.log(`${C.blue}Added:${C.reset} ${fullKey}`)
        return true
    }

    const existingPH = countPlaceholders(value)

    if (annParam !== undefined) return false

    if (existingPH < effectiveParamCount) {
        parent[leaf] =
            value +
            ' ' +
            Array(effectiveParamCount - existingPH)
                .fill('{}')
                .join(' ')
        console.log(`${C.yellow}Updated placeholders:${C.reset} ${fullKey}`)
        return true
    }

    return false
}

// ------------------------------------------------------------
// MAIN PROCESS
// ------------------------------------------------------------
export default function run() {
    if (!fs.existsSync(SCRIPT_FILE)) {
        console.error('__SCRIPT.ts not found. Run merge first.')
        process.exit(1)
    }

    let content = fs.readFileSync(SCRIPT_FILE, 'utf8')
    content = stripComments(content)

    const strings = loadExistingStrings()
    const annotations = parseStringKeys(content)
    const refs = extractKeyRefs(content)
    const config = loadConfig()

    annotationParamMap = new Map()
    for (const ann of annotations) {
        for (const v of ann.values) {
            const fullKey = `${ann.ns}.${v.key}`
            annotationParamMap.set(fullKey, v.paramCount)
        }
    }

    let changed = false

    // 1) annotation keys
    for (const ann of annotations) {
        for (const v of ann.values) {
            const fullKey = `${ann.ns}.${v.key}`
            changed = updateKey(fullKey, v.paramCount, strings) || changed
        }
    }

    // 2) expand dynamic message namespaces
    for (const ref of refs) {
        if (!ref.dynamic) continue
        const ann = annotations.find((a) => a.ns === ref.namespace)
        if (!ann) continue
        for (const v of ann.values) {
            const fullKey = `${ref.namespace}.${v.key}`
            changed = updateKey(fullKey, ref.paramCount, strings) || changed
        }
    }

    // 3) static refs
    for (const ref of refs) {
        if (ref.dynamic) continue
        changed = updateKey(ref.key, ref.paramCount, strings) || changed
    }

    // 4) detect dynamic SK namespaces
    const dynamicSKUsed = new Set()
    const dynSKregex = /mod\.stringkeys\.([A-Za-z0-9_$.]+)\s*\[/g

    let mk
    while ((mk = dynSKregex.exec(content)) !== null) dynamicSKUsed.add(mk[1])

    // 5) warn unused
    if (config.warnUnusedStrings) {
        function flatten(obj, prefix = '', out = []) {
            for (const k in obj) {
                const full = prefix ? `${prefix}.${k}` : k
                if (typeof obj[k] === 'object') flatten(obj[k], full, out)
                else out.push(full)
            }
            return out
        }

        const allExisting = flatten(strings)
        const used = new Set()

        for (const ref of refs) if (!ref.dynamic) used.add(ref.key)

        for (const ref of refs) {
            if (!ref.dynamic) continue
            const ann = annotations.find((a) => a.ns === ref.namespace)
            if (!ann) continue
            for (const v of ann.values) used.add(`${ref.namespace}.${v.key}`)
        }

        for (const dynNS of dynamicSKUsed) {
            for (const key of allExisting) {
                if (key.startsWith(dynNS + '.')) used.add(key)
            }
        }

        for (const key of allExisting) {
            if (!used.has(key)) {
                console.log(`${C.magenta}[UNUSED]${C.reset} ${key}`)
            }
        }
    }

    // 6) write output
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
