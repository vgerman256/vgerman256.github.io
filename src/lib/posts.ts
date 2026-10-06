import { getCollection } from 'astro:content';

// Posts newest first, drafts hidden in production. Shared by the home page and the post pages,
// so the newer/older links at the end of each post follow the same order as the home list.
export async function getSortedPosts() {
    const posts = await getCollection('posts', ({ data }) => (import.meta.env.PROD ? !data.draft : true));
    return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function postHref(post: { id: string; data: { slug?: string } }) {
    return `/posts/${post.data.slug ?? post.id}/`;
}
