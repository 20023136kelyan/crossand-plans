// Audio format configuration
export const AUDIO_CONFIG = {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 128000, // 128kbps
} as const;

// Format time in MM:SS
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Check if browser supports audio recording
export const isAudioRecordingSupported = (): boolean => {
  return (
    'MediaRecorder' in window &&
    !!MediaRecorder.isTypeSupported(AUDIO_CONFIG.mimeType)
  );
};

// Request microphone access
export const requestMicrophoneAccess = async (): Promise<MediaStream> => {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    console.error('Error accessing microphone:', error);
    throw new Error('Microphone access was denied or is not available.');
  }
};

// Create a MediaRecorder instance
export const createMediaRecorder = (
  stream: MediaStream,
  onDataAvailable: (event: BlobEvent) => void,
  onStop: () => void
): MediaRecorder => {
  const options = { 
    mimeType: AUDIO_CONFIG.mimeType,
    audioBitsPerSecond: AUDIO_CONFIG.audioBitsPerSecond
  };
  
  const mediaRecorder = new MediaRecorder(stream, options);
  mediaRecorder.ondataavailable = onDataAvailable;
  mediaRecorder.onstop = onStop;
  
  return mediaRecorder;
};
