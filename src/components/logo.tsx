import type { SVGProps } from 'react';
import Link from 'next/link';

// Modernized SVG Logo for PlanPal
const PlanPalSvgLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect width="100" height="100" rx="24" className="fill-primary/10" />
    <path
      d="M30 40C30 34.4772 34.4772 30 40 30H60C65.5228 30 70 34.4772 70 40V60C70 65.5228 65.5228 70 60 70H40C34.4772 70 30 65.5228 30 60V40Z"
      className="fill-primary"
    />
    <path
      d="M45 45L55 55M55 45L45 55"
      stroke="white"
      strokeWidth="6"
      strokeLinecap="round"
    />
    <circle cx="75" cy="25" r="8" className="fill-accent animate-pulse" />
  </svg>
);


export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 px-2 py-1 hover:opacity-90 transition-opacity">
      <PlanPalSvgLogo className="h-9 w-9 shrink-0 shadow-lg rounded-xl" />
      {!collapsed && (
        <h1 className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          PlanPal
        </h1>
      )}
    </Link>
  );
}
