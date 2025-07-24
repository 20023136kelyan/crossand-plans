'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MessageCircle, Search, UserPlus, Send, Loader2, ShieldCheck as AdminIcon, CheckCircle, Trash2, MoreVertical, Users as ManageFriendsIcon, XCircle, Plus, Pin, MessageCircleIcon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from 'next/link';
import { useEffect, useState, useMemo, useCallback, useRef, useReducer } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Chat, FriendEntry, UserProfile, UserRoleType, SearchedUser } from '@/types/user';
import { formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

function formatCompactTime(date: Date): string {
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'now';
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
  if (diffInMinutes < 43200) return `${Math.floor(diffInMinutes / 1440)}d`;
  return `${Math.floor(diffInMinutes / 43200)}mo`;
}
import { FriendPickerDialog } from '@/components/messages/FriendPickerDialog';
import { 
  initiateDirectChatAction, 
  deleteChatAction,
} from '@/app/actions/chatActions'; 
import {
  searchUsersAction
} from '@/app/actions/userActions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { getUserChats } from '@/services/clientServices';

interface RawBasicUserInfo {
  uid: string;
  name: string | null;
  avatarUrl: string | null;
}

// Add type definition for friendship status
type FriendStatus = 'friends' | 'pending_sent' | 'pending_received';
type ExtendedFriendStatus = FriendStatus | 'not_friends' | 'is_self';

interface SearchedUserWithStatus extends SearchedUser {
  friendshipStatus: ExtendedFriendStatus;
}

const VerificationBadge = ({ role, isVerified }: { role: UserRoleType | null, isVerified: boolean }) => {
  if (role === 'admin') {
    return <AdminIcon className="ml-1 h-3.5 w-3.5 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <CheckCircle className="ml-1 h-3.5 w-3.5 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified" />;
  }
  return null;
};

// Define action types for the search reducer
type SearchAction =
  | { type: 'START_SEARCH' }
  | { type: 'SEARCH_SUCCESS'; results: SearchedUserWithStatus[] }
  | { type: 'SEARCH_ERROR'; error: string }
  | { type: 'CLEAR_SEARCH' };

type SearchState = {
  results: SearchedUserWithStatus[];
  loading: boolean;
  error: string | null;
};

// Search reducer function
function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'START_SEARCH':
      return { ...state, loading: true, error: null };
    case 'SEARCH_SUCCESS':
      return { loading: false, results: action.results, error: null };
    case 'SEARCH_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'CLEAR_SEARCH':
      return { loading: false, results: [], error: null };
    default:
      return state;
  }
}

type SearchResult = {
  success: boolean;
  users?: SearchedUser[];
  error?: string;
};

