'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, UserPlus, X, Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getFriendships } from '@/services/clientServices';
import type { FriendEntry } from '@/types/user';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FriendMultiSelectInputProps {
  selectedUserIds: string[];
  onSelectedUserIdsChange: (ids: string[]) => void;
  onOpenChange?: (isOpen: boolean) => void;
  autoOpen?: boolean;
}

export function FriendMultiSelectInput({
  selectedUserIds,
  onSelectedUserIdsChange,
  onOpenChange,
  autoOpen = false,
}: FriendMultiSelectInputProps) {
  const { user, loading: authLoading } = useAuth();
  const [allFriendshipEntries, setAllFriendshipEntries] = useState<FriendEntry[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(autoOpen);
  const { toast } = useToast();

  const handleOpenChange = (open: boolean) => {
    setIsPopoverOpen(open);
    if (onOpenChange) {
      onOpenChange(open);
    }
  };

  // Handle autoOpen prop changes
  useEffect(() => {
    if (autoOpen) {
      setIsPopoverOpen(true);
    }
  }, [autoOpen]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (isPopoverOpen && user && !authLoading) {
      setIsLoadingFriends(true);
      unsubscribe = getFriendships(
        user.uid,
        (updatedFriendships) => {
          setAllFriendshipEntries(updatedFriendships);
          setIsLoadingFriends(false);
        },
        (error) => {
          console.error('Error fetching friends for multi-select picker:', error);
          toast({ title: "Error", description: "Could not load your friends list.", variant: "destructive" });
          setAllFriendshipEntries([]);
          setIsLoadingFriends(false);
        }
      );
    } else if (!isPopoverOpen) {
      setAllFriendshipEntries([]);
      setIsLoadingFriends(true);
      if (unsubscribe) {
        unsubscribe();
      }
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isPopoverOpen, user, authLoading, toast]);

  const actualFriends = useMemo(() => {
    return allFriendshipEntries.filter(f => f.status === 'friends');
  }, [allFriendshipEntries]);

  const currentFilteredFriends = useMemo(() => {
    const safeSelectedUserIds = selectedUserIds || [];
    if (!searchTerm.trim()) return actualFriends.filter(f => !safeSelectedUserIds.includes(f.friendUid));
    return actualFriends.filter(
      (friend) =>
        !safeSelectedUserIds.includes(friend.friendUid) &&
        (friend.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         friend.friendUid.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [actualFriends, searchTerm, selectedUserIds]);

  const handleSelectFriend = (friendUid: string) => {
    const safeSelectedUserIds = selectedUserIds || [];
    const newSelected = safeSelectedUserIds.includes(friendUid)
      ? safeSelectedUserIds.filter((uid: string) => uid !== friendUid)
      : [...safeSelectedUserIds, friendUid];
    onSelectedUserIdsChange(newSelected);
  };
  
  const getFriendInfo = (uid: string) => actualFriends.find(f => f.friendUid === uid);
  
  return (
    <div>
        {(selectedUserIds?.length || 0) > 0 && (
            <div className="flex items-center gap-2 mb-2">
                {(selectedUserIds || []).map((uid: string) => {
                    const friendInfo = getFriendInfo(uid);
                    if (!friendInfo) return null;

                    const friendName = friendInfo.name || `User`;
                    const friendAvatar = friendInfo.avatarUrl || undefined;
                    const friendInitial = friendInfo.name ? friendInfo.name.charAt(0).toUpperCase() : '?';

                    return (
                        <div key={uid} className="relative group">
                             <Avatar className="h-9 w-9 border-2 border-background">
                                <AvatarImage src={friendAvatar} alt={friendName} />
                                <AvatarFallback>{friendInitial}</AvatarFallback>
                            </Avatar>
                            <button
                                type="button"
                                className="absolute -top-1 -right-1 h-5 w-5 bg-muted rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleSelectFriend(uid)}
                                aria-label={`Remove ${friendName}`}
                            >
                                <X className="h-3 w-3 text-muted-foreground" />
                            </button>
                        </div>
                    );
                })}
            </div>
        )}
        <Popover open={isPopoverOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
            <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between text-xs h-9 px-3 py-2 text-muted-foreground"
                disabled={(isLoadingFriends && isPopoverOpen) || authLoading} 
            >
                <div className="flex items-center">
                {(isLoadingFriends && isPopoverOpen) || authLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                <UserPlus className="mr-2 h-4 w-4" />
                )}
                {(isLoadingFriends && isPopoverOpen) || authLoading ? 'Loading friends...' : ((selectedUserIds?.length || 0) > 0 ? `${selectedUserIds?.length || 0} friend(s) invited` : 'Invite friends...')}
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
                <CommandInput
                placeholder="Search friends..."
                value={searchTerm}
                onValueChange={setSearchTerm}
                className="h-9 text-xs"
                />
                <CommandList>
                <CommandEmpty>
                    {isLoadingFriends ? "Loading..." : (actualFriends.length === 0 ? "No friends found." : "No matching friends.")}
                </CommandEmpty>
                <CommandGroup>
                    {currentFilteredFriends.map((friend) => (
                    <CommandItem
                        key={friend.friendUid}
                        value={friend.name || friend.friendUid}
                        onSelect={() => handleSelectFriend(friend.friendUid)}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                    >
                        <Avatar className="h-5 w-5">
                            <AvatarImage src={friend.avatarUrl || undefined} alt={friend.name || 'Friend'} />
                            <AvatarFallback className="text-[10px]">{friend.name ? friend.name.charAt(0).toUpperCase() : 'F'}</AvatarFallback>
                        </Avatar>
                        {friend.name || `User (${friend.friendUid.substring(0,5)})`}
                        <Check
                        className={cn(
                            "ml-auto h-3.5 w-3.5",
                            (selectedUserIds || []).includes(friend.friendUid) ? "opacity-100" : "opacity-0"
                        )}
                        />
                    </CommandItem>
                    ))}
                </CommandGroup>
                </CommandList>
            </Command>
            </PopoverContent>
        </Popover>
    </div>
  );
}
