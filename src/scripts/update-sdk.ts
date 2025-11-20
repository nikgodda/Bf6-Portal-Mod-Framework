import fs from 'fs'
import path from 'path'
import https from 'https'

const PROJECT_ROOT = process.cwd()
const SDK_ROOT = path.join(PROJECT_ROOT, 'SDK')

const FILES = [
    {
        url: 'https://raw.githubusercontent.com/battlefield-portal-community/OfficailPortalSDK/main/code/mod/index.d.ts',
        local: path.join(SDK_ROOT, 'mod/index.d.ts'),
    },
    {
        url: 'https://raw.githubusercontent.com/battlefield-portal-community/OfficailPortalSDK/main/code/modlib/index.ts',
        local: path.join(SDK_ROOT, 'modlib/index.ts'),
    },
]

function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(dest)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

        const file = fs.createWriteStream(dest)

        https
            .get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode} for ${url}`))
                    return
                }

                response.pipe(file)

                file.on('finish', () => {
                    file.close() // No callback allowed here
                    resolve()
                })
            })
            .on('error', (err) => reject(err))
    })
}

async function updateSDK() {
    console.log('Updating SDK...')
    for (const file of FILES) await downloadFile(file.url, file.local)
    console.log('SDK updated')
}

updateSDK()
