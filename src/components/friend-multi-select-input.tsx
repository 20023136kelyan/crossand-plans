"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, PlusCircle, X as XIcon, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Friend as FriendType } from "@/types"; // Using FriendType to avoid conflict with React.Friend

interface FriendMultiSelectInputProps {
  availableFriends: FriendType[];
  selectedFriendIds: string[]; // Array of user IDs
  onChange: (selectedFriendIds: string[]) => void;
}

export function FriendMultiSelectInput({
  availableFriends,
  selectedFriendIds,
  onChange,
}: FriendMultiSelectInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(""); // For search input
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (friendUserId: string) => {
    if (!selectedFriendIds.includes(friendUserId)) {
      onChange([...selectedFriendIds, friendUserId]);
    }
    setInputValue(""); // Reset search input after selection
  };

  const handleRemove = (friendUserId: string) => {
    onChange(selectedFriendIds.filter(id => id !== friendUserId));
  };

  const filteredFriends = inputValue
    ? availableFriends.filter(friend =>
        friend.name.toLowerCase().includes(inputValue.toLowerCase())
      )
    : availableFriends;

  const getFriendById = (userId: string) => availableFriends.find(f => f.userId === userId);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 py-1.5"
          >
            <div className="flex flex-wrap gap-1 items-center">
              {selectedFriendIds.length > 0 ? (
                selectedFriendIds.map(friendId => {
                  const friend = getFriendById(friendId);
                  return (
                    <Badge
                      key={friendId}
                      variant="secondary"
                      className="flex items-center gap-1 px-2 py-0.5"
                    >
                      {friend ? (
                        <>
                         <Avatar className="h-4 w-4 mr-1">
                            <AvatarImage src={friend.avatarUrl} alt={friend.name} data-ai-hint="friend avatar small" />
                            <AvatarFallback>{friend.name?.[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          {friend.name}
                        </>
                      ) : `ID: ${friendId}`}
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Remove ${friend?.name || friendId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(friendId);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemove(friendId);
                          }
                        }}
                        className="rounded-full hover:bg-muted-foreground/20 p-0.5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                      >
                        <XIcon className="h-3 w-3" />
                      </span>
                    </Badge>
                  );
                })
              ) : (
                <span className="text-muted-foreground font-normal">Select friends to invite...</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 dropdown-content-width-same-as-trigger">
          <Command>
            <CommandInput
              ref={inputRef}
              placeholder="Search friends..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>No friends found.</CommandEmpty>
              <CommandGroup>
                {filteredFriends.map(friend => (
                  <CommandItem
                    key={friend.userId} // Use unique friend.userId as key
                    value={friend.name} // Use name for search/display purposes
                    onSelect={() => {
                      if (!selectedFriendIds.includes(friend.userId)) {
                        handleSelect(friend.userId);
                      } else {
                        handleRemove(friend.userId);
                      }
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedFriendIds.includes(friend.userId) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Avatar className="h-6 w-6 mr-2">
                        <AvatarImage src={friend.avatarUrl} alt={friend.name} data-ai-hint="friend avatar list" />
                        <AvatarFallback>{friend.name?.[0]?.toUpperCase() || <User />}</AvatarFallback>
                    </Avatar>
                    {friend.name}
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
