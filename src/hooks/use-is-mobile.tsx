
"use client";

import * as React from "react";

const MOBILE_BREAKPOINT = 768; // Corresponds to Tailwind's `md` breakpoint

export function useIsMobile() {
  // Use undefined initially to prevent hydration mismatch
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    // Mark as client-side and set initial mobile state
    setIsClient(true);
    
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Set initial state
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Return false during SSR and initial client render to prevent layout shift
  // This ensures consistent behavior between server and client
  return isClient ? (isMobile ?? false) : false;
}
