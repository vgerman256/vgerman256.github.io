// Names of the drawings in src/components/PostIcon.astro; shared with the posts schema.
export const iconNames = ['chess', 'abc', 'math', 'terminal'] as const;

export type IconName = (typeof iconNames)[number];
