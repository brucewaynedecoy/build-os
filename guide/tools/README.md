# Guide build tool

`BuildOS-Guide.html` in the folder above is one self-contained file built from `../content/*.md`. It needs no server and no internet. Open it in any browser, or send it to someone.

## Rebuild after the content changes

```bash
node tools/build-guide.mjs
```

Run that from the `guide` folder. Node 18 or newer is enough. Nothing has to be installed: the markdown parser (`marked`, MIT) is vendored in `vendor/`.

## What the build does

- Reads every `content/*.md` in file-name order. The first `# Heading` becomes the page title. A paragraph right after it becomes the lead-in text.
- Groups the left navigation from the `## The articles` section of the start page. A document not listed there lands at the top (before the groups) or under "More".
- Rewrites links between documents (`02-how-it-works.md`, `...md#section`, `#section`) to in-app links. It warns when a link points at a missing document or heading.
- Turns `> [!NOTE]` / `> [!TIP]` and `> **Watch out.**` / `> **Not available yet.**` quotes into styled callouts.

## Files

- `build-guide.mjs`: the build script.
- `app.css`: the styles. Colors live in the token block at the top, once for light and once for dark.
- `app.js`: navigation, page outline, search, theme switch, copy buttons.
- `vendor/marked.mjs`: the markdown parser.
