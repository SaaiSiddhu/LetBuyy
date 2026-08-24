// S1/W4 render-parity harness — a minimal, honest stand-in for next/image.
// The real component needs a Next.js image-optimizer/request context this standalone harness does not
// have. This mock renders a plain <img>, passing src/alt through unmodified so the parity comparison
// can still verify image-source semantics; it fabricates no content.
import React from 'react';

export default function Image({ src, alt, fill, sizes, className, unoptimized, ...rest }) {
  return React.createElement('img', { src: typeof src === 'string' ? src : String(src ?? ''), alt: alt ?? '', className, ...rest });
}
