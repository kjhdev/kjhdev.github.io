import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/blog',
  }),

  schema: z.object({
    title: z.string(),
    description: z.string(),

    lang: z.enum(['ko', 'en']),

    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),

    // 카테고리는 게시글에서 자유롭게 지정한다.
    // 실제 카테고리 목록/페이지는 등록된 게시글을 기준으로 자동 생성된다.
    category: z.string().trim().min(1).optional(),
    tags: z.array(z.string()).default([]),

    draft: z.boolean().default(false),
  }),
});

export const collections = {
  blog,
};
