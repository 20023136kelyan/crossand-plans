'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CameraIcon, ArrowUpTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Plan } from '@/types/plan';
import { useRef, useState } from 'react';

interface PlanPhotoHighlightsProps {
  plan: Plan;
  isCurrentUserParticipant: boolean;
  highlightUploading: boolean;
  onUploadHighlight: (file: File) => Promise<void>;
}

export function PlanPhotoHighlights({
  plan,
  isCurrentUserParticipant,
  highlightUploading,
  onUploadHighlight,
}: PlanPhotoHighlightsProps) {
  const [selectedHighlightFile, setSelectedHighlightFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedHighlightFile(file);
    }
  };

  const handleUploadClick = async () => {
    if (selectedHighlightFile) {
      await onUploadHighlight(selectedHighlightFile);
      setSelectedHighlightFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Photo Highlights */}
      {plan.photoHighlights && plan.photoHighlights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CameraIcon className="h-5 w-5" />
              Photo Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {plan.photoHighlights.map((highlight, index) => (
                <div key={index} className="aspect-square rounded-lg overflow-hidden">
                  <img
                    src={highlight}
                    alt={`Highlight ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-200 cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Highlight (for participants) */}
      {isCurrentUserParticipant && (
        <Card>
          <CardHeader>
            <CardTitle>Share a Photo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                <Button
                  onClick={handleUploadClick}
                  disabled={!selectedHighlightFile || highlightUploading}
                >
                  {highlightUploading ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpTrayIcon className="h-4 w-4" />
                  )}
                  Upload
                </Button>
              </div>
              {selectedHighlightFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedHighlightFile.name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}