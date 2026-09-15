import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
    const posts = (await getCollection('blog'))
        .filter(
            (post) =>
                post.data.lang === 'ko' &&
                !post.data.draft
        )
        .sort(
            (a, b) =>
                b.data.pubDate.getTime() -
                a.data.pubDate.getTime()
        )
        .slice(0, 20);

    return rss({
        title: 'KJH Dev',
        description: '개발 경험과 기술을 기록하는 개발 블로그입니다.',
        site: context.site,

        items: posts.map((post) => {
            const slug = post.id.split('/').pop();

            return {
                title: post.data.title,
                description: post.data.description,
                pubDate: post.data.pubDate,
                link: `/ko/posts/${slug}/`,
            };
        }),

        customData: '<language>ko-KR</language>',
    });
}