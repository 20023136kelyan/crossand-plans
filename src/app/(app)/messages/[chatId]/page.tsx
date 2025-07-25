'use client';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, ChevronLeft, Loader2, UserCircle, Paperclip, XCircle as XIcon, EyeOff, MoreVertical, Phone, Video,
  ShieldCheck, CheckCircle as CheckCircleIcon, MessageSquare, CheckCheck, Check, Image as ImageIcon
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
        
        // Real-time listener for messages
        const messagesQuery = query(collection(getDb(), 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
        const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
          const msgs: ChatMessage[] = [];
          snapshot.forEach((doc) => {
            msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
          });
          setMessages(msgs);
        }, (error) => {
          setMessages([]);
          toast({ title: 'Error loading messages', description: error.message || 'Could not load messages.', variant: 'destructive' });
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


  // Effect for subscribing to messages
  useEffect(() => {
    if (!chatId || !user?.uid || !chatDetails /* Ensure chatDetails is loaded first */) return () => {}; 
    
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

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB. Please choose a smaller image.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const fileType = file.type.toLowerCase();
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const isGif = fileType === 'image/gif' || fileExtension === 'gif';
    const isValidType = validTypes.includes(fileType) || 
                       ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
    
    // Validate file size (5MB max for images, 10MB for GIFs)
    const maxSizeForGif = 10 * 1024 * 1024; // 10MB for GIFs
    const isValidSize = isGif ? file.size <= maxSizeForGif : file.size <= maxSize;

    if (!isValidType) {
      toast({
        title: 'Unsupported file type',
        description: 'Please upload an image file (JPEG, PNG, GIF, or WebP).',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidSize) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${isGif ? '10MB' : '5MB'}. Please choose a smaller image.`,
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
    setGifUrl(gifUrl);
    // Auto-send the GIF when selected
    handleSendMessage(undefined, gifUrl);
  };

  const handleSendMessage = async (e?: React.FormEvent, gifUrlToSend?: string) => {
    if (e) e.preventDefault();
    const gifToSend = gifUrlToSend || gifUrl;
    if ((!newMessage.trim() && !selectedFile && !gifToSend) || !user) return;

    setSendingMessage(true);
    
    // Create form data with message and file
    const formData = new FormData();
    if (newMessage.trim()) {
      formData.append('text', newMessage.trim());
    }
    
    // Add file if selected
    if (gifToSend) {
      // If sending a GIF, we send it as a special media URL
      formData.append('mediaUrl', gifToSend);
      formData.append('isGif', 'true');
      setGifUrl(null); // Clear the GIF URL after sending
    } else if (selectedFile) {
      formData.append('image', selectedFile, selectedFile.name);
    }

    // Store current state in case of failure
    const tempMessageText = newMessage.trim();
    const tempSelectedFile = selectedFile;
    
    // Reset form
    setNewMessage('');
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
      
      // Clear the selected file after successful send
      setSelectedFile(null);
      
    } catch (error: any) {
      console.error('Error sending message:', error);
      
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

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground overflow-hidden">
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
        className="flex-1 overflow-y-auto p-4 space-y-2"
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
                "shadow-md max-w-[70%] sm:max-w-[65%] break-words group-hover:bg-opacity-80 cursor-pointer",
                "transition-all duration-200",
                hasMedia && 'bg-transparent shadow-none',
                isTextOnly && isSender && 'bg-[#23232a] text-primary-foreground group-hover:opacity-90',
                isTextOnly && !isSender && 'bg-[#3b82f6] text-white group-hover:bg-[#2563eb]',
                hasBoth && 'bg-transparent',
                isSender ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md',
                isContinuingBlock && (isSender ? 'rounded-tr-md rounded-br-lg' : 'rounded-tl-md rounded-bl-lg')
              );

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
                              <MediaMessage 
                                src={msg.mediaUrl!}
                                alt={msg.text || 'Chat media'}
                                isGif={msg.mediaUrl?.toLowerCase().endsWith('.gif')}
                                onClick={() => window.open(msg.mediaUrl, '_blank')}
                              />
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
                    <DropdownMenuContent align={isSender ? "end" : "start"} className="bg-popover text-popover-foreground">
                      <DropdownMenuItem 
                        onClick={() => handleHideMessage(msg.id)} 
                        className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                      >
                        <EyeOff className="mr-2 h-3.5 w-3.5" /> Hide for Me
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Sticky Input Area */}
      <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3">
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
        
        <div className="flex items-end gap-2 relative">
            {/* GIF Picker */}
            <div 
              ref={gifPickerRef}
              className={`absolute bottom-full right-0 mb-2 z-50 transition-all duration-200 ${showGifPicker ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <GifPicker 
                onSelect={handleGifSelect} 
                onClose={() => setShowGifPicker(false)}
              />
            </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={sendingMessage}
            className="shrink-0 h-10 w-10"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setShowGifPicker(prev => !prev);
            }}
            disabled={sendingMessage}
            className={`shrink-0 h-10 w-10 relative ${showGifPicker ? 'bg-accent' : ''}`}
            aria-expanded={showGifPicker}
            aria-haspopup="true"
          >
            <ImageIcon className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">GIF</span>
          </Button>
          <div className="flex-1 relative">
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
              className="min-h-[40px] max-h-32 resize-none pr-12"
              rows={1}
              disabled={sendingMessage}
            />
          </div>
          
          <Button
            type="button"
            size="icon"
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedFile) || sendingMessage}
            className="shrink-0 h-10 w-10"
          >
            {sendingMessage ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}

