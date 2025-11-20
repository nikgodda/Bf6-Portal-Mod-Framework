import fs from 'fs'
import path from 'path'
import https from 'https'

const FILES = [
    {
        url: 'https://raw.githubusercontent.com/battlefield-portal-community/OfficailPortalSDK/main/code/mod/index.d.ts',
        local: 'SDK/mod/index.d.ts',
    },
    {
        url: 'https://raw.githubusercontent.com/battlefield-portal-community/OfficailPortalSDK/main/code/modlib/index.ts',
        local: 'SDK/modlib/index.ts',
    },
]

function downloadFile(url: string, dest: string) {
    return new Promise<void>((resolve, reject) => {
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
                    file.close(() => {
                        console.log('Updated:', dest)
                        resolve()
                    })
                })
            })
            .on('error', reject)
    })
}

async function updateSDK() {
    console.log('Updating BF6 Portal SDK...\n')

    for (const f of FILES) {
        try {
            await downloadFile(f.url, f.local)
        } catch (err: any) {
            console.error('Failed:', f.local, err.message)
        }
    }

    console.log('\nSDK update complete.')
}

updateSDK()
