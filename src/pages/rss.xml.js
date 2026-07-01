import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
    const posts = await getCollection('posts', ({ data }) => !data.draft);
    const sorted = posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
    return rss({
        title: 'Vitaly German',
        description: 'Pet projects, write-ups, and notes from a software engineer in Szczecin, Poland.',
        site: context.site,
        items: sorted.map((post) => ({
            title: post.data.title,
            description: post.data.description,
            pubDate: post.data.pubDate,
            link: `/posts/${post.data.slug ?? post.id}/`,
        })),
    });
}
