import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT = process.cwd()
const SCRIPT_FILE = path.join(ROOT, '__SCRIPT.ts')
const OUTFILE = path.join(ROOT, '__STRINGS.json')

// -------------------------------------------------------
// Utility
// -------------------------------------------------------

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
    } catch (e) {
        console.error('Failed to parse __STRINGS.json')
        process.exit(1)
    }
}

// -------------------------------------------------------
// Parse annotations (@range, @keys, @values)
// -------------------------------------------------------

function parseAnnotations(content) {
    const anns = []
    const lines = content.split(/\r?\n/)

    for (const line of lines) {
        // @range ns: a-b
        let m = line.match(
            /\/\/\s*@range\s+([A-Za-z0-9_]+)\s*:\s*(\d+)\s*-\s*(\d+)/
        )
        if (m) {
            anns.push({
                type: 'range',
                ns: m[1],
                start: Number(m[2]),
                end: Number(m[3]),
            })
            continue
        }

        // @keys ns: A, B, C
        m = line.match(/\/\/\s*@keys\s+([A-Za-z0-9_]+)\s*:\s*([^]+)/)
        if (m) {
            const ns = m[1]
            const keys = m[2]
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean)
            anns.push({ type: 'keys', ns, keys })
            continue
        }

        // @values ns arrayName
        m = line.match(/\/\/\s*@values\s+([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)/)
        if (m) {
            anns.push({ type: 'values', ns: m[1], arrayName: m[2] })
            continue
        }
    }

    return anns
}

function extractArrayValues(content) {
    const arrays = {}
    const regex = /const\s+([A-Za-z0-9_]+)\s*=\s*\[\s*([^]*?)\s*\]/gm
    let m

    while ((m = regex.exec(content)) !== null) {
        const name = m[1]
        const body = m[2]
        const values = [...body.matchAll(/["'`]([^"'`]+)["'`]/g)].map(
            (mm) => mm[1]
        )
        arrays[name] = values
    }

    return arrays
}

// -------------------------------------------------------
// Extract Message keys
// -------------------------------------------------------

function extractKeyRefs(content) {
    const refs = []

    // Static Message("ns.key", ...)
    const staticMsg =
        /mod\.Message\s*\(\s*(['"`])([^"'`]+)\1\s*(?:,([^)]*))?\)/g
    let m
    while ((m = staticMsg.exec(content)) !== null) {
        const params = m[3]
        const paramCount = params ? params.split(',').length : 0
        refs.push({
            key: m[2],
            paramCount,
            isDynamic: false,
        })
    }

    // Static stringkeys.ns.key
    const staticSK = /mod\.stringkeys\.([A-Za-z0-9_$.]+)/g
    while ((m = staticSK.exec(content)) !== null) {
        refs.push({
            key: m[1],
            paramCount: 0,
            isDynamic: false,
        })
    }

    // Dynamic: Message(`ns.${value}`, ...)
    const dynamicMsg =
        /mod\.Message\s*\(\s*`([A-Za-z0-9_]+)\.\$\{([^}]+)\}`\s*(?:,([^)]*))?\)/g
    while ((m = dynamicMsg.exec(content)) !== null) {
        const params = m[3]
        const paramCount = params ? params.split(',').length : 0
        refs.push({
            key: m[1],
            isDynamic: true,
            dynamicNamespace: m[1],
            paramCount,
        })
    }

    return refs
}

// -------------------------------------------------------
// Apply updates to strings.json
// -------------------------------------------------------

function updateKey(fullKey, paramCount, strings) {
    const parts = fullKey.split('.')
    const leaf = parts.pop()
    const parent = ensureNamespace(strings, parts)

    let value = parent[leaf]

    // New key
    if (value === undefined) {
        value = fullKey
        if (paramCount > 0) value += ' ' + '{}'.repeat(paramCount)
        parent[leaf] = value
        console.log('Added:', fullKey)
        return true
    }

    // Existing value → maybe add placeholders
    const existingPH = countPlaceholders(value)
    if (existingPH < paramCount) {
        parent[leaf] = value + ' ' + '{}'.repeat(paramCount - existingPH)
        console.log('Updated placeholders for:', fullKey)
        return true
    }

    return false
}

// -------------------------------------------------------
// MAIN
// -------------------------------------------------------

export default function run() {
    if (!fs.existsSync(SCRIPT_FILE)) {
        console.error('__SCRIPT.ts not found. Run merge first.')
        process.exit(1)
    }

    const content = fs.readFileSync(SCRIPT_FILE, 'utf8')
    const strings = loadExistingStrings()
    const annotations = parseAnnotations(content)
    const arrays = extractArrayValues(content)
    const refs = extractKeyRefs(content)

    let changed = false

    // Dynamic keys
    for (const ref of refs) {
        if (!ref.isDynamic) continue

        const ns = ref.dynamicNamespace

        // @range
        const rangeAnn = annotations.find(
            (a) => a.type === 'range' && a.ns === ns
        )
        if (rangeAnn) {
            for (let i = rangeAnn.start; i <= rangeAnn.end; i++) {
                changed =
                    updateKey(`${ns}.${i}`, ref.paramCount, strings) || changed
            }
            continue
        }

        // @keys
        const keysAnn = annotations.find(
            (a) => a.type === 'keys' && a.ns === ns
        )
        if (keysAnn) {
            for (const k of keysAnn.keys) {
                changed =
                    updateKey(`${ns}.${k}`, ref.paramCount, strings) || changed
            }
            continue
        }

        // @values
        const valAnn = annotations.find(
            (a) => a.type === 'values' && a.ns === ns
        )
        if (valAnn) {
            const arr = arrays[valAnn.arrayName]
            if (arr) {
                for (const k of arr) {
                    changed =
                        updateKey(`${ns}.${k}`, ref.paramCount, strings) ||
                        changed
                }
                continue
            }
        }

        console.warn(
            '[WARN] Dynamic key "' +
                ns +
                '.*" has no annotation (@range, @keys, @values)'
        )
    }

    // Static keys
    for (const ref of refs) {
        if (ref.isDynamic) continue
        changed = updateKey(ref.key, ref.paramCount, strings) || changed
    }

    // Write file
    if (changed) {
        fs.writeFileSync(
            OUTFILE,
            JSON.stringify(strings, null, 2) + '\n',
            'utf8'
        )
        console.log('Updated __STRINGS.json')
        console.log('Upload __STRINGS.json to Portal UI.')
    } else {
        console.log('Strings already up to date.')
    }
}

run()
