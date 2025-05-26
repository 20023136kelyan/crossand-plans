
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Search, UserCircle, UserPlus } from "lucide-react"; // Added UserPlus for empty state button
import { useAuth } from '@/context/AuthContext';
import { getFriendships } from '@/services/userService'; // Client-side service
import type { FriendEntry } from '@/types/user';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link'; // Added Link for "Add friends" button

interface FriendPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFriendSelect: (friend: FriendEntry) => void;
  title?: string;
  description?: string;
}

export function FriendPickerDialog({ 
  open, 
  onOpenChange, 
  onFriendSelect,
  title = "Share with a Friend",
  description = "Select a friend to share this with." 
}: FriendPickerDialogProps) {
  const { user, loading: authLoading } = useAuth();
  const [allFriendshipEntries, setAllFriendshipEntries] = useState<FriendEntry[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open && user && !authLoading) {
      setLoadingFriends(true);
      setSearchTerm(''); // Reset search term when dialog opens
      
      const unsubscribe = getFriendships(
        user.uid,
        (updatedFriendships) => {
          setAllFriendshipEntries(updatedFriendships);
          setLoadingFriends(false);
        },
        (error) => {
          console.error("Error fetching friends for picker:", error);
          toast({ title: "Error", description: "Could not load friends list.", variant: "destructive" });
          setAllFriendshipEntries([]);
          setLoadingFriends(false);
        }
      );
      return () => {
        // console.log("[FriendPickerDialog] Unsubscribing from friendships listener.");
        unsubscribe();
      };
    } else if (!open) {
      setAllFriendshipEntries([]); // Clear friends when dialog closes to refetch next time
      setLoadingFriends(true); // Reset loading state
    }
  }, [open, user, authLoading, toast]);

  const actualFriends = useMemo(() => {
    return allFriendshipEntries.filter(f => f.status === 'friends');
  }, [allFriendshipEntries]);

  const filteredFriends = useMemo(() => {
    if (!searchTerm.trim()) return actualFriends;
    return actualFriends.filter(friend =>
      friend.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [actualFriends, searchTerm]);

  const handleSelect = (friend: FriendEntry) => {
    onFriendSelect(friend);
    onOpenChange(false); 
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 flex flex-col max-h-[80vh]">
        <DialogHeader className="p-6 pb-4 border-b border-border/30">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pt-2 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search friends..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar-vertical">
          {loadingFriends ? (
            <div className="flex justify-center items-center py-10 h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="text-center py-10 h-32 flex flex-col items-center justify-center">
              <UserCircle className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {actualFriends.length === 0 ? "You have no friends yet." : "No friends match your search."}
              </p>
              {actualFriends.length === 0 && (
                <Button variant="link" className="text-xs mt-1 h-auto p-0" asChild>
                  <Link href="/messages" onClick={() => onOpenChange(false)}>
                    <UserPlus className="mr-1 h-3.5 w-3.5"/> Manage Contacts
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredFriends.map(friend => (
                <button
                  key={friend.friendUid}
                  onClick={() => handleSelect(friend)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 transition-colors text-left",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
                  )}
                  aria-label={`Select ${friend.name || 'friend'}`}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={friend.avatarUrl || undefined} alt={friend.name || 'Friend'} data-ai-hint="person avatar" />
                    <AvatarFallback className="text-xs">{friend.name ? friend.name.charAt(0).toUpperCase() : 'F'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{friend.name || 'Friend'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
