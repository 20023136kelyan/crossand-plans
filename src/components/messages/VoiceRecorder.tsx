'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square } from 'lucide-react';
import { formatDuration, requestMicrophoneAccess, createMediaRecorder } from '@/lib/audioUtils';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onCancel: () => void;
  className?: string;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, className = '' }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const currentRecordingTime = useRef(0); // Ref to track current recording time
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout>();

  // Clean up on unmount
  useEffect(() => {
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



  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    setAudioBlob(null);
    setRecordingTime(0);
    onCancel();
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {isRecording ? (
        <div className="flex items-center w-full">
          <Button
            variant="destructive"
            size="icon"
            onClick={stopRecording}
            aria-label="Stop recording"
            className="flex-shrink-0"
          >
            <Square className="h-4 w-4" />
          </Button>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-mono">{formatDuration(recordingTime)}</span>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="icon"
          onClick={startRecording}
          className="bg-red-50 hover:bg-red-100 text-red-600"
          aria-label="Start voice recording"
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
