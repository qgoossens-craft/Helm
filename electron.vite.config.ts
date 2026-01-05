import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

// Copy schema.sql to out/main during build
function copySchemaPlugin() {
  return {
    name: 'copy-schema',
    closeBundle() {
      const outDir = resolve(__dirname, 'out/main')
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true })
      }
      copyFileSync(
        resolve(__dirname, 'electron/database/schema.sql'),
        resolve(outDir, 'schema.sql')
      )
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: [] }), copySchemaPlugin()],
    build: {
      rollupOptions: {
        external: ['electron', 'better-sqlite3'],
        input: {
          index: resolve(__dirname, 'electron/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: [] })],
    build: {
      rollupOptions: {
        external: ['electron'],
        input: {
          index: resolve(__dirname, 'electron/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    }
  }
})
