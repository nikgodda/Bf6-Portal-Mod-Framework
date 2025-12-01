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

function countPlaceholders(text) {
    const m = text.match(/\{\}/g)
    return m ? m.length : 0
}

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
// Annotation parsing
// -------------------------------------------------------

function parseAnnotations(content) {
    const anns = []
    const lines = content.split(/\r?\n/)

    for (const line of lines) {
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

        m = line.match(/\/\/\s*@values\s+([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)/)
        if (m) {
            anns.push({ type: 'values', ns: m[1], arrayName: m[2] })
            continue
        }
    }

    return anns
}

function extractArrayValues(content) {
    const out = {}
    const regex = /const\s+([A-Za-z0-9_]+)\s*=\s*\[\s*([^]*?)\s*\]/gm
    let m
    while ((m = regex.exec(content)) !== null) {
        const name = m[1]
        const body = m[2]
        const vals = [...body.matchAll(/["'`]([^"'`]+)["'`]/g)].map(
            (mm) => mm[1]
        )
        out[name] = vals
    }
    return out
}

// -------------------------------------------------------
// Key extraction from __SCRIPT.ts
// -------------------------------------------------------

function extractKeyRefs(content) {
    const refs = []

    // Static: mod.Message("ns.key", ...)
    const staticMsg =
        /mod\.Message\s*\(\s*(['"`])([^"'`]+)\1\s*(?:,([^)]*))?\)/g
    let m
    while ((m = staticMsg.exec(content)) !== null) {
        const key = m[2]
        const params = m[3]
        const paramCount = params ? params.split(',').length : 0
        refs.push({ key, paramCount, isDynamic: false })
    }

    // Static: mod.stringkeys.ns.key
    const sk = /mod\.stringkeys\.([A-Za-z0-9_$.]+)/g
    while ((m = sk.exec(content)) !== null) {
        refs.push({ key: m[1], paramCount: 0, isDynamic: false })
    }

    // Dynamic: mod.Message(`ns.${something}`, ...)
    const dyn =
        /mod\.Message\s*\(\s*`([A-Za-z0-9_]+)\.\$\{([^}]+)\}`\s*(?:,([^)]*))?\)/g
    while ((m = dyn.exec(content)) !== null) {
        const ns = m[1]
        const params = m[3]
        const paramCount = params ? params.split(',').length : 0
        refs.push({
            key: ns,
            paramCount,
            isDynamic: true,
            dynamicNamespace: ns,
        })
    }

    return refs
}

// -------------------------------------------------------
// Strings update
// -------------------------------------------------------

function updateKey(fullKey, paramCount, strings) {
    const parts = fullKey.split('.')
    const leaf = parts.pop()
    const parent = ensureNamespace(strings, parts)

    let val = parent[leaf]

    if (val === undefined) {
        // new key: default value is key, plus {} for params
        val = fullKey
        if (paramCount > 0) {
            val += ' ' + '{}'.repeat(paramCount)
        }
        parent[leaf] = val
        console.log('Added:', fullKey)
        return true
    }

    if (typeof val === 'string') {
        const existing = countPlaceholders(val)
        if (existing < paramCount) {
            parent[leaf] = val + ' ' + '{}'.repeat(paramCount - existing)
            console.log('Updated placeholders for:', fullKey)
            return true
        }
    }

    return false
}

// -------------------------------------------------------
// Main
// -------------------------------------------------------

export default function run() {
    if (!fs.existsSync(SCRIPT_FILE)) {
        console.error('__SCRIPT.ts not found. Run merge first.')
        process.exit(1)
    }

    console.log('Reading __SCRIPT.ts for localization keys...')
    const content = fs.readFileSync(SCRIPT_FILE, 'utf8')

    const strings = loadExistingStrings()
    const refs = extractKeyRefs(content)
    const annotations = parseAnnotations(content)
    const arrays = extractArrayValues(content)

    let changed = false

    // Handle dynamic keys with annotations
    for (const ref of refs) {
        if (!ref.isDynamic) continue

        const ns = ref.dynamicNamespace

        const rangeAnn = annotations.find(
            (a) => a.type === 'range' && a.ns === ns
        )
        if (rangeAnn) {
            for (let i = rangeAnn.start; i <= rangeAnn.end; i++) {
                const key = ns + '.' + i
                changed = updateKey(key, ref.paramCount, strings) || changed
            }
            continue
        }

        const keysAnn = annotations.find(
            (a) => a.type === 'keys' && a.ns === ns
        )
        if (keysAnn) {
            for (const k of keysAnn.keys) {
                const key = ns + '.' + k
                changed = updateKey(key, ref.paramCount, strings) || changed
            }
            continue
        }

        const valuesAnn = annotations.find(
            (a) => a.type === 'values' && a.ns === ns
        )
        if (valuesAnn) {
            const arr = arrays[valuesAnn.arrayName]
            if (arr) {
                for (const k of arr) {
                    const key = ns + '.' + k
                    changed = updateKey(key, ref.paramCount, strings) || changed
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

    // Handle static keys
    for (const ref of refs) {
        if (ref.isDynamic) continue
        changed = updateKey(ref.key, ref.paramCount, strings) || changed
    }

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
