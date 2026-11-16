# Contributing to react-smart-rewrite

Bug reports and pull requests are welcome at https://github.com/SaravananAnbu/react-smart-rewrite. This file covers working on the package itself; for using it, see the [README](./README.md).

## Development

```bash
npm install
npm run build      # ESM + CJS + types into dist/
npm test
npm run typecheck
```

`examples/vite` is a demo form that runs without an API key, using a mock model (plain find-and-replace, labelled as such on the page). It runs the library straight from `src/`, so changes show up without a build.

```bash
npm --prefix examples/vite install
npm --prefix examples/vite run dev     # local preview on port 5189
```

### Landing page

`site/` is a static landing page with a live demo. It runs the library straight from `src/`, so it always matches this repository, and its demo uses the same mock model as the example.

```bash
npm --prefix site install
npm --prefix site run dev     # local preview on port 5191
npm --prefix site run build   # static output in site/dist, deployable to any static host
```

`.github/workflows/pages.yml` publishes it to GitHub Pages on pushes to `main` that touch `site/` or `src/`. Turn Pages on first: repository Settings → Pages → Source: GitHub Actions.

## Notes on the code

- `src/core/field.ts` holds everything that touches a form field: reading the selection, replacing a range, and finding where a character sits on screen. Browsers do not report that position for form fields, so `getCaretRect` lays the text out again in a hidden copy of the field and measures it there.
- The tests run in jsdom, which has no layout and no `insertText` editing command. Positioning and undo are therefore checked by hand in the example.
