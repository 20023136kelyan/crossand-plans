
"use client";

import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Slider } from './ui/slider';
import { CropIcon, RotateCcwIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react';

interface ImageCropperDialogProps {
  imageSrc: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCropConfirm: (croppedImageDataUrl: string) => void;
  aspect?: number; // e.g., 1 for square, 16/9 for landscape
}

// Helper function to generate a data URL from a canvas
function canvasToDataURL(canvas: HTMLCanvasElement, MimeType = 'image/png', quality = 0.9) {
  return canvas.toDataURL(MimeType, quality);
}


export function ImageCropperDialog({
  imageSrc,
  open,
  onOpenChange,
  onCropConfirm,
  aspect = 1, // Default to square aspect ratio
}: ImageCropperDialogProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);

  useEffect(() => {
    // Reset states when dialog opens with a new image
    if (open && imageSrc) {
      setScale(1);
      setRotate(0);
      setCrop(undefined); // Reset crop so it recalculates on image load
      setCompletedCrop(undefined);
    }
  }, [open, imageSrc]);


  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (aspect) {
      const { width, height } = e.currentTarget;
      const initialCrop = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 90, // Initial crop width (e.g., 90%)
          },
          aspect,
          width,
          height
        ),
        width,
        height
      );
      setCrop(initialCrop);
      // Also set completedCrop initially so the preview shows up
      // This will be approximate until user interaction if any
       setCompletedCrop({
        ...initialCrop,
        unit: 'px',
        x: (initialCrop.x / 100) * width,
        y: (initialCrop.y / 100) * height,
        width: (initialCrop.width / 100) * width,
        height: (initialCrop.height / 100) * height,
      });
    }
  }

  useEffect(() => {
    if (
      completedCrop?.width &&
      completedCrop?.height &&
      imgRef.current &&
      previewCanvasRef.current
    ) {
      const image = imgRef.current;
      const canvas = previewCanvasRef.current;
      const cropData = completedCrop;

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('Failed to get 2d context');
        return;
      }

      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(cropData.width * scaleX * pixelRatio);
      canvas.height = Math.floor(cropData.height * scaleY * pixelRatio);

      ctx.scale(pixelRatio, pixelRatio);
      ctx.imageSmoothingQuality = 'high';

      const centerX = image.naturalWidth / 2;
      const centerY = image.naturalHeight / 2;
      
      ctx.translate(canvas.width / (2 * pixelRatio) , canvas.height / (2 * pixelRatio));
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.translate(-canvas.width / (2* pixelRatio) , -canvas.height / (2* pixelRatio));


      ctx.drawImage(
        image,
        cropData.x * scaleX,
        cropData.y * scaleY,
        cropData.width * scaleX,
        cropData.height * scaleY,
        0,
        0,
        cropData.width * scaleX,
        cropData.height * scaleY
      );
    }
  }, [completedCrop, rotate, scale]); // Rerun when scale or rotate changes too for preview


  const handleCropConfirm = async () => {
    if (!previewCanvasRef.current) {
      console.error('Crop canvas does not exist');
      return;
    }
    const dataUrl = canvasToDataURL(previewCanvasRef.current);
    onCropConfirm(dataUrl);
  };

  if (!imageSrc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[calc(100vw-2rem)] md:max-w-xl lg:max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2"><CropIcon className="h-5 w-5" /> Crop Your Image</DialogTitle>
          <DialogDescription>
            Adjust the selection to crop your avatar. You can also zoom and rotate.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 flex-grow overflow-y-auto">
          <div className="space-y-4">
            <div className="flex justify-center bg-muted/30 p-2 rounded-md max-h-[400px] overflow-hidden">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspect}
                minHeight={50}
                minWidth={50}
                circularCrop={false} // Keep it square for typical avatar data
              >
                <img
                  ref={imgRef}
                  alt="Crop me"
                  src={imageSrc}
                  style={{ transform: `scale(${scale}) rotate(${rotate}deg)`, maxHeight: '380px', objectFit: 'contain' }}
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                <ZoomOutIcon className="h-5 w-5 text-muted-foreground" />
                <Slider
                  id="scale"
                  min={0.5}
                  max={3}
                  step={0.01}
                  value={[scale]}
                  onValueChange={(value) => setScale(value[0])}
                  aria-label="Zoom"
                />
                <ZoomInIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                 <RotateCcwIcon className="h-5 w-5 text-muted-foreground" />
                 <Slider
                  id="rotate"
                  min={-180}
                  max={180}
                  step={1}
                  value={[rotate]}
                  onValueChange={(value) => setRotate(value[0])}
                  aria-label="Rotate"
                />
                <span className="text-xs text-muted-foreground w-10 text-right">{rotate}°</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden canvas for generating cropped image, not for display */}
        <canvas
            ref={previewCanvasRef}
            style={{
                display: 'none', // Keep it off-screen
                objectFit: 'contain',
                width: completedCrop?.width ?? 0,
                height: completedCrop?.height ?? 0,
            }}
        />

        <DialogFooter className="p-6 pt-0 border-t mt-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCropConfirm} disabled={!completedCrop?.width || !completedCrop?.height}>
            Confirm Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

