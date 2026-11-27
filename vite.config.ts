// Desarrollo y build del front junto con el Worker. Los tests usan vitest.config.ts, que no pasa por acá.
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [react(), tailwindcss(), cloudflare()] })
