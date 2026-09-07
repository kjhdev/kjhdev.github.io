import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://kjhdev.github.io',

  integrations: [
    sitemap({
      filter: (page) => page !== 'https://kjhdev.github.io/',
    }),
  ],
});