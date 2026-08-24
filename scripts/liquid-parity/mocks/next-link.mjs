// S1/W4 render-parity harness — a minimal, honest stand-in for next/link.
// Renders a plain <a href>, passing href/children through unmodified.
import React from 'react';

export default function Link({ href, children, className, ...rest }) {
  return React.createElement('a', { href: typeof href === 'string' ? href : String(href ?? ''), className, ...rest }, children);
}
