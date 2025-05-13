import type { SVGProps } from 'react';
import Link from 'next/link';

// Simple Placeholder SVG Logo for PlanPal
const PlanPalSvgLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 100 100"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M50 10C27.9086 10 10 27.9086 10 50C10 72.0914 27.9086 90 50 90C72.0914 90 90 72.0914 90 50C90 27.9086 72.0914 10 50 10ZM50 82C32.3269 82 18 67.6731 18 50C18 32.3269 32.3269 18 50 18C67.6731 18 82 32.3269 82 50C82 67.6731 67.6731 82 50 82Z"
      className="text-primary"
    />
    <path
      d="M40 40H60V60H40V40Z"
      className="text-accent"
    />
    <circle cx="30" cy="30" r="5" className="text-secondary" />
    <circle cx="70" cy="30" r="5" className="text-secondary" />
    <circle cx="30" cy="70" r="5" className="text-secondary" />
    <circle cx="70" cy="70" r="5" className="text-secondary" />
  </svg>
);


export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 px-2 py-1">
      <PlanPalSvgLogo className="h-8 w-8 shrink-0" />
      {!collapsed && (
        <h1 className="text-xl font-semibold text-primary truncate">
          PlanPal
        </h1>
      )}
    </Link>
  );
}
