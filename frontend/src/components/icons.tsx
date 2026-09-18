// Small inline icon set — avoids pulling in an icon library for a handful
// of glyphs. Each is a plain 20x20 stroke icon sized via className.
import type { SVGProps } from "react";

export function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M13.5 3.5l3 3L6 17l-3.5.5L3 14l10.5-10.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m-6.5 0l.6 9.5A1.5 1.5 0 007.6 17h4.8a1.5 1.5 0 001.5-1.5L14.5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M13 7V4.5A1.5 1.5 0 0011.5 3h-7A1.5 1.5 0 003 4.5v7A1.5 1.5 0 004.5 13H7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path
        d="M5 8a5 5 0 0110 0c0 3.5 1 4.5 1.5 5.5H3.5C4 12.5 5 11.5 5 8z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.3 16a1.8 1.8 0 003.4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
