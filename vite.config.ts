import type { Plugin } from 'vite'
import { execSync } from 'node:child_process'
import { Agent as HttpAgent } from 'node:http'
import { Agent as HttpsAgent } from 'node:https'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import vueDevTools from 'vite-plugin-vue-devtools'

const require = createRequire(import.meta.url)
const fs = require('node:fs')
const archiver = require('archiver')

interface ThemeManifest {
  preview?: unknown
  version?: unknown
}

const themeJsonPath = resolve(__dirname, 'komari-theme.json')
const devApiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:25774'
const devApiIsHttps = devApiTarget.startsWith('https:')
const devProxyAgent = devApiIsHttps
  ? new HttpsAgent({ keepAlive: true, maxSockets: 8 })
  : new HttpAgent({ keepAlive: true, maxSockets: 8 })

function komariDevProxy(ws = false) {
  return {
    target: devApiTarget,
    changeOrigin: true,
    secure: devApiIsHttps,
    agent: devProxyAgent,
    timeout: 60_000,
    proxyTimeout: 60_000,
    headers: { Origin: devApiTarget },
    rewriteWsOrigin: true,
    ...(ws ? { ws: true } : {}),
  }
}

function disableKomariPwaInDev(): Plugin {
  return {
    name: 'disable-komari-pwa-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0]
        if (path !== '/registerSW.js') {
          next()
          return
        }

        res.setHeader('Content-Type', 'application/javascript')
        res.end('/* theme dev: do not install Komari admin service worker */')
      })
    },
  }
}

function readThemeManifest(): ThemeManifest {
  if (!existsSync(themeJsonPath))
    throw new Error('komari-theme.json not found')

  return JSON.parse(readFileSync(themeJsonPath, 'utf-8')) as ThemeManifest
}

function getThemeVersion(): string {
  const version = readThemeManifest().version

  if (typeof version !== 'string' || !version.trim())
    throw new TypeError('komari-theme.json does not contain a top-level string version field')

  return version.trim()
}

function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  }
  catch {
    return 'unknown'
  }
}

/**
 * Vite 插件：构建后打包 Komari 主题 Zip
 * theme.zip
 * ├── komari-theme.json
 * ├── preview.png
 * └── dist/
 */
function komariThemeZip(): Plugin {
  return {
    name: 'komari-theme-zip',
    apply: 'build',
    closeBundle: async () => {
      const commitHash = getCommitHash()
      const zipFileName = `komari-theme-Glassmorphism-build-${commitHash}.zip`
      const distDir = resolve(__dirname, 'dist')
      const previewPath = resolve(__dirname, 'docs/preview.png')
      const outputPath = resolve(__dirname, zipFileName)
      const themeManifest = readThemeManifest()
      const manifestPreviewName = typeof themeManifest.preview === 'string' && themeManifest.preview.trim()
        ? themeManifest.preview.trim()
        : 'preview.png'

      if (!existsSync(distDir)) {
        console.log('[komari-theme-zip] dist directory not found, skipping zip creation')
        return
      }

      const output = fs.createWriteStream(outputPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      return new Promise((resolve, reject) => {
        output.on('close', () => {
          const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2)
          console.log(`[komari-theme-zip] Created ${zipFileName} (${sizeMB} MB)`)
          resolve(undefined)
        })

        archive.on('error', (err: Error) => {
          console.error('[komari-theme-zip] Error:', err)
          reject(err)
        })

        archive.pipe(output)

        archive.file(themeJsonPath, { name: 'komari-theme.json' })

        if (existsSync(previewPath)) {
          archive.file(previewPath, { name: 'preview.png' })
          if (manifestPreviewName !== 'preview.png') {
            archive.file(previewPath, { name: manifestPreviewName })
          }
        }

        // Komari 1.5+ always serves /admin and /terminal from its built-in
        // frontend. Do not ship the legacy embedded admin bridge: otherwise
        // direct /admin-app access or stale links can reopen the old console.
        archive.glob('**/*', {
          cwd: distDir,
          ignore: ['admin-app/**'],
        }, { prefix: 'dist' })

        archive.finalize()
      })
    },
  }
}

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(getThemeVersion()),
    __BUILD_GIT_HASH__: JSON.stringify(getCommitHash()),
  },
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    disableKomariPwaInDev(),
    komariThemeZip(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': komariDevProxy(true),
      '/themes': komariDevProxy(),
      // Komari 1.5 admin HTML lives on /admin, but its JS/CSS are rooted at /assets.
      '/admin': komariDevProxy(true),
      '/terminal': komariDevProxy(true),
      '/assets': komariDevProxy(),
      '/manifest.webmanifest': komariDevProxy(),
    },
  },
  build: {
    target: ['es2018', 'safari15.4'],
    cssTarget: 'safari15.4',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'echarts': ['echarts', 'vue-echarts'],
          'globe': ['globe.gl', 'three'],
          'reka-ui': ['reka-ui'],
          'vueuse': ['@vueuse/core'],
          'v3-services': [
            './src/services/history.service.ts',
            './src/services/metrics.service.ts',
            './src/services/request.service.ts',
            './src/services/cache.service.ts',
            './src/utils/osImageHelper.ts',
            './src/utils/metricSeries.ts',
            './src/composables/useNodePingDisplay.ts',
          ],
        },
      },
    },
  },
})
