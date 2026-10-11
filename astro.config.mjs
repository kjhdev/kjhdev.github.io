import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://kjhdev.github.io',
  integrations: [
    sitemap({
      // 본문과 주요 허브 페이지만 sitemap에 포함한다.
      // 중복·단순 목록용 보조 아카이브는 검색 대상에서 제외한다.
      filter: (page) => {
        const path = new URL(page).pathname;
        if (/^\/(ko|en)\/categories(?:\/|$)/.test(path)) return false;
        if (/^\/(ko|en)\/notes\/[^/]+\/?$/.test(path)) return false;
        return true;
      },
    }),
  ],
});
