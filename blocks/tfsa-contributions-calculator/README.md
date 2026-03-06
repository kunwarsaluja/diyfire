# TFSA Contributions Calculator

Client-side block to estimate TFSA contribution room, over-contribution, and 1% per month penalty. Uses CRA-aligned logic; no network calls or storage.

## Authoring

### Block table (EDS sheet / Google Doc)

In a section, add a block table with one cell:

| tfsa-contributions-calculator |
| --- |

### Minimal div markup (e.g. for fragments or custom HTML)

```html
<div class="tfsa-contributions-calculator"></div>
```

The block builds all form and output DOM in JavaScript; no authored table body is required.

## Local test content

- **Draft page:** `drafts/tfsa-contributions-calculator.plain.html`
- **Preview:** Run `aem up --html-folder drafts` then open `http://localhost:3000/drafts/tfsa-contributions-calculator`

## Registration

No changes to `scripts/scripts.js` or `scripts/ak.js` are required. Blocks are loaded by name from `blocks/<name>/<name>.js` when a section contains a div with that class.
