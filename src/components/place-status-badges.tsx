"use client";

import { Badge } from "@/components/ui/badge";
import { Check, X, MapPin, AlertCircle } from "lucide-react";

interface PlaceStatusBadgesProps {
  businessStatus?: string | null;
  city?: string | null;
}

export function PlaceStatusBadges({ businessStatus, city }: PlaceStatusBadgesProps) {
  const getStatusDisplay = () => {
    if (!businessStatus) return null;

    let variant: "default" | "destructive" | "secondary";
    let icon;
    let text;

    switch (businessStatus.toUpperCase()) {
      case 'OPERATIONAL':
        variant = "default";
        icon = <Check className="h-3 w-3 mr-1" />;
        text = 'Open';
        break;
      case 'CLOSED_TEMPORARILY':
        variant = "destructive";
        icon = <X className="h-3 w-3 mr-1" />;
        text = 'Temporarily Closed';
        break;
      case 'CLOSED_PERMANENTLY':
        variant = "destructive";
        icon = <X className="h-3 w-3 mr-1" />;
        text = 'Permanently Closed';
        break;
      default:
        variant = "secondary";
        icon = <AlertCircle className="h-3 w-3 mr-1" />;
        text = 'Status Unknown';
    }

    return (
      <Badge variant={variant} className="mr-2">
        {icon}{text}
      </Badge>
    );
  };

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {getStatusDisplay()}
      {city && (
        <Badge variant="outline">
          <MapPin className="h-3 w-3 mr-1" />
          {city}
        </Badge>
      )}
    </div>
  );
} 