'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Download, Share2, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Plan } from '@/types/user';

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
  planUrl: string;
}

export function QRCodeDialog({
  open,
  onOpenChange,
  plan,
  planUrl,
}: QRCodeDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Generate QR code URL using a service like qr-server.com
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(planUrl)}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(planUrl);
      toast.success('Plan URL copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error('Failed to copy URL');
    }
  };

  const handleDownloadQR = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${plan.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_qr_code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
      toast.success('QR code downloaded!');
    } catch (error) {
      console.error('Failed to download QR code:', error);
      toast.error('Failed to download QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: plan.name,
          text: `Check out this plan: ${plan.name}`,
          url: planUrl,
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error sharing:', error);
          toast.error('Failed to share');
        }
      }
    } else {
      // Fallback to copying URL
      handleCopyUrl();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code
          </DialogTitle>
          <DialogDescription>
            Scan this QR code to quickly access "{plan.name}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* QR Code Display */}
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg border border-border shadow-sm">
              <img
                src={qrCodeUrl}
                alt={`QR code for ${plan.name}`}
                className="w-64 h-64 object-contain"
                loading="lazy"
              />
            </div>
          </div>
          
          {/* Plan Info */}
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-foreground">{plan.name}</h3>
            <p className="text-sm text-muted-foreground">
              {plan.location} • {plan.eventType}
            </p>
            <div className="bg-muted/50 rounded-md p-2 text-xs text-muted-foreground font-mono break-all">
              {planUrl}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyUrl}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy URL
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadQR}
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {isGenerating ? 'Downloading...' : 'Download'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
          
          <div className="text-xs text-center text-muted-foreground">
            Anyone with this QR code can view your plan
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}