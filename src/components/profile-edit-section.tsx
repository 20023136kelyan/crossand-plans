
"use client";

import { useState, useEffect } from "react";
import type { UserProfile } from "@/types";
import { ProfileForm } from "@/components/profile-form";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { useRouter } from "next/navigation";

interface ProfileEditSectionProps {
  initialProfile: UserProfile;
}

export function ProfileEditSection({ initialProfile }: ProfileEditSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  // currentProfile state is primarily for passing to the form.
  // The source of truth for display is initialProfile which comes from server after refresh.
  const [currentProfile, setCurrentProfile] = useState<UserProfile>(initialProfile);
  const router = useRouter();

  useEffect(() => {
    // When initialProfile prop changes (e.g., due to router.refresh()),
    // and we are NOT in editing mode, update currentProfile.
    // If we ARE in editing mode, the form holds the latest state until save/cancel.
    if (!isEditing) {
      setCurrentProfile(initialProfile);
    }
  }, [initialProfile, isEditing]);

  const handleEditClick = () => {
    // When starting to edit, ensure the form gets the most up-to-date initialProfile data
    setCurrentProfile(initialProfile); 
    setIsEditing(true);
  };

  const handleSaveSuccess = (updatedProfile: UserProfile) => {
    // The ProfileForm itself handles calling form.reset with the updatedProfile.
    // Here, we just need to exit editing mode.
    setIsEditing(false);
    // Trigger a server-side re-fetch and re-render of the ProfilePage.
    // This will provide a new `initialProfile` prop to this component.
    router.refresh(); 
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset currentProfile to the initialProfile that was active when editing started,
    // or rely on useEffect to update it based on the (potentially unchanged) initialProfile prop.
    // Setting it here ensures the form doesn't briefly show stale data if initialProfile hasn't updated yet.
    setCurrentProfile(initialProfile); 
  };

  if (!isEditing) {
    return (
      <div className="flex justify-center py-4 mt-4 border-t"> {/* Added margin-top and border-top for separation */}
        <Button onClick={handleEditClick} size="lg" variant="default">
          <Edit className="mr-2 h-5 w-5" /> Edit Profile
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6"> {/* Add margin when form is visible */}
      <ProfileForm
        profile={currentProfile} // Pass the state that's synced with initialProfile or live form data
        onSaveSuccess={handleSaveSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}
