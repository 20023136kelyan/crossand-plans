'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square } from 'lucide-react';
import { formatDuration, requestMicrophoneAccess, createMediaRecorder } from '@/lib/audioUtils';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onCancel: () => void;
  className?: string;
  compact?: boolean;
}

interface VoiceRecorderRef {
  stopRecording: () => void;
}

export const VoiceRecorder = forwardRef<VoiceRecorderRef, VoiceRecorderProps>(({ onRecordingComplete, onCancel, className = '', compact = false }, ref) => {
  const [isRecording, setIsRecording] = useState(true); // Start recording immediately
  const [recordingTime, setRecordingTime] = useState(0);
  const currentRecordingTime = useRef(0); // Ref to track current recording time
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout>();
  const hasStartedRef = useRef(false); // Track if recording has been started

  // Start recording when component mounts
  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startRecording();
    }

    // Clean up on unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorder?.state !== 'inactive') {
        mediaRecorder?.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await requestMicrophoneAccess();
      audioChunks.current = [];
      
      const onDataAvailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      const onStop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        
        // Use the ref which has the most up-to-date recording time
        const capturedRecordingTime = currentRecordingTime.current;
        console.log('VoiceRecorder - onStop called, captured recording time:', capturedRecordingTime, 'state recordingTime:', recordingTime);
        
        // Create an audio element to get the duration
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Wait for metadata to be loaded to get duration
        await new Promise<void>((resolve) => {
          audio.onloadedmetadata = () => {
            // Update the blob with the correct duration
            const updatedBlob = new Blob(audioChunks.current, { 
              type: 'audio/webm',
            });
            
            // Add duration as a property to the blob
            const actualDuration = isFinite(audio.duration) ? audio.duration : capturedRecordingTime;
            Object.defineProperty(updatedBlob, 'duration', {
              value: actualDuration,
              writable: false,
              enumerable: true,
              configurable: true
            });
            
            console.log('VoiceRecorder - audio.duration:', audio.duration, 'capturedRecordingTime:', capturedRecordingTime, 'actualDuration:', actualDuration);
            setAudioBlob(updatedBlob);
            resolve();
          };
          
          // In case metadata loading fails, still set the blob with the recorded time
          audio.onerror = () => {
            console.warn('Failed to load audio metadata, using recording time as duration');
            const duration = Math.max(capturedRecordingTime, 1); // Ensure at least 1 second
            Object.defineProperty(audioBlob, 'duration', {
              value: duration,
              writable: false,
              enumerable: true,
              configurable: true
            });
            console.log('VoiceRecorder - error fallback duration:', duration);
            setAudioBlob(audioBlob);
            resolve();
          };
        });
        
        stream.getTracks().forEach(track => track.stop());
      };

      const recorder = createMediaRecorder(stream, onDataAvailable, onStop);
      recorder.start(100); // Collect data every 100ms
      
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      currentRecordingTime.current = 0;
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        currentRecordingTime.current += 1;
        setRecordingTime(currentRecordingTime.current);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      console.log('VoiceRecorder - stopping recording, final time:', currentRecordingTime.current);
      // Save the audio chunks before stopping
      const chunks = [...audioChunks.current];
      
      // Stop the recording
      mediaRecorder.stop();
      setIsRecording(false);
      
      // Clear the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Create the audio blob and call onRecordingComplete
      if (chunks.length > 0) {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        // Add duration to the blob
        Object.defineProperty(audioBlob, 'duration', {
          value: currentRecordingTime.current,
          writable: false,
          enumerable: true,
          configurable: true
        });
        onRecordingComplete(audioBlob);
      }
    }
  };

  // Expose stopRecording via ref
  useImperativeHandle(ref, () => ({
    stopRecording: handleStopRecording
  }));

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    setAudioBlob(null);
    setRecordingTime(0);
    onCancel();
  };

  return (
    <div className={cn('flex items-center justify-between w-full', className)}>
      <div className="flex items-center space-x-3 flex-1">
        <div className="relative">
          <div className="h-6 w-6 rounded-full bg-red-500">
          </div>
          <div className="absolute inset-0 rounded-full bg-red-500 opacity-75 animate-ping"></div>
        </div>
        <div className="text-sm font-medium">
          {formatDuration(recordingTime)}
        </div>
      </div>
      
      <Button 
        variant="ghost" 
        size={compact ? 'icon' : 'sm'} 
        onClick={onCancel}
        className={cn(
          'text-muted-foreground hover:bg-muted',
          compact ? 'h-8 w-8' : ''
        )}
        aria-label="Cancel recording"
      >
        {compact ? '×' : 'Cancel'}
      </Button>
    </div>
  );
});
