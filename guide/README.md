# BuildOS guide

This folder holds the source of the BuildOS documentation and the one-file web app built from it. The articles are plain Markdown in `content/`. The app is `BuildOS-Guide.html`. You edit the Markdown, run one command, and the app is rebuilt.

## What is in this folder

| Path | What it is | Who touches it |
| --- | --- | --- |
| `content/` | The 22 articles. This is the only reader-facing text. | Writers |
| `BuildOS-Guide.html` | The built app. One self-contained file. Do not edit it by hand, the next build overwrites it. | Nobody, it is generated |
| `tools/` | The build script, its styles and behaviour, and the vendored Markdown parser. See [tools/README.md](tools/README.md). | Whoever changes the app itself |

## The app

`BuildOS-Guide.html` is the whole guide in one file. It makes no network requests, so it works with no internet, from a file share, from an email attachment, or from a USB stick. Double-click it to open it in any current browser. To share it, send that one file. Nothing else is needed.

What it gives the reader:

- Left: the article list, grouped the same way as the start page.
- Middle: the article, with tables, code blocks with copy buttons, and coloured callout boxes.
- Right: the section list for the open article. It follows the reader as they scroll.
- Search across every article. Press `/` or Ctrl+K (Cmd+K on a Mac) to jump to the box. Arrow keys move through the results, Enter opens one.
- Previous and Next buttons at the end of each article, in file order.
- Light and dark mode. It follows the system setting by default. The button at the top right forces light or dark, and the browser remembers that choice.
- On a phone the left list becomes a slide-out menu.

Every article and every section has its own address, so you can link straight to one:

```text
BuildOS-Guide.html#/02-how-it-works
BuildOS-Guide.html#/02-how-it-works/contracts
```

The first part is the file name without `.md`. The second part is the heading id (see "Heading ids" below).

## Rebuilding the app

Run this from the `guide` folder after any change to `content/`:

```bash
node tools/build-guide.mjs
```

You need Node 18 or newer. Nothing has to be installed, the Markdown parser is vendored in `tools/vendor/`. The build takes under a second and prints one line:

```text
Wrote BuildOS-Guide.html (647 KB) from 22 documents.
```

If it prints warnings under that line, read them. Each one names the article and the problem. The two you will see are:

| Warning says | What it means | What to do |
| --- | --- | --- |
| link to a file outside the guide | A link points at a `.md` file that is not in `content/`. The link was rendered as plain text. | Fix the file name in the link, or add the missing article. |
| points at a heading id that does not exist | A `#section` link names a heading that is not there, usually because the heading was renamed. | Update the link, or restore the heading text. |

A build with warnings still produces a working file. A build with zero warnings is the bar before you share it.

## How the build reads an article

The build script makes a few fixed assumptions about each file. Keep to them and every article renders the same way.

**File name.** `NN-kebab-case-title.md`. The number sets the order in the navigation and in the Previous and Next buttons, and it is shown as a small label next to the title. The file name without `.md` is the article's address in the app, so renaming a file changes every link to it.

**Title.** The first `# Heading` is the article title. It is shown in the navigation, at the top of the page, and in the browser tab. It is removed from the body, so it does not appear twice.

**Lead-in.** A paragraph placed directly after the title is shown in larger, lighter type under the title. If a `##` heading follows the title instead, there is no lead-in.

**Headings.** `##` and `###` headings make up the "On this page" list on the right. Deeper headings render but are not listed.

**Heading ids.** Each heading gets an id made from its text: lowercase, punctuation removed, spaces turned into hyphens. `## The review sweep` becomes `the-review-sweep`. `## Procedure 2 · Activate it` becomes `procedure-2-activate-it`. If the same heading text appears twice in one article, the second one gets `-1` on the end. These ids are what `#section` links and the share addresses use.

**Navigation groups.** The groups in the left list come from `00-start-here.md`, from the `## The articles` section. Each `###` heading there is a group. Each table row under it that links to an article puts that article in the group. An article that is not listed there lands at the top of the list if it sorts before the first listed article, and under a "More" group otherwise. To move an article to another group, move its row on the start page.

**Links between articles.** Three forms work, and they are the only three you need:

```markdown
[How it works](02-how-it-works.md)
[The review sweep](15-working-with-your-agent.md#the-review-sweep)
[playbook](#playbook)
```

The first links to an article. The second links to a section in another article. The third links to a section in the same article. The build turns each one into an in-app link and checks that the target exists.

**Callouts.** A quote that starts one of these ways becomes a coloured box with an icon and a label:

```markdown
> **Watch out.** Something the reader is likely to get wrong.

> **Not available yet.** Something the shipped system does not do today.

> [!NOTE]
> Extra context the reader can skip.

> [!TIP]
> A shortcut or a good habit.
```

