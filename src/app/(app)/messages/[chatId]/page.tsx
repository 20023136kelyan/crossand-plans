
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, ChevronLeft, Loader2, UserCircle, Paperclip, XCircle as XIcon, EyeOff, MoreVertical, Phone, Video,
  ShieldCheck, CheckCircle as CheckCircleIcon // Added for VerificationBadge
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { getChatDetails, getChatMessages } from '@/services/chatService';
import { sendMessageAction, markChatAsReadAction, hideMessageForUserAction } from '@/app/actions/chatActions';
import type { Chat, ChatMessage, UserProfile, UserRoleType, ChatParticipantInfo } from '@/types/user';
import { useAuth } from '@/context/AuthContext';
import NextImage from 'next/image';
import { parseISO, isValid, formatDistanceToNowStrict } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, commonImageExtensions } from "@/lib/utils";

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
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [locallyHiddenMessageIds, setLocallyHiddenMessageIds] = useState<Set<string>>(new Set());

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
        setFooterHeight(entry.target.offsetHeight);
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
    const currentChatId = chatId; // Capture chatId at the time of callback definition
    const currentUser = user; // Capture user
    const currentChatDetails = chatDetailsRef.current; // Use ref
    const currentMessages = messagesRef.current; // Use ref

    if (!currentChatId || !currentUser || !currentChatDetails || !currentMessages) return;
    
    const lastMsg = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1] : null;
    if (!lastMsg || lastMsg.senderId === currentUser.uid) return;

    const lastMsgTimeISO = typeof lastMsg.timestamp === 'string' ? lastMsg.timestamp : (lastMsg.timestamp as Date)?.toISOString();
    if (!lastMsgTimeISO || !isValid(parseISO(lastMsgTimeISO))) return;
    
    const lastMsgTime = parseISO(lastMsgTimeISO).getTime();
    const userReadTimestampISO = currentChatDetails.participantReadTimestamps?.[currentUser.uid] as string | undefined;
    const userReadTime = userReadTimestampISO && isValid(parseISO(userReadTimestampISO)) 
        ? parseISO(userReadTimestampISO).getTime() : 0;

    if (lastMsgTime > userReadTime) { 
      try {
        const idToken = await currentUser.getIdToken(true);
        await markChatAsReadAction(currentChatId, idToken);
      } catch (err: any) {
        console.error("[ChatPage] Failed to mark chat as read via action:", err.message);
        // Optionally, toast an error here if needed, but often this is a background task
      }
    }
  }, [chatId, user]); // Stable dependencies

  // Effect for fetching chat details
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
      initialMarkAsReadDoneRef.current = false; 
      setLoadingChat(true);
      getChatDetails(chatId)
        .then(details => {
          if (details && details.participants.includes(user.uid)) {
            setChatDetails(details);
          } else {
            toast({ title: "Error", description: "Chat not found or you do not have access.", variant: "destructive" });
            router.push('/messages');
          }
        })
        .catch(error => {
          console.error("[ChatPage] Error from getChatDetails:", error);
          toast({ title: "Error", description: "Could not load chat details.", variant: "destructive" });
          router.push('/messages');
        })
        .finally(() => {
           setLoadingChat(false); 
        });
    } else {
      setLoadingChat(false);
    }
  }, [chatId, user?.uid, authLoading, router, toast]);


  // Effect for subscribing to messages
  useEffect(() => {
    if (!chatId || !user?.uid || !chatDetails /* Ensure chatDetails is loaded first */) return () => {}; 
    
    const unsubscribe = getChatMessages(chatId, (fetchedMessages) => {
      const newMessagesArrived = fetchedMessages.length > messagesRef.current.length;
      setMessages(fetchedMessages); 

      if (newMessagesArrived && fetchedMessages.length > 0 && user?.uid) {
        const lastMsg = fetchedMessages[fetchedMessages.length - 1];
        if (lastMsg.senderId !== user.uid) { 
          handleMarkChatAsRead(); 
        }
      }
    });
    return () => unsubscribe();
  }, [chatId, user?.uid, chatDetails, handleMarkChatAsRead]); 

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  },[]);

  // Effect for scrolling and initial mark as read
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const scrollBehavior = (lastMessage?.senderId === user?.uid && initialMarkAsReadDoneRef.current) ? "smooth" : "auto";
      scrollToBottom(scrollBehavior);
    }
    
    // Only attempt initial mark as read if not loading, chat details and messages are present, and it hasn't been done yet.
    if (!loadingChat && chatDetails && messages.length > 0 && !initialMarkAsReadDoneRef.current && user?.uid) {
      handleMarkChatAsRead(); 
      initialMarkAsReadDoneRef.current = true;
    }
  }, [messages, loadingChat, chatDetails, user?.uid, scrollToBottom, handleMarkChatAsRead]);


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
        toast({ title: "File too large", description: "Image size should not exceed 5MB.", variant: "destructive" });
        if(fileInputRef.current) fileInputRef.current.value = "";
        setSelectedFile(null);
        if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
        setFilePreviewUrl(null);
        return;
      }
      
      let isValidClientSide = false;
      const clientMimeType = file.type;
      const fileName = file.name;
      const fileExtension = fileName.split('.').pop()?.toLowerCase();

      if (clientMimeType && clientMimeType.startsWith('image/')) {
          isValidClientSide = true;
      } else if (fileExtension && commonImageExtensions.includes(fileExtension)) {
          isValidClientSide = true;
      }

      if (!isValidClientSide) {
         toast({ title: "Invalid file type", description: `Please select an image (JPG, PNG, GIF, WEBP, etc). Detected: ${clientMimeType || 'unknown'}. File: ${fileName}`, variant: "destructive" });
         if(fileInputRef.current) fileInputRef.current.value = ""; 
         setSelectedFile(null);
         if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
         setFilePreviewUrl(null);
         return;
      }

      setSelectedFile(file);
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    if(fileInputRef.current) fileInputRef.current.value = ""; 
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !user || !chatId || !currentUserProfile) return;
    if (sendingMessage) return;
    
    setSendingMessage(true);
    
    const formData = new FormData();
    if (newMessage.trim()) formData.append('text', newMessage.trim());
    if (selectedFile) formData.append('image', selectedFile, selectedFile.name);

    const tempMessageText = newMessage.trim();
    
    setNewMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    const tempSelectedFile = selectedFile; 
    removeSelectedFile(); 

    try {
      const idToken = await user.getIdToken(true); 
      if (!idToken) {
        toast({ title: "Authentication Error", description: "Could not get authentication token. Please try again.", variant: "destructive"});
        setNewMessage(tempMessageText); 
        setSelectedFile(tempSelectedFile); 
        if (tempSelectedFile) setFilePreviewUrl(URL.createObjectURL(tempSelectedFile));
        throw new Error("ID Token not available");
      }
      const result = await sendMessageAction(chatId, formData, idToken); 
      if (!result.success) {
        toast({ title: "Error Sending Message", description: result.error || "Could not send message.", variant: "destructive" });
        setNewMessage(tempMessageText); 
        setSelectedFile(tempSelectedFile);
        if (tempSelectedFile) setFilePreviewUrl(URL.createObjectURL(tempSelectedFile));
      }
    } catch (error: any) {
      toast({ title: "Send Error", description: error.message || "Could not send message.", variant: "destructive" });
      setNewMessage(tempMessageText);
      setSelectedFile(tempSelectedFile);
      if (tempSelectedFile) setFilePreviewUrl(URL.createObjectURL(tempSelectedFile));
    } finally {
      setSendingMessage(false);
    }
  };
  
  const handleTextareaInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(event.target.value);
    const textarea = event.target;
    textarea.style.height = 'auto'; 
    const newScrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(newScrollHeight, 120)}px`;
    // Footer height update is now primarily handled by ResizeObserver
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

  if (authLoading || (loadingChat && !chatDetails)) { 
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const otherParticipant = chatDetails?.participantInfo?.find(p => p.uid !== user?.uid);
  const otherParticipantFirstName = otherParticipant?.name?.split(' ')[0] || 'User';
  const otherParticipantInitial = otherParticipantFirstName ? otherParticipantFirstName.charAt(0).toUpperCase() : (otherParticipant?.uid ? otherParticipant.uid.charAt(0).toUpperCase() : <UserCircle className="h-5 w-5" />);

  return (
    <div className="relative h-full flex flex-col bg-background overflow-hidden">
      <header 
        className="absolute top-0 left-0 right-0 shrink-0 flex items-center p-3 border-b border-muted-foreground/50 bg-background z-20 shadow-sm"
        style={{ height: `${HEADER_HEIGHT_PX}px` }}
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2 text-foreground hover:bg-foreground/10">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        {otherParticipant ? (
           <Avatar className="h-9 w-9 mr-3">
            {otherParticipant.avatarUrl ? (
              <AvatarImage src={otherParticipant.avatarUrl} alt={otherParticipantFirstName} />
            ) : (
              <AvatarFallback className="text-sm bg-muted text-muted-foreground">{otherParticipantInitial}</AvatarFallback>
            )}
          </Avatar>
        ) : (
           <Avatar className="h-9 w-9 mr-3"><AvatarFallback className="text-sm bg-muted text-muted-foreground">?</AvatarFallback></Avatar>
        )}
        <div className="flex-1 min-w-0">
            <div className="font-semibold flex items-center text-foreground text-md truncate">
                {otherParticipantFirstName}
                {otherParticipant && <VerificationBadge role={otherParticipant.role} isVerified={otherParticipant.isVerified} />}
            </div>
            <p className="text-xs text-muted-foreground">Last seen recently</p>
        </div>
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-foreground hover:bg-foreground/10" aria-label="Call">
                <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-foreground hover:bg-foreground/10" aria-label="Video Call">
                <Video className="h-5 w-5" />
            </Button>
        </div>
      </header>

      <main 
        className={cn(
          "absolute left-0 right-0 overflow-y-auto p-4 space-y-3 bg-card z-10", 
          "custom-scrollbar-vertical"
        )}
        style={{ top: `${HEADER_HEIGHT_PX}px`, bottom: `${footerHeight}px` }}
      >
        {filteredAndVisibleMessages.map((msg, idx) => {
          if (!user) return null; 
          const messageTimestampString = typeof msg.timestamp === 'string' ? msg.timestamp : (msg.timestamp as Date)?.toISOString();
          const messageTimestamp = messageTimestampString && isValid(parseISO(messageTimestampString))
            ? parseISO(messageTimestampString)
            : null;

          const isSender = msg.senderId === user.uid;
          const prevMessage = filteredAndVisibleMessages[idx-1];
          
          const isSameSenderAndMinute = (prev: ChatMessage | undefined, current: ChatMessage): boolean => {
            if (!prev || !current) return false;
            if (prev.senderId !== current.senderId) return false;
            const prevTs = typeof prev.timestamp === 'string' && isValid(parseISO(prev.timestamp)) ? parseISO(prev.timestamp) : null;
            const currentTs = typeof current.timestamp === 'string' && isValid(parseISO(current.timestamp)) ? parseISO(current.timestamp) : null;
            return prevTs && currentTs && prevTs.getMinutes() === currentTs.getMinutes() && prevTs.getHours() === currentTs.getHours() && prevTs.getDate() === currentTs.getDate();
          };
          
          const showAvatar = !isSender && (!prevMessage || prevMessage.senderId !== msg.senderId || !isSameSenderAndMinute(prevMessage, msg));
          const isContinuingBlock = isSameSenderAndMinute(prevMessage, msg);

          const bubblePadding = (msg.mediaUrl && !msg.text) ? "p-1.5" : "px-3.5 py-2.5";
          const roundedCorners = cn(
            "rounded-2xl", 
            isSender ? (isContinuingBlock ? "rounded-tr-md rounded-br-lg" : "rounded-br-md") : (isContinuingBlock ? "rounded-tl-md rounded-bl-lg" : "rounded-bl-md")
          );
          
          return (
            <div key={msg.id} className={`flex w-full items-end gap-2 ${isSender ? 'justify-end' : 'justify-start'} ${isContinuingBlock ? 'mt-0.5' : 'mt-2'} group`}>
              {!isSender && (
                showAvatar && otherParticipant ? (
                  <Avatar className="h-7 w-7 self-end mb-1 flex-shrink-0">
                    {otherParticipant.avatarUrl ? (
                        <AvatarImage src={otherParticipant.avatarUrl} alt={otherParticipantFirstName}/>
                    ) : (
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">{otherParticipantInitial}</AvatarFallback>
                    )}
                  </Avatar>
                ) : (<div className="w-7 h-7 flex-shrink-0"></div>) 
              )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className={cn(
                      bubblePadding, roundedCorners, "shadow-md max-w-[70%] sm:max-w-[65%] break-words group-hover:bg-opacity-80 cursor-pointer",
                      isSender ? 'bg-gradient-to-r from-[hsl(var(--button-primary-gradient-start))] to-[hsl(var(--button-primary-gradient-end))] text-primary-foreground group-hover:opacity-90' 
                               : 'bg-card text-foreground group-hover:bg-card/80'
                    )}>
                      {msg.mediaUrl && (
                        <div 
                          className={cn("relative w-full rounded-md overflow-hidden cursor-pointer active:opacity-70 transition-opacity", msg.text ? "mb-1.5" : "mb-0")} 
                          onClick={(e) => { e.stopPropagation(); window.open(msg.mediaUrl, '_blank'); }}
                        >
                           <NextImage 
                            src={msg.mediaUrl} alt="Chat image" 
                            width={280} height={350} 
                            style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain', maxHeight: '350px' }}
                            className="rounded-md" data-ai-hint="chat media"
                            unoptimized={!msg.mediaUrl?.startsWith('http') || msg.mediaUrl?.includes('placehold.co') || msg.mediaUrl.includes('firebasestorage.googleapis.com')} 
                          />
                        </div>
                      )}
                      {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                      {messageTimestamp && (
                        <p className={cn("text-[10px] opacity-70", (msg.mediaUrl && !msg.text) ? "mt-0.5" : "mt-1", isSender ? "text-primary-foreground/80 text-right" : "text-muted-foreground text-left")}>
                          {formatDistanceToNowStrict(messageTimestamp, { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isSender ? "end" : "start"} className="bg-popover text-popover-foreground">
                    <DropdownMenuItem onClick={() => handleHideMessage(msg.id)} className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                      <EyeOff className="mr-2 h-3.5 w-3.5" /> Hide for Me
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      <footer 
        ref={footerRef}
        className="absolute bottom-0 left-0 right-0 shrink-0 px-2.5 pt-2.5 pb-0 border-t border-muted-foreground/50 bg-background z-20 rounded-t-xl"
      >
        {filePreviewUrl && (
          <div className="mb-2 px-1 py-1.5 border border-border/30 rounded-md bg-card/50 relative w-fit shadow-sm">
            <NextImage src={filePreviewUrl} alt="Preview" width={50} height={50} className="rounded object-cover" data-ai-hint="upload preview"/>
            <Button
              variant="ghost" size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 text-muted-foreground hover:text-destructive bg-background/70 hover:bg-destructive/20 rounded-full shadow-md"
              onClick={removeSelectedFile} aria-label="Remove selected image" disabled={sendingMessage}
            ><XIcon className="h-4 w-4" /></Button>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-end gap-2 pb-1.5"> {/* Added pb-1.5 to form */}
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={sendingMessage}
            className="h-10 w-10 rounded-full flex-shrink-0 text-muted-foreground hover:text-primary" 
            aria-label={selectedFile ? "Change image" : "Attach image"}
          >
            {selectedFile ? <XIcon className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); removeSelectedFile(); }} /> : <Paperclip className="h-5 w-5" />}
          </Button>
          <input type="file" id="chat-file-input" ref={fileInputRef} onChange={handleFileSelect} accept="image/png, image/jpeg, image/gif, image/webp, image/*" className="hidden" />
          <Textarea
            ref={textareaRef} value={newMessage} onChange={handleTextareaInput}
            placeholder="Write a message" disabled={sendingMessage}
            className="text-sm flex-1 rounded-full py-2.5 px-4 min-h-[44px] max-h-[120px] resize-none custom-scrollbar-vertical bg-muted border-transparent focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/70" 
            rows={1}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
          />
          <Button 
            type="submit" 
            disabled={(!newMessage.trim() && !selectedFile) || sendingMessage} 
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0 bg-gradient-to-r from-[hsl(var(--button-primary-gradient-start))] to-[hsl(var(--button-primary-gradient-end))] hover:opacity-90 text-primary-foreground" 
            aria-label="Send message"
          >
            {sendingMessage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </footer>
    </div>
  );
}

