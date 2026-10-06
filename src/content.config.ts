import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { iconNames } from './lib/icons';

const posts = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
    schema: ({ image }) => z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        draft: z.boolean().default(false),
        tags: z.array(z.string()).default([]),
        slug: z.string().optional(),
        // Path relative to the post file, e.g. ../../assets/screenshots/foo.png (optimized at build time).
        heroImage: image().optional(),
        projectUrl: z.string().optional(),
        // Text of the play card shown at the end of the post when projectUrl is set.
        projectLabel: z.string().optional(),
        // Drawing from src/components/PostIcon.astro, shown in the post list and on the play card.
        icon: z.enum(iconNames).optional(),
    }),
});

export const collections = { posts };