`[!IMPORTANT]`, `[!WARNING]` and `[!CAUTION]` also work. The bold opener or the marker is stripped and replaced by the label. A quote that starts any other way renders as a plain quote with a grey bar. Keep the two bold openers spelled exactly as above, with the full stop, or the build will not recognise them.

**Code blocks.** A fenced block renders with a copy button. If you name the language after the opening fence (` ```yaml `, ` ```json `), that name is shown in the corner of the block. Placeholders such as `<path>` are safe inside a fence or inside backticks. Outside of those, angle brackets are read as HTML and the placeholder disappears from the page.

**Tables.** Standard pipe tables render with borders and scroll sideways on narrow screens. Task lists (`- [ ]` and `- [x]`) render as checkboxes.

**Images.** No article uses one today, and the build does not embed image files. If you add an image, the build script needs a change to inline it, or the picture will be missing in the shared file.

## Writing and maintaining the articles

Use these article rules when you write or edit guide content.

**Every article has the same shape.** Title, one sentence saying what the article is for, `## What you need first`, the body, `## What you should have now`, and `## Next` with one link. All 22 articles follow it today, and the "On this page" list makes any deviation obvious.

```markdown
# Article name

One sentence saying what this article is for.

## What you need first

Read [Previous article](NN-previous-article.md) first. This page assumes it.

## First body section

...

## What you should have now

- A checkable thing the reader has produced or learned.

## Next

[Next article](NN-next-article.md).
```

**One paragraph is one line.** Never hard-wrap prose, and never break a line at a sentence. This applies to paragraphs, quotes and list items. Code blocks and tables are unaffected.

**Cross-references are linked names.** Link the article title, never the number, using the link forms shown above.

**Formatting conventions.** Paths and file names in code style, written from the reader's project root. Placeholders in lowercase angle brackets inside code style. Commands in a fenced block with no leading `$`. A defined term in bold on first use, plain after that. No em dashes, no semicolons in prose, straight quotes only.

### Editing an existing article

1. Edit the file in `content/`.
2. If you rename a heading, search for links to its old id: `grep -rn "#old-heading-id" content/`.
3. Rebuild. Fix any warning.
4. Open `BuildOS-Guide.html`, go to the article, and read the changed part on the page.

### Adding an article

1. Take the next free number and name the file `NN-kebab-case-title.md`. If it has to sit between two existing articles, renumber the ones after it and fix every link to them (see below).
2. Write it to the article shape above.
3. Add a row for it to the right group table in `00-start-here.md`. That row is what puts it in the left navigation.
4. Update the `## Next` link of the article before it, and point its own `## Next` at the article after it. The Previous and Next buttons follow file order on their own, but the prose links are part of the article shape.
5. Rebuild and check for warnings.

### Renaming, renumbering or removing an article

The file name is the article's address, so every link to it has to change with it. Find them all with:

```bash
grep -rln "old-file-name.md" content/
```

Update each one, remove or update the row on the start page, rebuild, and confirm the build prints no warnings. A link left behind shows up as the "file outside the guide" warning.

### Keeping "not built yet" honest

Every `> **Not available yet.**` callout points at [What is not built yet](content/18-what-is-not-built-yet.md), and that article is the one complete register. When a capability ships, search for its callouts and the matching entry:

```bash
grep -rn "Not available yet" content/
```

Search the articles for other statements that imply something is missing before you update that register.

### Before you share a new build

- The build printed zero warnings.
- The changed article reads correctly on the page, including any callout, table or code block you touched.
- Search finds a phrase from the new text.
- Dark mode still looks right for anything you styled.
- Send the new `BuildOS-Guide.html`. Readers with an older copy do not update on their own.

## Changing the app itself

The app's look and behaviour live in `tools/`. Rebuild after any change there, the same command picks it up.

- `tools/app.css` holds the styles. The colours are tokens in the block at the top of the file, once for light and twice for dark (one block for the system setting, one for the forced switch). Keep the two dark blocks identical.
- `tools/app.js` holds the navigation, the section list, search, the theme switch and the copy buttons.
- `tools/build-guide.mjs` holds the Markdown rules described above: heading ids, link rewriting, callout detection, and the navigation groups.
- `tools/vendor/marked.mjs` is the Markdown parser (marked, MIT licence). Replace it with a newer copy of `lib/marked.esm.js` from the `marked` package if you ever need to.

## Quick reference

```bash
# Rebuild the app
node tools/build-guide.mjs

# Find every link to one article
grep -rln "05-bring-in-source-material.md" content/

# Find every link to one heading id
grep -rn "#the-review-sweep" content/

# Preview through a local server (only needed for tools that cannot open a file directly)
python3 -m http.server 8765
```
