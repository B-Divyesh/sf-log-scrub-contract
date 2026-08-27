# Visual thesis — the redaction field notebook

## Direction and rationale

Log Scrub Contract looks like a security engineer's handwritten lab notebook: a
place where dangerous samples are boxed, struck through, and initialled before
they can leave the bench. This makes the product's promise tangible. The
landing page is not a glossy security dashboard; it is a calm, inspectable
working document with graph-paper rules, ink annotations, numbered specimens,
and opaque redaction bars.

The notebook treatment is deliberately single-mode. Warm paper is the product
surface and near-black ink is the working medium. Painting that background
explicitly keeps the identity intact and avoids a second theme that would turn
the metaphor into generic chrome.

## Palette

All colours are encoded as CSS custom properties.

- `paper #F4EEDC` — aged lab stock and the page background.
- `paper-raised #FFFBEF` — clean pasted-in samples.
- `ink #1D2523` — fountain-pen copy (12.6:1 on paper).
- `ink-muted #56605C` — annotations (6.1:1 on paper).
- `rule #B8B29F` — graph and divider lines; never used as the only signal.
- `oxide #A63D2F` — editorial marks, focus, and danger (5.1:1 on paper).
- `oxide-dark #7C2A20` — active controls.
- `pine #245C4A` — verified state (6.5:1 on paper).
- `amber #805500` — caution copy (5.5:1 on paper).
- `redaction #151918` — irreversible scrub bars.

## Type and spacing

- Interface/body: the local system sans stack, chosen for small payloads and
  reliable rendering in terminals and browsers.
- Notes/headings: `Segoe Print`, `Bradley Hand`, `Comic Sans MS`, cursive as a
  system-only handwritten accent. It is restricted to large headings and
  annotations so legibility never depends on it.
- Code: the local system monospace stack with tabular figures.
- Scale: 16, 18, 22, 30, and clamp(40–72) px, with body leading at 1.6.
- Spacing follows an 8 px rhythm: 8, 16, 24, 32, 48, 64, 96. A 4 px half-step
  is reserved for tight labels and underlines.
- Reading measure is capped at 68 characters. Sections align to a 12-column
  page grid on desktop and a single stack at 390 px.

## Interaction grammar

- Primary actions resemble clipped specimen labels: square-ish paper controls
  with an offset ink shadow and a 2 px border.
- Hover/press moves the label by at most 2 px as if pressing paper against a
  desk. Focus uses a 3 px oxide outline with a 3 px offset.
- Results arrive as a marked test sheet. Status always includes a word and
  symbol, never colour alone.
- The demo is keyboard-first: labelled editors, a clear Run contract action,
  and an `aria-live` result. On phones the comparison becomes a vertical
  before/after stack and secondary ornament is dropped.

## Motion policy

One 220 ms paper-lift transition is used on interactive labels, using only
`transform` and `opacity`. The hero's annotation enters once with a 300 ms
opacity/translate reveal. Nothing loops. Under `prefers-reduced-motion`, all
transforms and smooth scrolling are removed and state changes are instant.

## Original asset plan and provenance

- Hero: an original raster illustration of a top-down graph-paper log specimen
  being irreversibly redacted with black ink and audit ticks. Generated for
  this product with the factory `factory-image` deployment, then locally
  converted to WebP at ≤300 KB. No logos, legible generated text, or third-party
  source material. Final prompt and generator sidecar are stored with the
  asset.
- Icons and marks: simple braces, check marks, arrows, tape, and redaction bars
  drawn directly with CSS/HTML. They are functional marks rather than an icon
  library.

## Accessibility and performance guardrails

The warm single-mode palette is checked at 4.5:1 for normal text. Every target
is at least 44 px, focus is never suppressed, and handwriting is decorative or
large only. The hero has explicit dimensions and responsive sources, with a
mobile crop below 300 KB. Initial JavaScript stays below 200 KB and CSS below
50 KB; the page uses no webfont or third-party runtime request.
