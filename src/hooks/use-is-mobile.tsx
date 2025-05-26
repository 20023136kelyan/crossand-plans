
"use client";

import * as React from "react";

const MOBILE_BREAKPOINT = 768; // Corresponds to Tailwind's `md` breakpoint

export function useIsMobile() {
  // Initialize state based on current window width if on client, otherwise default for SSR.
  // The default for SSR doesn't matter much as AppLayout will re-render on client.
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }
    return false; // Default to false for SSR pass, client-side will correct.
  });

  React.useEffect(() => {
    // This effect only runs on the client.
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Ensure the state is correct on mount for client-side rendering
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  return isMobile;
}
