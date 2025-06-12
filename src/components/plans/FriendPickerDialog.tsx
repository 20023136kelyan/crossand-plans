'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Users, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { Plan } from '@/types/user';

interface Friend {
  id: string;
  name: string;
  profilePicture?: string;
  username?: string;
}

interface FriendPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
  onShare: (friendIds: string[]) => Promise<void>;
}

export function FriendPickerDialog({
  open,
  onOpenChange,
  plan,
  onShare,
}: FriendPickerDialogProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Mock friends data - replace with actual API call
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        const mockFriends: Friend[] = [
          {
            id: '1',
            name: 'Alice Johnson',
            username: 'alice_j',
            profilePicture: '/avatars/alice.jpg',
          },
          {
            id: '2',
            name: 'Bob Smith',
            username: 'bob_smith',
            profilePicture: '/avatars/bob.jpg',
          },
          {
            id: '3',
            name: 'Carol Davis',
            username: 'carol_d',
            profilePicture: '/avatars/carol.jpg',
          },
          {
            id: '4',
            name: 'David Wilson',
            username: 'david_w',
          },
          {
            id: '5',
            name: 'Emma Brown',
            username: 'emma_b',
            profilePicture: '/avatars/emma.jpg',
          },
        ];
        setFriends(mockFriends);
        setFilteredFriends(mockFriends);
        setIsLoading(false);
      }, 1000);
    }
  }, [open]);

  // Filter friends based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFriends(friends);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredFriends(
        friends.filter(
          (friend) =>
            friend.name.toLowerCase().includes(query) ||
            friend.username?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, friends]);

  const handleFriendToggle = (friendId: string) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriends(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFriends.size === filteredFriends.length) {
      setSelectedFriends(new Set());
    } else {
      setSelectedFriends(new Set(filteredFriends.map(f => f.id)));
    }
  };

  const handleShare = async () => {
    if (selectedFriends.size === 0) {
      toast.error('Please select at least one friend to share with');
      return;
    }

    setIsSharing(true);
    try {
      await onShare(Array.from(selectedFriends));
      toast.success(`Plan shared with ${selectedFriends.size} friend${selectedFriends.size > 1 ? 's' : ''}!`);
      onOpenChange(false);
      setSelectedFriends(new Set());
      setSearchQuery('');
    } catch (error) {
      console.error('Error sharing plan:', error);
      toast.error('Failed to share plan');
    } finally {
      setIsSharing(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSharing) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setSelectedFriends(new Set());
        setSearchQuery('');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share with Friends
          </DialogTitle>
          <DialogDescription>
            Share "{plan.name}" with your friends
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 min-h-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              disabled={isLoading || isSharing}
            />
          </div>

          {/* Select All Checkbox */}
          {!isLoading && filteredFriends.length > 0 && (
            <div className="flex items-center space-x-2 px-1">
              <Checkbox
                id="select-all"
                checked={selectedFriends.size === filteredFriends.length && filteredFriends.length > 0}
                onCheckedChange={handleSelectAll}
                disabled={isSharing}
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Select all ({filteredFriends.length})
              </label>
            </div>
          )}

          {/* Friends List */}
          <ScrollArea className="flex-1 min-h-0 max-h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading friends...</span>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No friends found matching your search' : 'No friends available'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => !isSharing && handleFriendToggle(friend.id)}
                  >
                    <Checkbox
                      checked={selectedFriends.has(friend.id)}
                      onCheckedChange={() => handleFriendToggle(friend.id)}
                      disabled={isSharing}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={friend.profilePicture} alt={friend.name} />
                      <AvatarFallback className="text-xs">
                        {friend.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {friend.name}
                      </p>
                      {friend.username && (
                        <p className="text-xs text-muted-foreground truncate">
                          @{friend.username}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected Count */}
          {selectedFriends.size > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              {selectedFriends.size} friend{selectedFriends.size > 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSharing}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={selectedFriends.size === 0 || isSharing}
            className="w-full sm:w-auto"
          >
            {isSharing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sharing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Share ({selectedFriends.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}