// Separate component for the manage friends dialog
function ManageFriendsDialog({
  open,
  onOpenChange,
  friends,
  pendingReceived,
  pendingSent,
  friendshipsLoading,
  onFriendAction,
  friendActionLoading,
  searchTerm,
  onSearchTermChange,
  searchResults,
  searchLoading
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friends: FriendEntry[];
  pendingReceived: FriendEntry[];
  pendingSent: FriendEntry[];
  friendshipsLoading: boolean;
  onFriendAction: (action: 'send' | 'accept' | 'decline' | 'cancel' | 'remove', user: SearchedUser | FriendEntry) => Promise<void>;
  friendActionLoading: boolean;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  searchResults: SearchedUserWithStatus[];
  searchLoading: boolean;
}) {
  const { user } = useAuth();

  // Memoize the dialog content to prevent unnecessary re-renders
  const dialogContent = useMemo(() => (
    <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0">
      <DialogHeader className="p-6 pb-4 border-b">
        <DialogTitle>Manage Contacts</DialogTitle>
        <DialogDescription>Find new people or manage existing connections.</DialogDescription>
      </DialogHeader>
      <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar-vertical">
        <section>
          <h4 className="text-md font-semibold mb-1.5 text-foreground/80">Find New People</h4>
          <div className="flex gap-2 mb-3">
            <Input
              type="search"
              placeholder="Search by email or phone..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          {searchLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar-vertical">
              {searchResults.map(su => (
                <div key={su.uid} className="flex items-center justify-between p-2 rounded-md bg-secondary/30 hover:bg-secondary/50">
                  <Link href={`/users/${su.uid}`} className="flex items-center gap-2 flex-grow min-w-0 hover:opacity-80 transition-opacity" onClick={() => onOpenChange(false)}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={su.avatarUrl || undefined} alt={su.name || 'User'} data-ai-hint="person avatar" />
                      <AvatarFallback>{su.name ? su.name.charAt(0).toUpperCase() : (su.email ? su.email.charAt(0).toUpperCase() : 'U')}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-xs" title={su.name || su.email || undefined}>{su.name || su.email}</span>
                    <VerificationBadge role={su.role || null} isVerified={su.isVerified || false} />
                  </Link>
                  <div className="ml-2 flex-shrink-0">
                    {su.uid === user?.uid ? (
                      <Badge variant="outline" className="text-xs whitespace-nowrap">You</Badge>
                    ) : su.friendshipStatus === 'friends' ? (
                      <Badge variant="default" className="text-xs whitespace-nowrap">Friends</Badge>
                    ) : su.friendshipStatus === 'pending_sent' ? (
                      <Button size="sm" variant="outline" onClick={() => onFriendAction('cancel', su)} disabled={friendActionLoading}>
                        <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel
                      </Button>
                    ) : su.friendshipStatus === 'pending_received' ? (
                      <Button size="sm" onClick={() => onFriendAction('accept', su)} disabled={friendActionLoading}>
                        <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Accept
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => onFriendAction('send', su)} disabled={friendActionLoading}>
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : searchTerm.trim().length >= 2 && !searchLoading && (
            <p className="text-sm text-muted-foreground text-center py-2">No users found matching "{searchTerm}"</p>
          )}
        </section>

        <Separator />

        {friendshipsLoading ? (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {pendingReceived.length > 0 && (
              <section>
                <h4 className="text-md font-semibold mb-2 text-foreground/80">Friend Requests ({pendingReceived.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar-vertical">
                  {pendingReceived.map(req => (
                    <div key={req.friendUid} className="flex items-center justify-between p-2 rounded-md bg-secondary/30 hover:bg-secondary/50">
                      <Link href={`/users/${req.friendUid}`} className="flex items-center gap-2 flex-grow min-w-0 hover:opacity-80 transition-opacity" onClick={() => onOpenChange(false)}>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={req.avatarUrl || undefined} alt={req.name || 'User'} data-ai-hint="person avatar"/>
                          <AvatarFallback>{req.name ? req.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate max-w-[120px] sm:max-w-xs" title={req.name || undefined}>{req.name || 'User'}</span>
                        <VerificationBadge role={req.role || null} isVerified={req.isVerified || false} />
                      </Link>
                      <div className="flex gap-2 flex-shrink-0 ml-2">
                        <Button size="sm" onClick={() => onFriendAction('accept', req)} disabled={friendActionLoading}>
                          <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Accept
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onFriendAction('decline', req)} disabled={friendActionLoading}>
                          <XCircle className="mr-1.5 h-3.5 w-3.5" /> Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(pendingReceived.length > 0 && (friends.length > 0 || pendingSent.length > 0)) && <Separator />}

            {friends.length > 0 && (
              <section>
                <h4 className="text-md font-semibold mb-2 text-foreground/80">Your Friends ({friends.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar-vertical">
                  {friends.map(friend => (
                    <div key={friend.friendUid} className="flex items-center justify-between p-2 rounded-md bg-secondary/30 hover:bg-secondary/50">
                      <Link href={`/users/${friend.friendUid}`} className="flex items-center gap-2 flex-grow min-w-0 hover:opacity-80 transition-opacity" onClick={() => onOpenChange(false)}>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={friend.avatarUrl || undefined} alt={friend.name || 'User'} data-ai-hint="person avatar"/>
                          <AvatarFallback>{friend.name ? friend.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-xs" title={friend.name || undefined}>{friend.name || 'User'}</span>
                        <VerificationBadge role={friend.role || null} isVerified={friend.isVerified || false} />
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-2 flex-shrink-0"
                        onClick={() => onFriendAction('remove', friend)}
                        disabled={friendActionLoading}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Unfriend
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {((friends.length > 0 && pendingSent.length > 0) || (pendingReceived.length > 0 && pendingSent.length > 0 && friends.length === 0)) && <Separator />}

            {pendingSent.length > 0 && (
              <section>
                <h4 className="text-md font-semibold mb-2 text-foreground/80">Sent Requests ({pendingSent.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar-vertical">
                  {pendingSent.map(req => (
                    <div key={req.friendUid} className="flex items-center justify-between p-2 rounded-md bg-secondary/30 hover:bg-secondary/50">
                      <Link href={`/users/${req.friendUid}`} className="flex items-center gap-2 flex-grow min-w-0 hover:opacity-80 transition-opacity" onClick={() => onOpenChange(false)}>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={req.avatarUrl || undefined} alt={req.name || 'User'} data-ai-hint="person avatar"/>
                          <AvatarFallback>{req.name ? req.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-xs" title={req.name || undefined}>{req.name || 'User'}</span>
                        <VerificationBadge role={req.role || null} isVerified={req.isVerified || false} />
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-2 flex-shrink-0"
                        onClick={() => onFriendAction('cancel', req)}
                        disabled={friendActionLoading}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {friends.length === 0 && pendingReceived.length === 0 && pendingSent.length === 0 && !friendshipsLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">Your contact list is empty. Search for users to connect!</p>
            )}
          </>
        )}
      </div>
      <DialogFooter className="p-6 pt-4 border-t">
        <DialogClose asChild>
          <Button type="button" variant="outline">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  ), [
    searchTerm,
    searchResults,
    searchLoading,
    friends,
    pendingReceived,
    pendingSent,
    friendshipsLoading,
    friendActionLoading,
    user,
    onOpenChange,
    onSearchTermChange,
    onFriendAction
  ]);

  // Use a basic dialog without animations
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      {dialogContent}
    </Dialog>
  );
}

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

export default function MessagesPage() {
  const { user, currentUserProfile, loading: authLoading } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [searchTermChats, setSearchTermChats] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const [isFriendPickerOpen, setIsFriendPickerOpen] = useState(false);
  const [isInitiatingChat, setIsInitiatingChat] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const [isManageFriendsDialogOpen, setIsManageFriendsDialogOpen] = useState(false);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [pendingReceived, setPendingReceived] = useState<FriendEntry[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendEntry[]>([]);
  const [friendshipsLoading, setFriendshipsLoading] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const unsubFriendshipsRef = useRef<(() => void) | null>(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedUserWithStatus[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const unsubFriendshipsSearchRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    if (authLoading) {
      setLoadingChats(true);
      return;
    }
    if (user?.uid) {
      setLoadingChats(true);
      // Timeout fallback: if listener doesn't fire in 3s, stop loading
      timeoutId = setTimeout(() => {
        setLoadingChats(false);
      }, 3000);
      unsubscribe = getUserChats(
        user.uid,
        (fetchedChats) => {
          setChats(fetchedChats);
          setLoadingChats(false);
          if (timeoutId) clearTimeout(timeoutId);
        },
        (error) => {
          setChats([]);
          setLoadingChats(false);
          if (timeoutId) clearTimeout(timeoutId);
          toast({ title: 'Error loading chats', description: error.message || 'Could not load chats.', variant: 'destructive' });
        }
      );
    } else {
      setChats([]);
      setLoadingChats(false);
    }
    return () => {
      if (unsubscribe) unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user?.uid, authLoading, toast]);

  // Effect to handle friendships subscription
  useEffect(() => {
    if (!user?.uid || !isManageFriendsDialogOpen) {
      return;
    }

    setFriendshipsLoading(true);

    try {
      // TODO: Replace with appropriate action calls or server functions
      // const unsubscribe = getFriendships(
      //   user.uid,
      //   (allFriendships: FriendEntry[]) => {
      //     setFriends(allFriendships.filter(f => f.status === 'friends'));
      //     setPendingReceived(allFriendships.filter(f => f.status === 'pending_received'));
      //     setPendingSent(allFriendships.filter(f => f.status === 'pending_sent'));
      //     setFriendshipsLoading(false);
      //   },
      //   (error: Error) => {
      //     console.error("Error fetching friendships", error);
      //     toast({ title: "Error", description: "Could not fetch friendships.", variant: "destructive" });
      //     setFriendshipsLoading(false);
      //   }
      // );

      unsubFriendshipsRef.current = () => {};

      // Cleanup subscription when dialog closes or component unmounts
      return () => {
        if (unsubFriendshipsRef.current) {
          unsubFriendshipsRef.current();
          unsubFriendshipsRef.current = null;
        }
        // Reset states when dialog closes
        setFriends([]);
        setPendingReceived([]);
        setPendingSent([]);
      };
    } catch (error) {
      console.error("Error setting up friendships listener", error);
      toast({ title: "Error", description: "Could not fetch friendships.", variant: "destructive" });
      setFriendshipsLoading(false);
    }
  }, [user?.uid, isManageFriendsDialogOpen, toast]);

  // Effect for search
  useEffect(() => {
    if (!isManageFriendsDialogOpen) {
      setSearchResults([]);
      setSearchTerm('');
      return;
    }

    const performSearch = async () => {
      if (!searchTerm.trim() || searchTerm.length < 2 || !user) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        // TODO: Replace with appropriate action calls or server functions
        // const idToken = await user.getIdToken(true);
        // const result = await searchUsersAction(searchTerm, idToken);
        
        // if (!result.success || !Array.isArray(result.users) || !result.users) {
        //   setSearchResults([]);
        //   if (result.error) {
        //     toast({ title: "Search Failed", description: result.error, variant: "destructive" });
        //   }
        //   return;
        // }

        // const searchUsers = result.users;

        // Clean up previous subscription if exists
        if (unsubFriendshipsSearchRef.current) {
          unsubFriendshipsSearchRef.current();
          unsubFriendshipsSearchRef.current = null;
        }

        // Get current friendships
        unsubFriendshipsSearchRef.current = () => {};
      } catch (error: any) {
        setSearchResults([]);
        toast({ title: "Search Error", description: error.message || "Could not search users.", variant: "destructive" });
      } finally {
        setSearchLoading(false);
      }
    };

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout
    searchTimeoutRef.current = setTimeout(performSearch, 500);

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (unsubFriendshipsSearchRef.current) {
        unsubFriendshipsSearchRef.current();
      }
    };
  }, [searchTerm, user, isManageFriendsDialogOpen, toast]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      if (unsubFriendshipsRef.current) {
        unsubFriendshipsRef.current();
      }
      if (unsubFriendshipsSearchRef.current) {
        unsubFriendshipsSearchRef.current();
      }
    };
  }, []);

  const filteredChats = useMemo(() => {
    if (!searchTermChats.trim()) return chats;
    return chats.filter(chat => {
      const otherParticipant = chat.participantInfo?.find(p => p.uid !== user?.uid);
      const chatName = chat.type === 'group' ? chat.groupName : (otherParticipant?.name ? otherParticipant.name.split(' ')[0] : 'User');
      return chatName?.toLowerCase().includes(searchTermChats.toLowerCase()) ||
             chat.lastMessageText?.toLowerCase().includes(searchTermChats.toLowerCase());
    });
  }, [chats, searchTermChats, user]);

  const getDisplayInfo = (chat: Chat): { uid: string, name: string, avatarUrl: string | null, initial: string | React.ReactNode, dataAiHint: string, role: UserRoleType | null, isVerified: boolean } => {
    if (chat.type === 'group') {
      return {
        uid: chat.id,
        name: chat.groupName || 'Group Chat',
        avatarUrl: chat.groupAvatarUrl || null,
        initial: chat.groupName ? chat.groupName.charAt(0).toUpperCase() : 'G',
        dataAiHint: 'group chat',
        role: null,
        isVerified: false,
      };
    }
    const otherParticipant = chat.participantInfo?.find(p => p.uid !== user?.uid);
    const fullName = otherParticipant?.name || 'User';
    const firstName = fullName.split(' ')[0];

    return {
      uid: otherParticipant?.uid || 'unknown',
      name: firstName,
      avatarUrl: otherParticipant?.avatarUrl || null,
      initial: firstName ? firstName.charAt(0).toUpperCase() : (otherParticipant?.uid ? otherParticipant.uid.charAt(0).toUpperCase() : <UserPlus className="h-5 w-5"/>),
      dataAiHint: 'person avatar',
      role: otherParticipant?.role || null,
      isVerified: otherParticipant?.isVerified || false,
    };
  };

  const handleFriendSelectForChat = useCallback(async (selectedFriend: FriendEntry) => {
    if (!currentUserProfile || !user) {
      toast({ title: "Error", description: "User profile not loaded. Please try again shortly.", variant: "destructive" });
      return;
    }
    setIsInitiatingChat(true);
    try {
      const chatUserInfo: RawBasicUserInfo = {
        uid: selectedFriend.friendUid,
        name: selectedFriend.name,
        avatarUrl: selectedFriend.avatarUrl
      };

      const currentUserInfo: RawBasicUserInfo = {
        uid: user.uid,
        name: currentUserProfile.name || null,
        avatarUrl: currentUserProfile.avatarUrl
      };

      const result = await initiateDirectChatAction(chatUserInfo, currentUserInfo);
      if (result.success && result.chatId) {
        router.push(`/messages/${result.chatId}`);
      } else {
        toast({ title: "Error", description: result.error || "Could not start chat.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not start chat.", variant: "destructive" });
    } finally {
      setIsInitiatingChat(false);
    }
  }, [user, currentUserProfile, router, toast]);

  const handleDeleteChatRequest = (chat: Chat) => {
    setChatToDelete(chat);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete || !user) return;
    setIsDeletingChat(true);
    try {
      // TODO: Replace with appropriate action calls or server functions
      // const idToken = await user.getIdToken(true);
      // if (!idToken) throw new Error("Authentication token not available for delete action.");
      // const result = await deleteChatAction(chatToDelete.id, idToken);
      if (true) {
        toast({ title: "Chat Deleted", description: "The chat has been successfully deleted." });
        setChats(prev => prev.filter(c => c.id !== chatToDelete.id));
      } else {
        toast({ title: "Error", description: "Could not delete chat.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error deleting chat:", error);
      toast({ title: "Error", description: error.message || "An unexpected error occurred while deleting chat.", variant: "destructive" });
    } finally {
      setIsDeletingChat(false);
      setShowDeleteConfirm(false);
      setChatToDelete(null);
    }
  };
  
  const handleFriendAction = useCallback(async (action: 'send' | 'accept' | 'decline' | 'cancel' | 'remove', targetUser: SearchedUser | FriendEntry) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to perform this action.", variant: "destructive" });
      return;
    }
    try {
      setFriendActionLoading(true);
      const targetUid = 'uid' in targetUser ? targetUser.uid : targetUser.friendUid;
      // TODO: Replace with appropriate action calls or server functions
      // const idToken = await user.getIdToken(true);
      // if (!idToken) throw new Error("Authentication token not available.");

      let result: { success: boolean; message?: string; error?: string } | undefined;
      switch (action) {
        case 'send':
          // TODO: Replace with appropriate action calls or server functions
          // result = await sendFriendRequestAction(targetUid, idToken);
          result = { success: false, error: "Action not implemented yet" };
          break;
        case 'accept':
          // TODO: Replace with appropriate action calls or server functions
          // result = await acceptFriendRequestAction(targetUid, idToken);
          result = { success: false, error: "Action not implemented yet" };
          break;
        case 'decline':
        case 'cancel':
          // TODO: Replace with appropriate action calls or server functions
          // result = await declineFriendRequestAction(targetUid, idToken);
          result = { success: false, error: "Action not implemented yet" };
          break;
        case 'remove':
          // TODO: Replace with appropriate action calls or server functions
          // result = await removeFriendAction(targetUid, idToken);
          result = { success: false, error: "Action not implemented yet" };
          break;
        default:
          throw new Error("Invalid friend action");
      }

      if (result?.success) {
        toast({ title: "Success", description: result.message || "Friend action successful." });
        // The real-time listener will update the state
      } else {
        toast({ title: "Error", description: result?.error || "Could not complete action.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to perform action.", variant: "destructive" });
    } finally {
      setFriendActionLoading(false);
    }
  }, [user, toast]);

  if (authLoading || (loadingChats && user)) {
    return (
      <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Dummy online users for demo (replace with real online logic)
  const onlineUsers = chats.slice(0, 5).map(chat => chat.participantInfo?.find(p => p.uid !== user?.uid)).filter(Boolean);

  // Dummy pinned messages (replace with real logic if needed)
  const pinnedChats = [];

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">Messages</h1>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsFriendPickerOpen(true)}
                className="p-2 rounded-full hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Start new chat"
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 19v-6m0 0V5m0 8H6m6 0h6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="border-t border-border/50 bg-background/50 px-4 py-3">
          <div className="relative max-w-4xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search messages..."
              className="w-full pl-9 pr-4 py-2 bg-muted/50 border-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={searchTermChats}
              onChange={(e) => setSearchTermChats(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Online Now */}
      <section className="border-b border-border bg-background/50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Online Now</span>
            <button 
              className="text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-1.5 py-0.5 -mr-1.5"
              onClick={() => {}}
            >
              See All
            </button>
          </div>
          
          <div className="relative">
            <div className="flex space-x-4 pb-1 -mx-1 overflow-x-auto hide-scrollbar">
              {onlineUsers.length === 0 ? (
                <div className="flex items-center justify-center w-full py-2">
                  <p className="text-sm text-muted-foreground">No contacts online</p>
                </div>
              ) : (
                onlineUsers.map((onlineUser, idx) => (
                  <div 
                    key={onlineUser?.uid || idx} 
                    className="flex flex-col items-center flex-shrink-0 w-14 group"
                  >
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full bg-muted overflow-hidden border-2 border-foreground/10 group-hover:border-primary/30 transition-colors">
                        {onlineUser?.avatarUrl ? (
                          <img 
                            src={onlineUser.avatarUrl} 
                            alt={onlineUser.name || 'User'} 
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-lg font-medium bg-muted text-foreground/80">
                            {onlineUser?.name?.charAt(0) || '?'}
                          </span>
                        )}
                      </div>
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background shadow-sm" />
                    </div>
                    <span className="mt-2 text-xs text-center font-medium text-foreground/90 truncate w-full px-1">
                      {onlineUser?.name?.split(' ')[0] || 'User'}
                    </span>
                  </div>
                ))
              )}
            </div>
            
            {/* Fade effect for scrollable content */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Pinned Conversations - Hidden when empty */}
      {pinnedChats.length > 0 && (
        <section className="bg-muted/30 border-y border-border/50">
          <div className="max-w-4xl mx-auto px-4 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-2 py-1.5">
              <Pin className="h-3.5 w-3.5 text-muted-foreground/80" />
              <span>Pinned Conversations</span>
            </div>
            <div className="space-y-1">
              {/* Pinned chat items would go here */}
            </div>
          </div>
        </section>
      )}

      {/* All Messages */}
      <section className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Section Header - Sticky */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50">
          <div className="max-w-4xl mx-auto px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-2">
              <MessageCircleIcon className="h-4 w-4 flex-shrink-0" />
              <span>All Messages</span>
              {filteredChats.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground/80">
                  {filteredChats.length} {filteredChats.length === 1 ? 'conversation' : 'conversations'}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Message List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
              <div className="bg-muted/50 rounded-full p-4 mb-4">
                <MessageCircleIcon className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-1.5">No messages yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Your conversations will appear here. Start a new chat to connect with others.
              </p>
              <Button 
                onClick={() => setIsFriendPickerOpen(true)}
                className="rounded-full px-6 shadow-sm"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Message
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {filteredChats.map((chat) => {
                const display = getDisplayInfo(chat);
                const lastMessageDate = getTimestampAsDate(chat.lastMessageTimestamp);
                const lastMessageTime = lastMessageDate ? 
                  formatDistanceToNowStrict(lastMessageDate, { addSuffix: true }) : '';
                // Calculate unread messages based on read timestamps
                const unreadCount = chat.participantReadTimestamps && user?.uid && chat.lastMessageSenderId !== user.uid &&
                  (!chat.participantReadTimestamps[user.uid] || 
                   (chat.lastMessageTimestamp && 
                    (typeof chat.lastMessageTimestamp === 'string' 
                      ? new Date(chat.lastMessageTimestamp).getTime() 
                      : chat.lastMessageTimestamp.toDate().getTime()) > 
                    (typeof chat.participantReadTimestamps[user.uid] === 'string' 
                      ? new Date(chat.participantReadTimestamps[user.uid] as string).getTime() 
                      : (chat.participantReadTimestamps[user.uid] as any)?.toDate?.().getTime() || 0)))
                  ? 1 // Show 1 unread if the last message is newer than the user's last read timestamp
                  : 0;
                const isPinned = false; // Replace with real pinned logic
                const isMuted = false; // Replace with real muted logic
                
                return (
                  <li 
                    key={chat.id} 
                    className="group hover:bg-muted/30 transition-colors"
                  >
                    <Link href={`/messages/${chat.id}`} className="block">
                      <div className="px-4 py-3 flex items-start gap-3 max-w-4xl mx-auto">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div className="h-12 w-12 rounded-full bg-muted/80 overflow-hidden border border-border/50 group-hover:border-border transition-colors">
                            {display.avatarUrl ? (
                              <img 
                                src={display.avatarUrl} 
                                alt={display.name} 
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-lg font-medium bg-muted text-foreground/80">
                                {typeof display.initial === 'string' ? display.initial : display.initial}
                              </span>
                            )}
                          </div>
                          {isPinned && (
                            <Pin className="absolute -top-1 -right-1 h-4 w-4 text-amber-500 rotate-45" />
                          )}
                        </div>
                        
                        {/* Message Preview */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-foreground truncate">
                              {display.name}
                              {display.role === 'admin' && (
                                <span className="ml-1.5 text-[10px] font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                  Admin
                                </span>
                              )}
                            </h3>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {lastMessageTime}
                              </span>
                              {isMuted && (
                                <svg className="h-3.5 w-3.5 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-.707-1.707l5.586-5.586a1 1 0 000-1.414l-1.293-1.293a1 1 0 011.414-1.414l11.293 11.293a1 1 0 010 1.414l-11.293 11.293a1 1 0 01-1.414-1.414l1.293-1.293a1 1 0 000-1.414L4.707 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l9.707-9.707a1 1 0 011.414 0l1.586 1.586a1 1 0 010 1.414L5.586 15z" />
                                </svg>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-sm text-muted-foreground truncate flex-1">
                              {chat.lastMessageText || 'No messages yet'}
                            </p>
                            
                            {unreadCount > 0 && (
                              <span className="bg-primary text-white text-xs font-bold rounded-full h-5 min-w-5 flex items-center justify-center shadow-sm">
                                {unreadCount > 9 ? '9+' : unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Friend Picker Dialog for new chats */}
      <FriendPickerDialog
        open={isFriendPickerOpen}
        onOpenChange={setIsFriendPickerOpen}
        onFriendSelect={handleFriendSelectForChat}
        title="Start New Chat"
        description="Select a friend to start a conversation with."
      />
    </div>
  );
}

