// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server', // Válido y tipado en Astro v7
  adapter: node({
    mode: 'middleware',
  }),
  i18n: {
    defaultLocale: 'en',       
    locales: ['es', 'en'],    
    routing: {
      prefixDefaultLocale: false
    }
  },
  site: 'https://kengv.dev'
});