import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
    const posts = (await getCollection('blog'))
        .filter(
            (post) =>
                post.data.lang === 'en' &&
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
        description: 'A development blog about programming, troubleshooting, and software development.',
        site: context.site,

        items: posts.map((post) => {
            const slug = post.id.split('/').pop();

            return {
                title: post.data.title,
                description: post.data.description,
                pubDate: post.data.pubDate,
                link: `/en/posts/${slug}/`,
            };
        }),

        customData: '<language>en-US</language>',
    });
}