// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Arthanomy is deployed as a GitHub Pages *project site*, so every generated
// asset and internal link must live under the /arthanomy sub-path.
// `SITE_BASE` lets CI or a future custom domain override the base path.
const base = process.env.SITE_BASE ?? '/arthanomy';
const site = process.env.SITE_URL ?? 'https://chirag127.github.io';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [
    mdx(),
    react(),
    sitemap({
      filter: (page) => !page.includes('/draft/'),
    }),
  ],
  markdown: {
    // Astro v7 defaults to the Sätteri processor. remark-math / rehype-katex
    // are part of the unified ecosystem, so the unified processor is used
    // explicitly for both .md and .mdx files. See docs/dependency-decisions.md.
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [
          rehypeKatex,
          {
            strict: false, // do not fail the build on unknown unicode characters
            throwOnError: false, // render errors inline rather than crashing a page
            output: 'htmlAndMathml', // mathml twin keeps the maths screen-reader accessible
          },
        ],
      ],
    }),
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark-dimmed',
      },
      wrap: true,
    },
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Keep charting/animation libs out of the critical path.
      chunkSizeWarningLimit: 900,
    },
    ssr: {
      noExternal: ['@tanstack/react-table'],
    },
  },
  build: {
    inlineStylesheets: 'auto',
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
});
