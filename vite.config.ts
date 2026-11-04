import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig, type Plugin } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Stamps every production build into public/sw.js (copied to dist/client).
 * The service worker puts this id in its cache names and deletes everything
 * from earlier builds on activate, so a release can never serve old assets.
 */
function serviceWorkerBuildId(): Plugin {
  let root = process.cwd()

  return {
    name: 'yuzhou-service-worker-build-id',
    apply: 'build',
    configResolved(config) {
      root = config.root
    },
    closeBundle() {
      const file = resolve(root, 'dist/client/sw.js')
      if (!existsSync(file)) {
        return
      }

      const source = readFileSync(file, 'utf8')
      if (!source.includes('__SW_BUILD_ID__')) {
        return
      }

      const pkg = JSON.parse(
        readFileSync(resolve(root, 'package.json'), 'utf8'),
      ) as { version?: string }
      const buildId = `${pkg.version ?? '0.0.0'}-${Date.now().toString(36)}`

      writeFileSync(file, source.replaceAll('__SW_BUILD_ID__', buildId))
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    serviceWorkerBuildId(),
  ],
})

export default config
