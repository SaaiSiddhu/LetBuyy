# Images

Audit date: 29 October 2026, Asia/Kolkata. Status: qualitative; no numeric category score.

Measured: image HTML attributes site-wide, rendered homepage images, and four public image downloads. Modern WebP illustrations, SVG logos, lazy loading and explicit dimensions are present. No image element omitted alt. Decorative empty alt is legitimate. The 512×512 organization PNG is 225,263 bytes, but it is not the same as the header SVG and should not be treated as a large above-fold request without a network trace.

### SEO-11 — Complete social-preview metadata (Low)

**Observed:** Homepage has twitter:card=summary_large_image and twitter:image, but its raw and rendered metadata lack og:image, og:url and og:type. The declared social image is accessible at 1200×630, 52,770 bytes. Organization logo returns 200 at 512×512. All 1,471 img occurrences across English pages have an alt attribute; 1,369 are empty, frequently decorative/repeated UI art. Homepage has 53 img elements with empty alt; empty alt is not automatically an accessibility defect.

**Change:** Add a coherent Open Graph image, final page URL and appropriate type, with descriptive image metadata where useful. Keep empty alt on decorative/redundant illustrations; audit meaningful article/tutorial screenshots for descriptive alternatives. Use responsive variants where originals greatly exceed display size.

**Dependencies:** Existing page metadata utility and canonical URL policy.

**Validation:** Inspect server HTML and a social preview debugger; manually verify representative meaningful images against their context and accessible name.

**Leading indicator:** Intended preview image and canonical URL rendered by preview consumers; meaningful images without alternatives: target 0.

**Failure check:** Failure is decorating every image with repetitive keyword alt text or declaring an inaccessible preview image.
