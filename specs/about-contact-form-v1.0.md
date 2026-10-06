# About page contact form — v1.0

## Goal

Let visitors send feedback or a message from `/about/`, using the same Web3Forms
endpoint and access key as the contact form in `public/softservices.html`.
Only the ability to send a message moves over. The source page's text, purpose and
Bootstrap/jQuery markup do not.

`public/softservices.html` is a frozen passthrough: it stays exactly as it is.

## Changes

1. **`src/components/ContactForm.astro`** (new): a vanilla Astro component with plain scoped CSS.
    - The form POSTs to `https://api.web3forms.com/submit` with the hidden `access_key`, a `subject`
      ("New message from vgerman256.github.io") and the hidden `botcheck` honeypot.
    - Fields have visible labels: name (optional), email (optional, used for a reply),
      message (required).
    - The script sends the form with `fetch` and shows a status line (`aria-live="polite"`):
      "Sending…", then thanks on success or an error with a LinkedIn fallback on failure.
      The button is disabled while sending. The form is cleared only on success.
    - Without JS, the form still posts normally (Web3Forms shows its own result page).
    - Styling uses the tokens in `global.css` (`--border`, `--accent`, `--muted`, fonts) and
      works in light and dark themes.
2. **`src/pages/about.astro`**: render `<ContactForm />` after the markdown content, as its own
   section with a hairline above it.
3. **`src/content/about.md`**: the "Let's talk" paragraph points to the form at the bottom of the page.
4. **`CLAUDE.md`**: add `ContactForm` to the components list.

## Out of scope

- No changes to `public/softservices.html`, and no link to it.
- No language switcher (the site is English-only).

## v1.1 addendum: Home link

`src/pages/about.astro` ends with a `← Home` link to `/`, below the contact form. It is styled like the
`← All posts` link at the end of posts (`PostLayout.astro`): a mono, muted link with a hairline above it.
