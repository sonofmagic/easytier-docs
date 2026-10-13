# Documentation workspace

This is a static Nimbus + Astro documentation site. Run commands in this workspace; install dependencies from the monorepo root after `corepack enable`.

- Content lives in `src/content/docs/` and uses Chinese single-language root routes. Keep the existing routes and heading anchors stable. `src/data/course.ts` supplies the course order and navigation.
- Layouts and components are project-owned. Keep modules small. Put styles in `src/styles/` so Stylelint checks every authored style.
- Register MDX components in `src/components.ts`. Add a text conversion in `astro.config.ts` when a custom component conveys information that would otherwise disappear from Markdown.
- Set the canonical `site` URL and project title in `astro.config.ts` before deployment. Static output is `dist/` and can be hosted anywhere.
- Run `pnpm build`, `pnpm lint`, and `pnpm typecheck`. `typecheck` combines Astro diagnostics with TypeScript checks. Search uses the production Pagefind index; verify it with `pnpm preview` after building.
- Verify `/llms.txt`, section llms indexes, `/llms-full.txt`, and each page's `/index.md` and `/index.mdx`. Keep private content outside public content collections; `noindex` is not access control.
- `draft: true` excludes unfinished pages from production. When adding a page, update the course manifest and its source/link/navigation checks; this site has no language switch.
- Keep `nimbus.json` and `UPSTREAM.md` when upgrading. Review Nimbus migrations and project-owned changes before advancing the reviewed version.
