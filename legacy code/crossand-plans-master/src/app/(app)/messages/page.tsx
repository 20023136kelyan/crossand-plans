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
  MessageCircle, Search, UserPlus, Send, Loader2, ShieldCheck as AdminIcon, CheckCircle, Trash2, MoreVertical, Users as ManageFriendsIcon, XCircle, Plus
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
import { getUserChats } from '@/services/chatService'; 
import { getFriendships } from '@/services/userService'; 
import type { Chat, FriendEntry, UserProfile, UserRoleType, SearchedUser } from '@/types/user';
import { formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';
import { FriendPickerDialog } from '@/components/messages/FriendPickerDialog';
import { 
  initiateDirectChatAction, 
  deleteChatAction,
} from '@/app/actions/chatActions'; 
import {
  searchUsersAction,
  sendFriendRequestAction,
  acceptFriendRequestAction,
  declineFriendRequestAction,
  removeFriendAction
} from '@/app/actions/userActions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

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
    if (authLoading) {
      setLoadingChats(true);
      return;
    }
    if (user?.uid) {
      setLoadingChats(true);
      const unsubscribe = getUserChats(user.uid, (fetchedChats) => {
        setChats(fetchedChats);
        setLoadingChats(false); 
      });
      return () => {
        unsubscribe();
      };
    } else {
      setChats([]);
      setLoadingChats(false);
    }
  }, [user, authLoading]);

  // Effect to handle friendships subscription
  useEffect(() => {
    if (!user?.uid || !isManageFriendsDialogOpen) {
      return;
    }

    setFriendshipsLoading(true);

    try {
      const unsubscribe = getFriendships(
        user.uid,
        (allFriendships: FriendEntry[]) => {
          setFriends(allFriendships.filter(f => f.status === 'friends'));
          setPendingReceived(allFriendships.filter(f => f.status === 'pending_received'));
          setPendingSent(allFriendships.filter(f => f.status === 'pending_sent'));
          setFriendshipsLoading(false);
        },
        (error: Error) => {
          console.error("Error fetching friendships", error);
          toast({ title: "Error", description: "Could not fetch friendships.", variant: "destructive" });
          setFriendshipsLoading(false);
        }
      );

      unsubFriendshipsRef.current = unsubscribe;

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
        const idToken = await user.getIdToken(true);
        const result = await searchUsersAction(searchTerm, idToken);
        
        if (!result.success || !Array.isArray(result.users) || !result.users) {
          setSearchResults([]);
          if (result.error) {
            toast({ title: "Search Failed", description: result.error, variant: "destructive" });
          }
          return;
        }

        const searchUsers = result.users;

        // Clean up previous subscription if exists
        if (unsubFriendshipsSearchRef.current) {
          unsubFriendshipsSearchRef.current();
          unsubFriendshipsSearchRef.current = null;
        }

        // Get current friendships
        unsubFriendshipsSearchRef.current = getFriendships(
          user.uid,
          (currentFriendships: FriendEntry[]) => {
            const friendsMap = new Map(currentFriendships.map((f: FriendEntry) => [f.friendUid, f.status as FriendStatus]));
            const usersWithStatus = searchUsers.map(su => ({
              ...su,
              friendshipStatus: su.uid === user.uid ? 'is_self' : (friendsMap.get(su.uid) as ExtendedFriendStatus || 'not_friends')
            }));
            setSearchResults(usersWithStatus);
            
            // Cleanup subscription after getting results
            if (unsubFriendshipsSearchRef.current) {
              unsubFriendshipsSearchRef.current();
              unsubFriendshipsSearchRef.current = null;
            }
          },
          (error: Error) => {
            console.error("Error fetching friendships for search", error);
            const usersWithoutStatus = searchUsers.map(su => ({
              ...su,
              friendshipStatus: (su.uid === user.uid ? 'is_self' : 'not_friends') as ExtendedFriendStatus
            }));
            setSearchResults(usersWithoutStatus);
          }
        );
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
        name: currentUserProfile.name,
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
      const idToken = await user.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available for delete action.");
      const result = await deleteChatAction(chatToDelete.id, idToken);
      if (result.success) {
        toast({ title: "Chat Deleted", description: "The chat has been successfully deleted." });
        setChats(prev => prev.filter(c => c.id !== chatToDelete.id));
      } else {
        toast({ title: "Error", description: result.error || "Could not delete chat.", variant: "destructive" });
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
      const idToken = await user.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");

      let result;
      switch (action) {
        case 'send':
          result = await sendFriendRequestAction(targetUid, idToken);
          break;
        case 'accept':
          result = await acceptFriendRequestAction(targetUid, idToken);
          break;
        case 'decline':
        case 'cancel':
          result = await declineFriendRequestAction(targetUid, idToken);
          break;
        case 'remove':
          result = await removeFriendAction(targetUid, idToken);
          break;
        default:
          throw new Error("Invalid friend action");
      }

      if (result.success) {
        toast({ title: "Success", description: result.message || "Friend action successful." });
        // The real-time listener will update the state
      } else {
        toast({ title: "Error", description: result.error || "Could not complete action.", variant: "destructive" });
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

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header with improved spacing and styling */}
        <div className="pt-6 pb-6 border-b border-border/40">
          <h1 className="text-3xl font-bold text-foreground/60 opacity-60 mb-6">Messages</h1>
          
          {/* Search bar with action buttons */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Search chats..."
                className="pl-8 sm:pl-10 bg-card border-border text-sm h-8 sm:h-9 rounded-lg focus:ring-primary focus:border-primary w-full"
                value={searchTermChats}
                onChange={(e) => setSearchTermChats(e.target.value)}
              />
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFriendPickerOpen(true)}
              aria-label="Start new chat"
              className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm bg-card border-border hover:bg-secondary/50"
              disabled={isInitiatingChat}
            >
              {isInitiatingChat ? (
                <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
              ) : (
                <Plus className="h-4 w-4 md:mr-2" />
              )}
              <span className="hidden md:inline">New Chat</span>
            </Button>
          </div>
        </div>

        <div className="pt-6">
          <div className="flex-grow overflow-y-auto space-y-3 pr-1 custom-scrollbar-vertical">
            {filteredChats.map(chat => {
            const display = getDisplayInfo(chat);
            let lastMessageDateFormatted = 'Date unknown';
            let lastMessageTs: number | null = null;
            if (chat.lastMessageTimestamp) {
                const parsedDate = typeof chat.lastMessageTimestamp === 'string' ? parseISO(chat.lastMessageTimestamp) : (chat.lastMessageTimestamp instanceof Date ? chat.lastMessageTimestamp : null);
                if (parsedDate && isValid(parsedDate)) {
                    lastMessageDateFormatted = formatDistanceToNowStrict(parsedDate, { addSuffix: true });
                    lastMessageTs = parsedDate.getTime();
                }
            }
            const userReadTimestampISO = chat.participantReadTimestamps?.[user?.uid || ''] as string | undefined;
            const userReadTime = userReadTimestampISO && isValid(parseISO(userReadTimestampISO)) ? parseISO(userReadTimestampISO).getTime() : 0;
            const hasNewActivity = lastMessageTs && user && chat.lastMessageSenderId !== user.uid && lastMessageTs > userReadTime;


            return (
              <Link key={chat.id} href={`/messages/${chat.id}`} className="block group">
                <Card className="relative flex items-center p-3 hover:bg-secondary/50 transition-colors cursor-pointer">
                   <div className="absolute top-1 right-1 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground focus-visible:ring-0"
                          onClick={(e) => {e.preventDefault(); e.stopPropagation();}}
                          aria-label="More options"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(e) => {e.preventDefault(); e.stopPropagation();}}
                      >
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleDeleteChatRequest(chat); }}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer text-xs"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Chat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center flex-grow min-w-0">
                    <Avatar className="h-12 w-12 mr-3">
                      {display.avatarUrl ? (
                        <AvatarImage src={display.avatarUrl} alt={display.name} data-ai-hint={display.dataAiHint} />
                      ) : (
                        <AvatarFallback>{display.initial}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <h3 className="font-semibold truncate" title={display.name}>{display.name}</h3>
                          <VerificationBadge role={display.role} isVerified={display.isVerified} />
                        </div>
                        <div className="flex items-center pr-6">
                          {hasNewActivity && (
                            <span className="mr-1.5 flex-shrink-0 h-2.5 w-2.5 rounded-full bg-primary shadow-md" aria-label="New activity"></span>
                          )}
                          <span className="text-xs text-muted-foreground flex-shrink-0 ml-auto">
                            {lastMessageDateFormatted}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground truncate pr-6">{chat.lastMessageSenderId === user?.uid ? "You: " : ""}{chat.lastMessageText || (chat.lastMessageSenderId && chat.lastMessageText === '' ? '[Image]' : 'No messages yet')}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {!loadingChats && chats.length === 0 && (
            <div className="flex-grow flex flex-col items-center justify-between text-center py-16 sm:py-20">
              <div className="flex flex-col items-center">
                <MessageCircle className="mx-auto h-24 w-24 text-muted-foreground/50 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">No Messages Yet</h2>
                <p className="text-muted-foreground mb-8">Start a conversation with your friends.</p>
              </div>
              <Button
                variant="outline"
                size="lg"
                className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => setIsFriendPickerOpen(true)}
                disabled={isInitiatingChat}
              >
                {isInitiatingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Start New Chat
              </Button>
            </div>
        )}
        {!loadingChats && chats.length > 0 && filteredChats.length === 0 && searchTermChats && (
          <div className="flex-grow flex flex-col items-center justify-center text-center py-10">
              <Search className="h-20 w-20 text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold">No Chats Found</h2>
              <p className="text-muted-foreground">Your search for "{searchTermChats}" did not match any chats.</p>
          </div>
        )}
      </div>
    </div>

      <FriendPickerDialog
        open={isFriendPickerOpen}
        onOpenChange={setIsFriendPickerOpen}
        onFriendSelect={handleFriendSelectForChat}
      />

      <ManageFriendsDialog
        open={isManageFriendsDialogOpen}
        onOpenChange={setIsManageFriendsDialogOpen}
        friends={friends}
        pendingReceived={pendingReceived}
        pendingSent={pendingSent}
        friendshipsLoading={friendshipsLoading}
        onFriendAction={handleFriendAction}
        friendActionLoading={friendActionLoading}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchResults={searchResults}
        searchLoading={searchLoading}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete this chat for all participants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isDeletingChat} aria-label="Cancel Delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteChat} disabled={isDeletingChat} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {isDeletingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

