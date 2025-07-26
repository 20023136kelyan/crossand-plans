'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { LinearBlur } from "progressive-blur";
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, ChevronLeft, Loader2, UserCircle, Paperclip, XCircle as XIcon, EyeOff, MoreVertical, Phone, Video,
  ShieldCheck, CheckCircle as CheckCircleIcon, MessageSquare, CheckCheck, Check, Image as ImageIcon, Mic, StickyNote, Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sendMessageAction, markChatAsReadAction, hideMessageForUserAction } from '@/app/actions/chatActions';
import type { Chat, ChatMessage, UserProfile, UserRoleType, ChatParticipantInfo } from '@/types/user';
import { useAuth } from '@/context/AuthContext';
import NextImage from 'next/image';
import { parseISO, isValid, formatDistanceToNowStrict } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, commonImageExtensions } from "@/lib/utils";
import Link from 'next/link';
import { FileValidators } from '@/lib/fileValidation';
import { doc, onSnapshot, collection, query, orderBy, serverTimestamp, setDoc, getDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { getDb } from '@/services/clientServices';
import { MediaMessage } from '@/components/messages/MediaMessage';
import { GifPicker } from '@/components/messages/GifPicker';
import { VoiceRecorder } from '@/components/messages/VoiceRecorder';
import { AudioPlayer } from '@/components/messages/AudioPlayer';

const VerificationBadge = ({ role, isVerified }: { role: UserRoleType | null, isVerified: boolean }) => {
  if (role === 'admin') {
    return <ShieldCheck className="ml-1.5 h-4 w-4 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <CheckCircleIcon className="ml-1.5 h-4 w-4 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified" />;
  }
  return null;
};

const HEADER_HEIGHT_PX = 60; 

// Utility to normalize Firestore Timestamp, string, or Date to JS Date
function getTimestampAsDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts.toDate === 'function') return ts.toDate(); // Firestore Timestamp
  if (ts instanceof Date) return ts;
  return null;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.chatId as string;
  const { toast } = useToast();

  const { user, loading: authLoading, currentUserProfile } = useAuth();
  
  const [chatDetails, setChatDetails] = useState<Chat | null>(null);
  const chatDetailsRef = useRef<Chat | null>(null); 
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>(messages); 
  
  const [newMessage, setNewMessage] = useState('');
  const [loadingChat, setLoadingChat] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{uid: string, name: string}[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  
  // Handle file removal
  const removeFile = useCallback(() => {
    setSelectedFile(null);
    setFilePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);
  const [locallyHiddenMessageIds, setLocallyHiddenMessageIds] = useState<Set<string>>(new Set());
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const gifPickerRef = useRef<HTMLDivElement>(null);

  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceRecordingBlob, setVoiceRecordingBlob] = useState<Blob | null>(null);
  const voiceRecorderRef = useRef<{ stopRecording: () => void } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(70); 

  const initialMarkAsReadDoneRef = useRef(false);

  useEffect(() => { 
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    chatDetailsRef.current = chatDetails;
  }, [chatDetails]);
  
  useEffect(() => {
    const currentFooterRef = footerRef.current;
    if (!currentFooterRef) return;

    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setFooterHeight((entry.target as HTMLElement).offsetHeight);
      }
    });
    observer.observe(currentFooterRef);
    setFooterHeight(currentFooterRef.offsetHeight); 
    
    return () => {
      if (currentFooterRef) {
        observer.unobserve(currentFooterRef);
      }
    };
  }, []); // Removed newMessage and selectedFile from deps as ResizeObserver handles size changes

  const handleMarkChatAsRead = useCallback(async () => {
    try {
      const currentChatId = chatId;
      const currentUser = user;
      const currentChatDetails = chatDetailsRef.current;
      const currentMessages = messagesRef.current;

      if (!currentChatId || !currentUser?.uid || !currentChatDetails) {
        console.log('[handleMarkChatAsRead] Missing required data to mark as read');
        return;
      }
      
      // Get the last message (if any)
      const lastMsg = currentMessages?.length > 0 ? currentMessages[currentMessages.length - 1] : null;
      
      // If there are no messages, we can still mark the chat as read
      if (!lastMsg) {
        console.log('[handleMarkChatAsRead] No messages to mark as read');
        const idToken = await currentUser.getIdToken(true);
        const result = await markChatAsReadAction(currentChatId, idToken);
        console.log('[handleMarkChatAsRead] Marked empty chat as read:', result);
        return;
      }

      // Don't mark as read if the last message is from the current user
      if (lastMsg.senderId === currentUser.uid) {
        console.log('[handleMarkChatAsRead] Last message is from current user, not marking as read');
        return;
      }

      // Check if we've already marked this message as read
      const lastReadTimestamp = currentChatDetails.participantReadTimestamps?.[currentUser.uid];
      const lastReadDate = getTimestampAsDate(lastReadTimestamp);
      const lastMsgDate = getTimestampAsDate(lastMsg.timestamp);
      
      console.log('[handleMarkChatAsRead] Read status check:', {
        lastReadTimestamp,
        lastReadDate: lastReadDate?.toISOString(),
        lastMsgDate: lastMsgDate?.toISOString(),
        lastMsgId: lastMsg.id,
        lastMsgText: lastMsg.text ? (lastMsg.text.substring(0, 30) + (lastMsg.text.length > 30 ? '...' : '')) : ''
      });
      
      if (lastReadDate && lastMsgDate) {
        // Add a small buffer (1 second) to account for clock skew
        const bufferMs = 1000;
        const lastReadWithBuffer = new Date(lastReadDate.getTime() - bufferMs);
        
        if (lastMsgDate <= lastReadWithBuffer) {
          console.log('[handleMarkChatAsRead] Message already marked as read (with buffer)');
          return;
        }
      }

      console.log('[handleMarkChatAsRead] Marking chat as read');
      const idToken = await currentUser.getIdToken(true);
      const result = await markChatAsReadAction(currentChatId, idToken);
      console.log('[handleMarkChatAsRead] Mark as read result:', result);
      
      // Force a re-render to update the UI
      setChatDetails(prev => prev ? { ...prev } : null);
      
    } catch (err: any) {
      console.error("[ChatPage] Error in handleMarkChatAsRead:", err);
      // Don't show error to user as this runs in the background
    }
  }, [chatId, user]);

  // Close GIF picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (gifPickerRef.current && !gifPickerRef.current.contains(event.target as Node)) {
        setShowGifPicker(false);
      }
    };

    if (showGifPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGifPicker]);

  // Effect for fetching chat details
  // Handle typing indicator updates
  useEffect(() => {
    if (!user?.uid || !chatId) return;

    const typingRef = doc(getDb(), 'chats', chatId, 'typing', 'status');
    
    // Set up real-time listener for typing status
    const unsubscribeTyping = onSnapshot(typingRef, {
      next: (doc) => {
        const typingData = doc.data() || {};
        console.log('Typing status updated:', typingData);
        const typingUsersList: Array<{uid: string, name: string}> = [];
        
        // Get all typing users except current user
        Object.entries(typingData).forEach(([uid, userData]) => {
          if (uid && userData && typeof userData === 'object' && 'name' in userData) {
            // Only include if the user is not the current user and has a valid name
            if (uid !== user?.uid && userData.name) {
              typingUsersList.push({
                uid,
                name: userData.name
              });
            }
          }
        });
        
        console.log('Setting typing users:', typingUsersList);
        setTypingUsers(typingUsersList);
      },
      error: (error) => {
        console.error('Error in typing status listener:', error);
      }
    });

    // Clean up typing status when component unmounts
    return () => {
      unsubscribeTyping();
      // Clear local typing status
      updateTypingStatus(false);
    };
  }, [user?.uid, chatId]);

  // Update typing status in Firestore
  const updateTypingStatus = async (typing: boolean) => {
    console.log('updateTypingStatus called with:', { typing, userId: user?.uid, chatId });
    if (!user?.uid || !chatId || !currentUserProfile) {
      console.log('Missing required data:', { hasUser: !!user, userId: user?.uid, chatId, hasProfile: !!currentUserProfile });
      return;
    }
    
    const typingRef = doc(getDb(), 'chats', chatId, 'typing', 'status');
    
    try {
      if (typing) {
        // Set typing status with merge: true to preserve other users' status
        await setDoc(typingRef, {
          [user.uid]: {
            name: currentUserProfile.name,
            timestamp: serverTimestamp(),
            userId: user.uid  // Add userId for easier querying
          }
        }, { merge: true });
        console.log('Typing status set for user:', user.uid);
      } else {
        // Get current status
        const currentStatus = await getDoc(typingRef);
        if (currentStatus.exists()) {
          const updatedStatus = { ...currentStatus.data() };
          if (user.uid in updatedStatus) {
            delete updatedStatus[user.uid];
            // If there are no more users typing, set an empty object
            if (Object.keys(updatedStatus).length === 0) {
              await setDoc(typingRef, {});
            } else {
              await setDoc(typingRef, updatedStatus, { merge: true });
            }
            console.log('Typing status cleared for user:', user.uid);
          }
        }
      }
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  };

  // Handle typing events
  const handleTyping = () => {
    console.log('handleTyping called, current isTyping:', isTyping);
    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }
    
    // Reset typing status after delay
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 2000); // 2 seconds of inactivity before clearing typing status
  };

  useEffect(() => {
    if (authLoading) {
      setLoadingChat(true);
      return;
    }
    if (!user) {
      router.push('/login');
      setLoadingChat(false);
      return;
    }
    if (chatId && user.uid) {
      setLoadingChat(true);
      
      // Add retry mechanism for new chats
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second
      
      const setupChatListeners = () => {
        // Real-time listener for chat details
        const chatDocRef = doc(getDb(), 'chats', chatId);
        const unsubChat = onSnapshot(chatDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setChatDetails({ id: docSnap.id, ...docSnap.data() } as Chat);
            setLoadingChat(false);
          } else {
            // If chat doesn't exist and we haven't exceeded retries, try again
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`[ChatPage] Chat ${chatId} not found, retrying... (${retryCount}/${maxRetries})`);
              setTimeout(() => {
                setupChatListeners();
              }, retryDelay);
            } else {
              setChatDetails(null);
              setLoadingChat(false);
              toast({ title: 'Chat not found', description: 'The chat could not be loaded. It may have been deleted or you may not have permission to view it.', variant: 'destructive' });
            }
          }
        }, (error) => {
          setChatDetails(null);
          setLoadingChat(false);
          toast({ title: 'Error loading chat', description: error.message || 'Could not load chat.', variant: 'destructive' });
        });
        
        // Real-time listener for messages with optimized updates
        const messagesQuery = query(collection(getDb(), 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
        const unsubMessages = onSnapshot(messagesQuery, {
          next: (snapshot) => {
            setMessages(prevMessages => {
              // Create a map of existing messages for quick lookup
              const existingMessages = new Map(prevMessages.map(msg => [msg.id, msg]));
              let hasChanges = false;
              
              // Check for any new or updated messages
              snapshot.docChanges().forEach(change => {
                const msg = { id: change.doc.id, ...change.doc.data() } as ChatMessage;
                
                if (change.type === 'added' || change.type === 'modified') {
                  const existingMsg = existingMessages.get(msg.id);
                  // Only update if message is new or has changed
                  if (!existingMsg || JSON.stringify(existingMsg) !== JSON.stringify(msg)) {
                    existingMessages.set(msg.id, msg);
                    hasChanges = true;
                  }
                } else if (change.type === 'removed') {
                  if (existingMessages.has(msg.id)) {
                    existingMessages.delete(msg.id);
                    hasChanges = true;
                  }
                }
              });
              
              // Only update state if there are actual changes
              return hasChanges ? Array.from(existingMessages.values()) : prevMessages;
            });
          },
          error: (error) => {
            console.error('Error in messages listener:', error);
            toast({ 
              title: 'Error loading messages', 
              description: error.message || 'Could not load messages.', 
              variant: 'destructive' 
            });
          }
        });
        
        return () => {
          unsubChat();
          unsubMessages();
        };
      };
      
      return setupChatListeners();
    } else {
      setChatDetails(null);
      setMessages([]);
      setLoadingChat(false);
    }
  }, [chatId, user?.uid, authLoading, router, toast]);


  // Effect for subscribing to messages with optimized updates
  useEffect(() => {
    if (!chatId || !user?.uid || !chatDetails) return () => {}; 
    
    // TODO: Replace with appropriate action calls or server functions
    // const unsubscribe = getMessagesForChat(chatId, (messages) => {
    //   setMessages(messages);
    // }, (error) => {
    //   console.error('Error fetching messages:', error);
    // });

    // return () => {
    //   if (unsubscribe) unsubscribe();
    // };
  }, [chatId, user?.uid, chatDetails]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  },[]);

  // Effect for scrolling and marking messages as read
  useEffect(() => {
    // Scroll to bottom when messages change
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const scrollBehavior = (lastMessage?.senderId === user?.uid && initialMarkAsReadDoneRef.current) ? "smooth" : "auto";
      scrollToBottom(scrollBehavior);
    }
    
    // Mark as read when:
    // 1. Chat is loaded and we have messages, or
    // 2. New messages arrive and the chat is visible
    const shouldMarkAsRead = !loadingChat && chatDetails && user?.uid && 
      (messages.length > 0 || !initialMarkAsReadDoneRef.current);
      
    if (shouldMarkAsRead) {
      handleMarkChatAsRead();
      initialMarkAsReadDoneRef.current = true;
    }
  }, [messages, loadingChat, chatDetails, user?.uid, scrollToBottom, handleMarkChatAsRead]);


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    // Reset the input value to allow selecting the same file again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (!file) return;

    // Check file type and set appropriate limits
    const fileType = file.type.toLowerCase();
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    
    // Define valid file types and their max sizes
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const validAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac'];
    const validImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const validAudioExtensions = ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'aac'];
    
    const isImage = validImageTypes.includes(fileType) || validImageExtensions.includes(fileExtension);
    const isAudio = validAudioTypes.includes(fileType) || validAudioExtensions.includes(fileExtension);
    const isGif = fileType === 'image/gif' || fileExtension === 'gif';
    
    // Set max sizes (10MB for audio, 10MB for GIFs, 5MB for other images)
    const maxSizeForAudio = 10 * 1024 * 1024; // 10MB for audio
    const maxSizeForGif = 10 * 1024 * 1024; // 10MB for GIFs
    const maxSizeForImage = 5 * 1024 * 1024; // 5MB for other images
    
    let maxSize = maxSizeForImage;
    if (isAudio) maxSize = maxSizeForAudio;
    else if (isGif) maxSize = maxSizeForGif;
    
    // Use the centralized file validator
    const validation = FileValidators.chatMessage(file, isAudio);
    if (!validation.valid) {
      toast({
        title: 'Invalid file',
        description: validation.error || 'This file cannot be sent. Please choose a different file.',
        variant: 'destructive',
      });
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    
    // Clean up previous preview URL if it exists
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    setSelectedFile(file);
    setFilePreviewUrl(previewUrl);
    
    // Auto-focus the send button for better UX
    setTimeout(() => {
      const sendButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
      if (sendButton) {
        sendButton.focus();
      }
    }, 100);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    if(fileInputRef.current) fileInputRef.current.value = ""; 
  };

  const handleGifSelect = (gifUrl: string) => {
    console.log('[handleGifSelect] GIF selected, URL:', gifUrl);
    setGifUrl(gifUrl);
    // Auto-send the GIF when selected
    console.log('[handleGifSelect] Calling handleSendMessage with GIF URL');
    handleSendMessage(undefined, gifUrl);
  };

  // Handle voice recording completion - just show the preview
  const handleVoiceRecordingComplete = (audioBlob: Blob) => {
    setVoiceRecordingBlob(audioBlob);
    setIsVoiceRecording(false);
  };

  // Handle sending the recorded voice message
  const handleSendVoiceMessage = async () => {
    if (!voiceRecordingBlob) return;
    
    try {
      const formData = new FormData();
      formData.append('audio', voiceRecordingBlob, 'voice-message.webm');
      formData.append('isVoice', 'true');
      
      // Extract duration from blob if available, fallback to 1 second
      let duration = 1;
      if (typeof (voiceRecordingBlob as any).duration === 'number' && isFinite((voiceRecordingBlob as any).duration)) {
        duration = Math.max(1, Math.round((voiceRecordingBlob as any).duration));
      }
      formData.append('voiceDuration', duration.toString());
      
      const idToken = await user?.getIdToken(true);
      if (!idToken) {
        throw new Error('Authentication token not available');
      }
      
      const result = await sendMessageAction(chatId, formData, idToken);
      if (!result.success) {
        toast({
          title: 'Error',
          description: result.error || 'Failed to send voice message',
          variant: 'destructive',
        });
      } else {
        setVoiceRecordingBlob(null);
      }
    } catch (error) {
      console.error('Error sending voice message:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while sending the voice message',
        variant: 'destructive',
      });
    }
  };

  // Cancel voice recording
  const handleCancelVoiceRecording = () => {
    setVoiceRecordingBlob(null);
    setIsVoiceRecording(false);
  };

  // Handle sending messages with optimistic updates
  const handleSendMessage = async (e?: React.FormEvent, gifUrlToSend?: string) => {
    console.log('[handleSendMessage] Called with:', { hasEvent: !!e, gifUrlToSend });
    if (e) e.preventDefault();
    const gifToSend = gifUrlToSend || gifUrl;
    
    if ((!newMessage.trim() && !selectedFile && !gifToSend) || !user) {
      console.log('[handleSendMessage] Early return - no content to send or no user');
      return;
    }

    setSendingMessage(true);
    
    // Create form data with message and file
    const formData = new FormData();
    if (newMessage.trim()) {
      formData.append('text', newMessage.trim());
    }
    
    // Add file if selected
    if (gifToSend) {
      console.log('[handleSendMessage] Preparing to send GIF:', gifToSend);
      // If sending a GIF, we send it as a special media URL
      formData.append('mediaUrl', gifToSend);
      formData.append('isGif', 'true');
      formData.append('mediaType', 'image/gif'); // Set proper MIME type for GIF
      
      // Log form data for debugging
      console.log('[handleSendMessage] FormData entries:');
      for (const [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value);
      }
      
      setGifUrl(null); // Clear the GIF URL after sending
      console.log('[handleSendMessage] GIF URL cleared from state');
    } else if (selectedFile) {
      const fileType = selectedFile.type.toLowerCase();
      const isAudio = fileType.startsWith('audio/') || 
                     ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'aac'].includes(
                       selectedFile.name.split('.').pop()?.toLowerCase() || ''
                     );
      
      if (isAudio) {
        formData.append('audio', selectedFile, selectedFile.name);
        formData.append('mediaType', 'audio');
      } else {
        formData.append('image', selectedFile, selectedFile.name);
        formData.append('mediaType', 'image');
      }
    }

    // Store current state in case of failure
    const tempMessageText = newMessage.trim();
    const tempSelectedFile = selectedFile;
    
    // Create temporary message ID for optimistic update
    const tempMessageId = `temp-${Date.now()}`;
    const tempMessage: ChatMessage = {
      id: tempMessageId,
      senderId: user.uid,
      text: newMessage.trim(),
      timestamp: new Date().toISOString(),
      mediaUrl: gifToSend || undefined,
      mediaType: gifToSend ? 'gif' : undefined,
      status: 'sending'
    };
    
    // Optimistically add the message to the UI
    setMessages(prev => [...prev, tempMessage]);
    
    // Reset form
    setNewMessage('');
    setGifUrl(null);
    setSelectedFile(null);
    setFilePreviewUrl(null);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
    
    // Clear file preview but keep the file in memory until upload is confirmed
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }

    try {
      // Get fresh ID token
      const idToken = await user.getIdToken(true);
      if (!idToken) {
        throw new Error("Authentication token not available. Please try again.");
      }

      // Show uploading toast if there's a file
      let uploadToast: { id: string; dismiss: () => void } | undefined;
      if (selectedFile) {
        uploadToast = toast({
          title: 'Uploading...',
          description: 'Sending your image',
          variant: 'default',
          duration: 5000,
        });
      }

      // Send the message
      const result = await sendMessageAction(chatId, formData, idToken);
      
      // Dismiss uploading toast if it exists
      if (uploadToast) {
        uploadToast.dismiss();
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }
      
      // The real message will be added via the Firestore listener
      // Remove the temporary message if it exists
      setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
      
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Remove the temporary message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
      
      // Restore form state on error
      setNewMessage(tempMessageText);
      setSelectedFile(tempSelectedFile);
      
      // Restore preview if there was a file
      if (tempSelectedFile) {
        setFilePreviewUrl(URL.createObjectURL(tempSelectedFile));
      }
      
      // Show error toast
      toast({
        title: 'Failed to send message',
        description: error.message || 'An error occurred while sending your message',
        variant: 'destructive',
      });
      
    } finally {
      setSendingMessage(false);
    }
  };
  
  const handleTextareaInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setNewMessage(value);
    const textarea = event.target;
    textarea.style.height = 'auto'; 
    const newScrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(newScrollHeight, 120)}px`;
    
    // Always trigger typing indicator when user is typing
    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }
    
    // Reset the typing timer on each keystroke
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set a timeout to clear typing status after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 2000);
  };

  const handleHideMessage = async (messageId: string) => {
    if (!user) return;
    setLocallyHiddenMessageIds(prev => new Set(prev).add(messageId)); 
    try {
      const idToken = await user.getIdToken(true);
      if (!idToken) {
        toast({ title: "Authentication Error", description: "Could not get ID token.", variant: "destructive" });
        throw new Error("ID Token not available for hiding message");
      }
      const result = await hideMessageForUserAction(chatId, messageId, idToken);
      if (!result.success) {
        toast({ title: "Error Hiding Message", description: result.error || "Could not hide message.", variant: "destructive" });
        setLocallyHiddenMessageIds(prev => { 
          const newSet = new Set(prev); newSet.delete(messageId); return newSet;
        });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to hide message.", variant: "destructive" });
      setLocallyHiddenMessageIds(prev => {
        const newSet = new Set(prev); newSet.delete(messageId); return newSet;
      });
    }
  };

  const filteredAndVisibleMessages = useMemo(() => {
    return messages.filter(msg => !locallyHiddenMessageIds.has(msg.id) && !(msg.hiddenBy && user && msg.hiddenBy.includes(user.uid)));
  }, [messages, locallyHiddenMessageIds, user]);

  if (authLoading || loadingChat) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  if (!chatDetails) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Chat not found.</p>
      </div>
    );
  }

  const otherParticipant = chatDetails?.participantInfo?.find(p => p.uid !== user?.uid);
  const otherParticipantFirstName = otherParticipant?.name?.split(' ')[0] || 'User';
  const otherParticipantInitial = otherParticipantFirstName ? otherParticipantFirstName.charAt(0).toUpperCase() : (otherParticipant?.uid ? otherParticipant.uid.charAt(0).toUpperCase() : <UserCircle className="h-5 w-5" />);

  // New SVG pattern with dark background and orange/white elements - zoomed out view
  const pattern = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='814' height='407' viewBox='-200 -100 2000 1000'%3E%3Crect fill='%23000000' width='1600' height='800'/%3E%3Cpath fill='%23FFB226' d='M1102.5 734.8c2.5-1.2 24.8-8.6 25.6-7.5.5.7-3.9 23.8-4.6 24.5C1123.3 752.1 1107.5 739.5 1102.5 734.8zM1226.3 229.1c0-.1-4.9-9.4-7-14.2-.1-.3-.3-1.1-.4-1.6-.1-.4-.3-.7-.6-.9-.3-.2-.6-.1-.8.1l-13.1 12.3c0 0 0 0 0 0-.2.2-.3.5-.4.8 0 .3 0 .7.2 1 .1.1 1.4 2.5 2.1 3.6 2.4 3.7 6.5 12.1 6.5 12.2.2.3.4.5.7.6.3 0 .5-.1.7-.3 0 0 1.8-2.5 2.7-3.6 1.5-1.6 3-3.2 4.6-4.7 1.2-1.2 1.6-1.4 2.1-1.6.5-.3 1.1-.5 2.5-1.9C1226.5 230.4 1226.6 229.6 1226.3 229.1zM33 770.3C33 770.3 33 770.3 33 770.3c0-.7-.5-1.2-1.2-1.2-.1 0-.3 0-.4.1-1.6.2-14.3.1-22.2 0-.3 0-.6.1-.9.4-.2.2-.4.5-.4.9 0 .2 0 4.9.1 5.9l.4 13.6c0 .3.2.6.4.9.2.2.5.3.8.3 0 0 .1 0 .1 0 7.3-.7 14.7-.9 22-.6.3 0 .7-.1.9-.3.2-.2.4-.6.4-.9C32.9 783.3 32.9 776.2 33 770.3z'/%3E%3Cpath fill='%23FF9727' d='M171.1 383.4c1.3-2.5 14.3-22 15.6-21.6.8.3 11.5 21.2 11.5 22.1C198.1 384.2 177.9 384 171.1 383.4zM596.4 711.8c-.1-.1-6.7-8.2-9.7-12.5-.2-.3-.5-1-.7-1.5-.2-.4-.4-.7-.7-.8-.3-.1-.6 0-.8.3L574 712c0 0 0 0 0 0-.2.2-.2.5-.2.9 0 .3.2.7.4.9.1.1 1.8 2.2 2.8 3.1 3.1 3.1 8.8 10.5 8.9 10.6.2.3.5.4.8.4.3 0 .5-.2.6-.5 0 0 1.2-2.8 2-4.1 1.1-1.9 2.3-3.7 3.5-5.5.9-1.4 1.3-1.7 1.7-2 .5-.4 1-.7 2.1-2.4C596.9 713.1 596.8 712.3 596.4 711.8zM727.5 179.9C727.5 179.9 727.5 179.9 727.5 179.9c.6.2 1.3-.2 1.4-.8 0-.1 0-.2 0-.4.2-1.4 2.8-12.6 4.5-19.5.1-.3 0-.6-.2-.8-.2-.3-.5-.4-.8-.5-.2 0-4.7-1.1-5.7-1.3l-13.4-2.7c-.3-.1-.7 0-.9.2-.2.2-.4.4-.5.6 0 0 0 .1 0 .1-.8 6.5-2.2 13.1-3.9 19.4-.1.3 0 .6.2.9.2.3.5.4.8.5C714.8 176.9 721.7 178.5 727.5 179.9zM728.5 178.1c-.1-.1-.2-.2-.4-.2C728.3 177.9 728.4 178 728.5 178.1z'/%3E%3Cg fill-opacity='1' fill='%23FFF'%3E%3Cpath d='M699.6 472.7c-1.5 0-2.8-.8-3.5-2.3-.8-1.9 0-4.2 1.9-5 3.7-1.6 6.8-4.7 8.4-8.5 1.6-3.8 1.7-8.1.2-11.9-.3-.9-.8-1.8-1.2-2.8-.8-1.7-1.8-3.7-2.3-5.9-.9-4.1-.2-8.6 2-12.8 1.7-3.1 4.1-6.1 7.6-9.1 1.6-1.4 4-1.2 5.3.4 1.4 1.6 1.2 4-.4 5.3-2.8 2.5-4.7 4.7-5.9 7-1.4 2.6-1.9 5.3-1.3 7.6.3 1.4 1 2.8 1.7 4.3.5 1.1 1 2.2 1.5 3.3 2.1 5.6 2 12-.3 17.6-2.3 5.5-6.8 10.1-12.3 12.5C700.6 472.6 700.1 472.7 699.6 472.7zM740.4 421.4c1.5-.2 3 .5 3.8 1.9 1.1 1.8.4 4.2-1.4 5.3-3.7 2.1-6.4 5.6-7.6 9.5-1.2 4-.8 8.4 1.1 12.1.4.9 1 1.7 1.6 2.7 1 1.7 2.2 3.5 3 5.7 1.4 4 1.2 8.7-.6 13.2-1.4 3.4-3.5 6.6-6.8 10.1-1.5 1.6-3.9 1.7-5.5.2-1.6-1.4-1.7-3.9-.2-5.4 2.6-2.8 4.3-5.3 5.3-7.7 1.1-2.8 1.3-5.6.5-7.9-.5-1.3-1.3-2.7-2.2-4.1-.6-1-1.3-2.1-1.9-3.2-2.8-5.4-3.4-11.9-1.7-17.8 1.8-5.9 5.8-11 11.2-14C739.4 421.6 739.9 421.4 740.4 421.4zM261.3 590.9c5.7 6.8 9 15.7 9.4 22.4.5 7.3-2.4 16.4-10.2 20.4-3 1.5-6.7 2.2-11.2 2.2-7.9-.1-12.9-2.9-15.4-8.4-2.1-4.7-2.3-11.4 1.8-15.9 3.2-3.5 7.8-4.1 11.2-1.6 1.2.9 1.5 2.7.6 3.9-.9 1.2-2.7 1.5-3.9.6-1.8-1.3-3.6.6-3.8.8-2.4 2.6-2.1 7-.8 9.9 1.5 3.4 4.7 5 10.4 5.1 3.6 0 6.4-.5 8.6-1.6 4.7-2.4 7.7-8.6 7.2-15-.5-7.3-5.3-18.2-13-23.9-4.2-3.1-8.5-4.1-12.9-3.1-3.1.7-6.2 2.4-9.7 5-6.6 5.1-11.7 11.8-14.2 19-2.7 7.7-2.1 15.8 1.9 23.9.7 1.4.1 3.1-1.3 3.7-1.4.7-3.1.1-3.7-1.3-4.6-9.4-5.4-19.2-2.2-28.2 2.9-8.2 8.6-15.9 16.1-21.6 4.1-3.1 8-5.1 11.8-6 6-1.4 12 0 17.5 4C257.6 586.9 259.6 588.8 261.3 590.9z'/%3E%3Ccircle cx='1013.7' cy='153.9' r='7.1'/%3E%3Ccircle cx='1024.3' cy='132.1' r='7.1'/%3E%3Ccircle cx='1037.3' cy='148.9' r='7.1'/%3E%3Cpath d='M1508.7 297.2c-4.8-5.4-9.7-10.8-14.8-16.2 5.6-5.6 11.1-11.5 15.6-18.2 1.2-1.7.7-4.1-1-5.2-1.7-1.2-4.1-.7-5.2 1-4.2 6.2-9.1 11.6-14.5 16.9-4.8-5-9.7-10-14.7-14.9-1.5-1.5-3.9-1.5-5.3 0-1.5 1.5-1.5 3.9 0 5.3 4.9 4.8 9.7 9.8 14.5 14.8-1.1 1.1-2.3 2.2-3.5 3.2-4.1 3.8-8.4 7.8-12.4 12-1.4 1.5-1.4 3.8 0 5.3 0 0 0 0 0 0 1.5 1.4 3.9 1.4 5.3-.1 3.9-4 8.1-7.9 12.1-11.7 1.2-1.1 2.3-2.2 3.5-3.3 4.9 5.3 9.8 10.6 14.6 15.9.1.1.1.1.2.2 1.4 1.4 3.7 1.5 5.2.2C1510 301.2 1510.1 298.8 1508.7 297.2zM327.6 248.6l-.4-2.6c-1.5-11.1-2.2-23.2-2.3-37 0-5.5 0-11.5.2-18.5 0-.7 0-1.5 0-2.3 0-5 0-11.2 3.9-13.5 2.2-1.3 5.1-1 8.5.9 5.7 3.1 13.2 8.7 17.5 14.9 5.5 7.8 7.3 16.9 5 25.7-3.2 12.3-15 31-30 32.1L327.6 248.6zM332.1 179.2c-.2 0-.3 0-.4.1-.1.1-.7.5-1.1 2.7-.3 1.9-.3 4.2-.3 6.3 0 .8 0 1.7 0 2.4-.2 6.9-.2 12.8-.2 18.3.1 12.5.7 23.5 2 33.7 11-2.7 20.4-18.1 23-27.8 1.9-7.2.4-14.8-4.2-21.3l0 0C347 188.1 340 183 335 180.3 333.6 179.5 332.6 179.2 332.1 179.2zM516.3 60.8c-.1 0-.2 0-.4-.1-2.4-.7-4-.9-6.7-.7-.7 0-1.3-.5-1.4-1.2 0-.7.5-1.3 1.2-1.4 3.1-.2 4.9 0 7.6.8.7.2 1.1.9.9 1.6C517.3 60.4 516.8 60.8 516.3 60.8zM506.1 70.5c-.5 0-1-.3-1.2-.8-.8-2.1-1.2-4.3-1.3-6.6 0-.7.5-1.3 1.2-1.3.7 0 1.3.5 1.3 1.2.1 2 .5 3.9 1.1 5.8.2.7-.1 1.4-.8 1.6C506.4 70.5 506.2 70.5 506.1 70.5zM494.1 64.4c-.4 0-.8-.2-1-.5-.4-.6-.3-1.4.2-1.8 1.8-1.4 3.7-2.6 5.8-3.6.6-.3 1.4 0 1.7.6.3.6 0 1.4-.6 1.7-1.9.9-3.7 2-5.3 3.3C494.7 64.3 494.4 64.4 494.1 64.4zM500.5 55.3c-.5 0-.9-.3-1.2-.7-.5-1-1.2-1.9-2.4-3.4-.3-.4-.7-.9-1.1-1.4-.4-.6-.3-1.4.2-1.8.6-.4 1.4-.3 1.8.2.4.5.8 1 1.1 1.4 1.3 1.6 2.1 2.6 2.7 3.9.3.6 0 1.4-.6 1.7C500.9 55.3 500.7 55.3 500.5 55.3zM506.7 55c-.3 0-.5-.1-.8-.2-.6-.4-.7-1.2-.3-1.8 1.2-1.7 2.3-3.4 3.3-5.2.3-.6 1.1-.9 1.7-.5.6.3.9 1.1.5 1.7-1 1.9-2.2 3.8-3.5 5.6C507.4 54.8 507.1 55 506.7 55zM1029.3 382.8c-.1 0-.2 0-.4-.1-2.4-.7-4-.9-6.7-.7-.7 0-1.3-.5-1.4-1.2 0-.7.5-1.3 1.2-1.4 3.1-.2 4.9 0 7.6.8.7.2 1.1.9.9 1.6C1030.3 382.4 1029.8 382.8 1029.3 382.8zM1019.1 392.5c-.5 0-1-.3-1.2-.8-.8-2.1-1.2-4.3-1.3-6.6 0-.7.5-1.3 1.2-1.3.7 0 1.3.5 1.3 1.2.1 2 .5 3.9 1.1 5.8.2.7-.1 1.4-.8 1.6C1019.4 392.5 1019.2 392.5 1019.1 392.5zM1007.1 386.4c-.4 0-.8-.2-1-.5-.4-.6-.3-1.4.2-1.8 1.8-1.4 3.7-2.6 5.8-3.6.6-.3 1.4 0 1.7.6.3.6 0 1.4-.6 1.7-1.9.9-3.7 2-5.3 3.3C1007.7 386.3 1007.4 386.4 1007.1 386.4zM1013.5 377.3c-.5 0-.9-.3-1.2-.7-.5-1-1.2-1.9-2.4-3.4-.3-.4-.7-.9-1.1-1.4-.4-.6-.3-1.4.2-1.8.6-.4 1.4-.3 1.8.2.4.5.8 1 1.1 1.4 1.3 1.6 2.1 2.6 2.7 3.9.3.6 0 1.4-.6 1.7C1013.9 377.3 1013.7 377.3 1013.5 377.3zM1019.7 377c-.3 0-.5-.1-.8-.2-.6-.4-.7-1.2-.3-1.8 1.2-1.7 2.3-3.4 3.3-5.2.3-.6 1.1-.9 1.7-.5.6.3.9 1.1.5 1.7-1 1.9-2.2 3.8-3.5 5.6C1020.4 376.8 1020.1 377 1019.7 377zM1329.7 573.4c-1.4 0-2.9-.2-4.5-.7-8.4-2.7-16.6-12.7-18.7-20-.4-1.4-.7-2.9-.9-4.4-8.1 3.3-15.5 10.6-15.4 21 0 1.5-1.2 2.7-2.7 2.8 0 0 0 0 0 0-1.5 0-2.7-1.2-2.7-2.7-.1-6.7 2.4-12.9 7-18 3.6-4 8.4-7.1 13.7-8.8.5-6.5 3.1-12.9 7.4-17.4 7-7.4 18.2-8.9 27.3-10.1l.7-.1c1.5-.2 2.9.9 3.1 2.3.2 1.5-.9 2.9-2.3 3.1l-.7.1c-8.6 1.2-18.4 2.5-24 8.4-3 3.2-5 7.7-5.7 12.4 7.9-1 17.7 1.3 24.3 5.7 4.3 2.9 7.1 7.8 7.2 12.7.2 4.3-1.7 8.3-5.2 11.1C1335.2 572.4 1332.6 573.4 1329.7 573.4zM1311 546.7c.1 1.5.4 3 .8 4.4 1.7 5.8 8.7 14.2 15.1 16.3 2.8.9 5.1.5 7.2-1.1 2.7-2.1 3.2-4.8 3.1-6.6-.1-3.2-2-6.4-4.8-8.3C1326.7 547.5 1317.7 545.6 1311 546.7z'/%3E%3C/g%3E%3C/svg%3E";

  return (
    <div className="flex flex-col h-[100dvh] text-foreground overflow-hidden relative">
      {/* Background with geometric pattern */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundColor: '#000000',
          backgroundImage: `url("${pattern}")`,
          backgroundAttachment: 'fixed',
          backgroundSize: 'contain',
          opacity: 0.6
        }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background/70 z-1" />
      {/* Fixed Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b flex items-center p-3 h-14 flex-shrink-0">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()}
          className="mr-2 text-foreground hover:bg-foreground/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        {otherParticipant ? (
          <Link 
            href={`/users/${otherParticipant.uid}`}
            className="flex items-center flex-1 min-w-0 group"
          >
            <Avatar className="h-8 w-8 mr-2 transition-shadow group-hover:shadow-md">
              {otherParticipant.avatarUrl ? (
                <AvatarImage src={otherParticipant.avatarUrl} alt={otherParticipantFirstName} />
              ) : (
                <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                  {otherParticipantInitial}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center text-sm truncate">
                {otherParticipantFirstName}
                {otherParticipant && <VerificationBadge role={otherParticipant.role} isVerified={otherParticipant.isVerified} />}
              </div>
              {typingUsers.length > 0 ? (
                <p className="text-xs text-muted-foreground truncate">
                  {typingUsers.map(u => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </p>
              ) : (
                <p className="text-xs text-muted-foreground truncate">
                  {/* Online status not available in current data model */}
                </p>
              )}
            </div>
          </Link>
        ) : (
          <div className="flex-1">
            <p className="font-medium text-sm">Loading...</p>
          </div>
        )}
        
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Video className="h-4 w-4" />
          </Button>
        </div>
      </header>
        
      {/* Scrollable Messages */}
      <main 
        className="flex-1 overflow-y-auto p-4 space-y-2 relative z-10"
        style={{
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: `${footerHeight}px`
        }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">No messages yet. Say hi!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 flex-1">
            {filteredAndVisibleMessages.map((msg, idx) => {
              if (!user) return null;
              const messageTimestamp = getTimestampAsDate(msg.timestamp);

              const isSender = msg.senderId === user.uid;
              const prevMessage = filteredAndVisibleMessages[idx-1];
              
              const isSameSenderAndMinute = (prev: ChatMessage | undefined, current: ChatMessage): boolean => {
                if (!prev || !current) return false;
                if (prev.senderId !== current.senderId) return false;
                const prevTs = typeof prev.timestamp === 'string' && isValid(parseISO(prev.timestamp)) ? parseISO(prev.timestamp) : null;
                const currentTs = typeof current.timestamp === 'string' && isValid(parseISO(current.timestamp)) ? parseISO(current.timestamp) : null;
                return !!(prevTs && currentTs && prevTs.getMinutes() === currentTs.getMinutes() && prevTs.getHours() === currentTs.getHours() && prevTs.getDate() === currentTs.getDate());
              };
              
              const showAvatar = !isSender && (!prevMessage || prevMessage.senderId !== msg.senderId || !isSameSenderAndMinute(prevMessage, msg));
              const isContinuingBlock = isSameSenderAndMinute(prevMessage, msg);

              // Calculate bubble styles based on message type and sender
              const hasMedia = !!msg.mediaUrl;
              const hasText = !!msg.text?.trim();
              const isMediaOnly = hasMedia && !hasText;
              const isTextOnly = !hasMedia && hasText;
              const hasBoth = hasMedia && hasText;

              const bubblePadding = cn(
                "px-3.5 py-2.5",
                isMediaOnly && "p-1.5"
              );
              
              const bubbleStyles = cn(
                "shadow-md max-w-[70%] sm:max-w-[65%] break-words group-hover:bg-opacity-80",
                "transition-all duration-200",
                hasMedia && msg.mediaType !== 'voice' && 'bg-transparent shadow-none',
                isTextOnly && isSender && 'bg-[#23232a] text-primary-foreground group-hover:opacity-90',
                isTextOnly && !isSender && 'bg-[#d97a1a] text-white group-hover:bg-[#c26a16]',
                hasBoth && 'bg-transparent',
                isSender ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md',
                isContinuingBlock && (isSender ? 'rounded-tr-md rounded-br-lg' : 'rounded-tl-md rounded-bl-lg'),
                msg.mediaType === 'voice' && '!bg-transparent !shadow-none !p-0'
              );
              
              // Don't make voice messages clickable to open in new tab
              const handleMediaClick = msg.mediaType === 'voice' 
                ? undefined 
                : () => window.open(msg.mediaUrl, '_blank');

              return (
                <div 
                  key={msg.id} 
                  className={`flex w-full items-end gap-2 ${isSender ? 'justify-end' : 'justify-start'} ${isContinuingBlock ? 'mt-0.5' : 'mt-2'} group`}
                  data-message-type={isMediaOnly ? 'media' : hasBoth ? 'media-text' : 'text'}
                >
                  {chatDetails?.participantInfo.length > 2 && !isSender && !isContinuingBlock && (
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      {otherParticipant?.avatarUrl ? (
                        <AvatarImage src={otherParticipant.avatarUrl} alt={otherParticipantFirstName} />
                      ) : (
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                          {otherParticipantInitial}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  )}
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className={cn(bubblePadding, bubbleStyles)}>
                        {/* Media Content */}
                        {hasMedia && (
                          <div className={cn(
                            "relative mb-1.5 overflow-hidden rounded-lg",
                            hasText && "border border-border/50"
                          )}>
                            <div className="w-full">
                              {msg.mediaType === 'voice' ? (
                                <div className={cn("w-full max-w-[350px] rounded-xl p-3", isSender ? 'bg-muted/30' : 'bg-[#d97a1a]/20')}>
                                  <MediaMessage 
                                    src={msg.mediaUrl!}
                                    alt="Voice message"
                                    isVoice={true}
                                    isSender={isSender}
                                    voiceDuration={msg.voiceDuration}
                                    className="w-full"
                                  />
                                </div>
                              ) : (
                                <MediaMessage 
                                  src={msg.mediaUrl!}
                                  alt={msg.text || 'Chat media'}
                                  isGif={msg.mediaUrl?.toLowerCase().endsWith('.gif')}
                                  onClick={() => window.open(msg.mediaUrl, '_blank')}
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Text Content */}
                        {hasText && (
                          <div className="break-words">
                            <p className={cn(
                              "text-sm whitespace-pre-wrap",
                              hasMedia && "px-2 pb-1.5",
                              !isSender && hasMedia && "text-foreground",
                              isSender && hasMedia && "text-foreground"
                            )}>
                              {msg.text}
                            </p>
                          </div>
                        )}

                        {/* Timestamp and Read Receipt */}
                        <div className={cn(
                          "flex items-center gap-1 mt-0.5",
                          isSender ? "justify-end" : "justify-start",
                          hasText && !hasMedia && "pt-1"
                        )}>
                          <p className={cn(
                            "text-[10px] opacity-70",
                            isSender 
                              ? hasMedia ? "text-foreground/70" : "text-primary-foreground/80"
                              : hasMedia ? "text-foreground/70" : "text-white/70"
                          )}>
                            {messageTimestamp && formatDistanceToNowStrict(messageTimestamp, { addSuffix: true })}
                          </p>
                          {isSender && (
                            <span className="ml-0.5">
                              {msg.status === 'read' ? (
                                <CheckCheck className="h-3 w-3 text-blue-400" />
                              ) : (
                                <Check className="h-3 w-3 opacity-50" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </DropdownMenuTrigger>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Floating Input Area with Linear Blur */}
      <footer className="fixed bottom-0 left-0 right-0 z-50">
        <div className="relative">
          <LinearBlur
            steps={8}
            strength={64}
            falloffPercentage={100}
            tint="rgba(0, 0, 0, 0.7)"
            side="bottom"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '120px',
              zIndex: -1
            }}
          />
          <div className="max-w-3xl mx-auto p-4">

            {filePreviewUrl && (
              <div className="relative mb-3 max-w-xs">
                <div className="relative">
                  <Image
                    src={filePreviewUrl}
                    alt="Preview"
                    width={200}
                    height={200}
                    className="rounded-md object-cover h-32 w-auto"
                  />
                  <button
                    type="button"
                    onClick={removeFile}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm hover:bg-destructive/90"
                  >
                    <XIcon className="h-4 w-4" />
                    <span className="sr-only">Remove</span>
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex items-end gap-3">
              <div className={cn(
                'flex-1 transition-all duration-200 flex items-center',
                isVoiceRecording || voiceRecordingBlob 
                  ? 'bg-[#1a1a1a] border-2 border-gray-500/60 rounded-3xl shadow-lg px-4 h-12 text-white' 
                  : ''
              )}>
                {isVoiceRecording ? (
                  /* Show recording UI */
                  <div className="flex items-center w-full h-8">
                    <VoiceRecorder 
                      ref={voiceRecorderRef}
                      onRecordingComplete={handleVoiceRecordingComplete}
                      onCancel={handleCancelVoiceRecording}
                      compact={true}
                    />
                  </div>
                ) : voiceRecordingBlob ? (
                  /* Show preview UI */
                  <div className="flex items-center w-full h-8">
                    <AudioPlayer 
                      src={URL.createObjectURL(voiceRecordingBlob)} 
                      className="flex-1" 
                      duration={(voiceRecordingBlob as any).duration || 1}
                      compact={true}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleCancelVoiceRecording}
                      className="h-8 w-8 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  /* Show regular input when not recording */
                  <div className="relative flex-1">
                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    
                    {/* GIF Picker */}
                    {showGifPicker && (
                      <div 
                        ref={gifPickerRef}
                        className="absolute bottom-full right-0 mb-2 z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GifPicker 
                          onSelect={handleGifSelect} 
                          onClose={() => setShowGifPicker(false)}
                          isOpen={showGifPicker}
                        />
                      </div>
                    )}
                    
                    <div className="relative group">
                      {/* Left side buttons (GIF) */}
                      <div className="absolute left-2 bottom-2 z-10 flex items-center space-x-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowGifPicker(prev => !prev);
                          }}
                          disabled={sendingMessage}
                          className={`h-8 w-8 rounded-full p-0 opacity-50 hover:opacity-100 transition-opacity ${
                            showGifPicker ? 'opacity-100 bg-accent' : ''
                          }`}
                          aria-expanded={showGifPicker}
                          aria-haspopup="true"
                        >
                          <StickyNote className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Textarea */}
                      <Textarea
                        ref={textareaRef}
                        value={newMessage}
                        onChange={handleTextareaInput}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Type a message..."
                        className="resize-none pl-10 pr-24 py-2.5 rounded-3xl border-2 bg-[#1a1a1a] border-gray-500/60 text-white shadow-lg"
                        style={{
                          height: 'auto',
                          minHeight: '48px',
                          maxHeight: '152px',
                          overflowY: 'hidden',
                        }}
                        rows={1}
                        disabled={sendingMessage}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          const newHeight = Math.min(target.scrollHeight, 152);
                          target.style.height = `${newHeight}px`;
                          target.style.overflowY = newHeight >= 152 ? 'auto' : 'hidden';
                        }}
                      />
                      
                      {/* Right side button (Upload) */}
                      <div className="absolute right-2 bottom-2 z-10">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={sendingMessage}
                          className="h-8 w-8 rounded-full p-0 opacity-50 hover:opacity-100 transition-opacity"
                          title="Attach file"
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Send/Record Button - Changes based on input state */}
              <div className="relative">
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  onClick={async () => {
                    if (voiceRecordingBlob) {
                      // If there's a recorded voice message, send it
                      handleSendVoiceMessage();
                    } else if (isVoiceRecording) {
                      // If recording is active, stop the recording
                      if (voiceRecorderRef.current) {
                        voiceRecorderRef.current.stopRecording();
                      } else {
                        // Fallback to the cancel handler if we can't access the ref
                        handleCancelVoiceRecording();
                      }
                    } else if (newMessage.trim() || selectedFile) {
                      handleSendMessage();
                    } else {
                      setIsVoiceRecording(true);
                    }
                  }}
                  disabled={sendingMessage}
                  className={`h-12 w-12 rounded-full transition-all duration-200 ${
                    isVoiceRecording
                      ? 'bg-red-500 hover:bg-red-600' // Red when recording
                      : voiceRecordingBlob
                        ? 'bg-green-500 hover:bg-green-600' // Green when ready to send voice message
                        : newMessage.trim() || selectedFile
                          ? 'bg-orange-500 hover:bg-orange-600' // Orange when sending text/image
                          : 'bg-[#1a1a1a] hover:bg-[#2a2a2a] border-2 border-gray-500/60' // Dark gray when idle
                  }`}
                  title={isVoiceRecording 
                    ? "Stop recording" 
                    : voiceRecordingBlob 
                      ? "Send voice message" 
                      : newMessage.trim() || selectedFile 
                        ? "Send message" 
                        : "Record voice message"
                  }
                >
                  {sendingMessage ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : isVoiceRecording ? (
                    <div className="h-5 w-5 bg-white rounded-sm" /> // White square when recording
                  ) : voiceRecordingBlob ? (
                    <Send className="h-5 w-5 text-white" /> // Send icon when voice message is ready
                  ) : newMessage.trim() || selectedFile ? (
                    <Send className="h-5 w-5 text-white" />
                  ) : (
                    <Mic className="h-5 w-5 text-white" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

