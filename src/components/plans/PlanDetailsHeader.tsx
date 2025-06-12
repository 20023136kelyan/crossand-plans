'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CalendarDays,
  MapPin,
  Copy,
  Share2,
  LinkIcon,
  QrCode,
  Users,
  MessageSquare,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Plan } from '@/types/plan';
import { User } from 'firebase/auth';

interface VerificationBadgeProps {
  role: string | null;
  isVerified: boolean;
}

const VerificationBadge = ({ role, isVerified }: VerificationBadgeProps) => {
  if (!isVerified) return null;
  return (
    <Badge variant="secondary" className="text-xs">
      ✓ Verified
    </Badge>
  );
};

interface PlanDetailsHeaderProps {
  plan: Plan;
  currentUser: User | null;
  clientFormattedEventDateTime: string;
  isHost: boolean;
  copyLoading: boolean;
  onCopyToMyPlans: () => void;
  onSharePlanLink: () => void;
  onOpenQRCodeDialog: () => void;
  onShowFriendPicker: () => void;
  onShowShareToFeedDialog: () => void;
  onDeletePlanRequest: () => void;
}

const firestoreStatusDisplayConfig = {
  draft: { label: 'Draft', badgeVariant: 'secondary' as const },
  published: { label: 'Published', badgeVariant: 'default' as const },
  archived: { label: 'Archived', badgeVariant: 'outline' as const },
  completed: { label: 'Completed', badgeVariant: 'default' as const },
  cancelled: { label: 'Cancelled', badgeVariant: 'destructive' as const },
};

export function PlanDetailsHeader({
  plan,
  currentUser,
  clientFormattedEventDateTime,
  isHost,
  copyLoading,
  onCopyToMyPlans,
  onSharePlanLink,
  onOpenQRCodeDialog,
  onShowFriendPicker,
  onShowShareToFeedDialog,
  onDeletePlanRequest,
}: PlanDetailsHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex justify-start">
      <Badge
        variant={
          firestoreStatusDisplayConfig[plan.status as keyof typeof firestoreStatusDisplayConfig]
            ?.badgeVariant || 'secondary'
        }
      >
        {firestoreStatusDisplayConfig[plan.status as keyof typeof firestoreStatusDisplayConfig]
          ?.label || plan.status}
      </Badge>
    </div>
  );
}