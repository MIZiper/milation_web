import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  // Allows deploying under a subfolder (e.g. GitHub Pages project sites).
  // The CI workflow exports VITE_PUBLIC_PATH=/<repo>/; locally it defaults to '/'.
  base: process.env.VITE_PUBLIC_PATH || '/',
  plugins: [svelte()],
})
