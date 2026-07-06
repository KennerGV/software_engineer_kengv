// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  i18n: {
    defaultLocale: 'en',       
    locales: ['es', 'en'],    
    routing: {
      prefixDefaultLocale: false
    }
  },
  site: 'https://kengv-software-engineer.web.app'
  //site: 'https://KennerGV.github.io',   
  //base: '/software_engineer_kengv',
});
