import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    solid(),
    tailwindcss()
  ],
  build: {
    lib: {
      entry: './src/index.ts',
      formats: ['es']
    },
    rollupOptions: {
      external: ['solid-js', 'solid-js/web', 'solid-js/store']
    }
  }
})