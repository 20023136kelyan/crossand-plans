
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Control } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormDescription, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, UserPlus, X, Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getFriendships } from '@/services/userService'; // Client-side service
import type { FriendEntry } from '@/types/user';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { PlanFormValues } from './PlanForm'; // Assuming PlanFormValues is still relevant, or adjust if used more generically

interface FriendMultiSelectInputProps {
  control: Control<PlanFormValues | any>; // Allow 'any' if used outside PlanFormValues context too
  name: "invitedParticipantUserIds"; // Keep specific for now, can be generic later
  label: string;
  description?: string;
}

export function FriendMultiSelectInput({
  control,
  name,
  label,
  description,
}: FriendMultiSelectInputProps) {
  const { user, loading: authLoading } = useAuth();
  const [allFriendshipEntries, setAllFriendshipEntries] = useState<FriendEntry[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (isPopoverOpen && user && !authLoading) {
      setIsLoadingFriends(true);
      // console.log(`[FriendMultiSelectInput] User ${user.uid} identified. Subscribing to friendships.`);
      unsubscribe = getFriendships(
        user.uid,
        (updatedFriendships) => {
          // console.log(`[FriendMultiSelectInput] Received ${updatedFriendships.length} friendship entries.`);
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
      // console.log("[FriendMultiSelectInput] Popover closed or user not ready, ensuring no active listener.");
      setAllFriendshipEntries([]); // Clear friends when dialog closes to refetch next time
      setIsLoadingFriends(true); // Reset loading state
      if (unsubscribe) {
        unsubscribe();
      }
    }
    
    return () => {
      if (unsubscribe) {
        // console.log("[FriendMultiSelectInput] Unsubscribing from friendships listener on cleanup.");
        unsubscribe();
      }
    };
  }, [isPopoverOpen, user, authLoading, toast]);

  const actualFriends = useMemo(() => {
    return allFriendshipEntries.filter(f => f.status === 'friends');
  }, [allFriendshipEntries]);
  
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: formFieldRenderProp }) => { // formFieldRenderProp IS THE FIELD OBJECT we need
        const selectedFriendUids = formFieldRenderProp.value || [];

        const currentFilteredFriends = useMemo(() => {
          if (!searchTerm.trim()) return actualFriends.filter(f => !selectedFriendUids.includes(f.friendUid));
          return actualFriends.filter(
            (friend) =>
              !selectedFriendUids.includes(friend.friendUid) &&
              (friend.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               friend.friendUid.toLowerCase().includes(searchTerm.toLowerCase()))
          );
        }, [actualFriends, searchTerm, selectedFriendUids]); // Use selectedFriendUids from render prop

        const handleSelectFriend = (friendUid: string) => {
          const newSelected = selectedFriendUids.includes(friendUid)
            ? selectedFriendUids.filter((uid: string) => uid !== friendUid)
            : [...selectedFriendUids, friendUid];
          formFieldRenderProp.onChange(newSelected);
        };
        
        const getFriendInfo = (uid: string) => actualFriends.find(f => f.friendUid === uid);
        
        return (
          <FormItem>
            <FormLabel className="text-xs">{label}</FormLabel>
            {selectedFriendUids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 my-2">
                {selectedFriendUids.map((uid: string) => {
                  const friendInfo = getFriendInfo(uid);
                  const friendName = friendInfo?.name || `User (${uid.substring(0,5)})`;
                  const friendAvatar = friendInfo?.avatarUrl || undefined;
                  const friendInitial = friendName === `User (${uid.substring(0,5)})` ? 'U' : friendName.charAt(0).toUpperCase();
                  return (
                    <Badge key={uid} variant="secondary" className="flex items-center gap-1 pr-1 text-xs h-6">
                      <Avatar className="h-4 w-4 -ml-0.5 mr-0.5">
                          <AvatarImage src={friendAvatar} alt={friendName} data-ai-hint="person avatar"/>
                          <AvatarFallback className="text-[10px]">{friendInitial}</AvatarFallback>
                      </Avatar>
                      {friendName}
                      <button
                        type="button"
                        className="rounded-full outline-none ring-offset-background focus:ring-1 focus:ring-ring focus:ring-offset-1 ml-0.5"
                        onClick={() => handleSelectFriend(uid)}
                        aria-label={`Remove ${friendName}`}
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
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
                  {(isLoadingFriends && isPopoverOpen) || authLoading ? 'Loading friends...' : (selectedFriendUids.length > 0 ? `${selectedFriendUids.length} friend(s) invited` : 'Invite friends...')}
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
                      {currentFilteredFriends.map((friend) => ( // Use currentFilteredFriends from useMemo
                        <CommandItem
                          key={friend.friendUid}
                          value={friend.name || friend.friendUid} // Value for Command filtering
                          onSelect={() => {
                            handleSelectFriend(friend.friendUid);
                          }}
                          className="flex items-center gap-2 text-xs cursor-pointer"
                        >
                           <Avatar className="h-5 w-5">
                             <AvatarImage src={friend.avatarUrl || undefined} alt={friend.name || 'Friend'} data-ai-hint="person avatar"/>
                             <AvatarFallback className="text-[10px]">{friend.name ? friend.name.charAt(0).toUpperCase() : 'F'}</AvatarFallback>
                           </Avatar>
                          {friend.name || `User (${friend.friendUid.substring(0,5)})`}
                          <Check
                            className={cn(
                              "ml-auto h-3.5 w-3.5",
                              selectedFriendUids.includes(friend.friendUid) ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {description && <FormDescription className="text-xs">{description}</FormDescription>}
            <FormMessage className="text-xs" />
          </FormItem>
        );
      }}
    />
  );
}
