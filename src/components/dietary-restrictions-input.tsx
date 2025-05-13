
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, PlusCircle, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COMMON_DIETARY_RESTRICTIONS } from "@/lib/constants";

interface DietaryRestrictionsInputProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function DietaryRestrictionsInput({ value: selectedRestrictions, onChange }: DietaryRestrictionsInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [allOptions, setAllOptions] = useState<string[]>(() =>
    [...new Set([...COMMON_DIETARY_RESTRICTIONS, ...selectedRestrictions])].sort()
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const newOptions = [...new Set([...COMMON_DIETARY_RESTRICTIONS, ...selectedRestrictions, ...allOptions])].sort();
    if (newOptions.length !== allOptions.length || !newOptions.every((val, idx) => val === allOptions[idx])) {
        setAllOptions(newOptions);
    }
  }, [selectedRestrictions, allOptions]);

  const handleSelect = (option: string) => {
    if (!selectedRestrictions.includes(option)) {
      onChange([...selectedRestrictions, option].sort());
    }
    setInputValue("");
  };

  const handleCreate = (option: string) => {
    const trimmedOption = option.trim();
    if (trimmedOption && !allOptions.some(o => o.toLowerCase() === trimmedOption.toLowerCase())) {
      setAllOptions(prev => [...prev, trimmedOption].sort());
    }
    if (trimmedOption && !selectedRestrictions.includes(trimmedOption)) {
      onChange([...selectedRestrictions, trimmedOption].sort());
    }
    setInputValue("");
  };

  const handleRemove = (option: string) => {
    onChange(selectedRestrictions.filter(item => item !== option));
  };

  const filteredOptions = inputValue
    ? allOptions.filter(option =>
        option.toLowerCase().includes(inputValue.toLowerCase())
      )
    : allOptions;

  const canCreateNew = inputValue.trim() && !allOptions.some(opt => opt.toLowerCase() === inputValue.trim().toLowerCase());

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
              {selectedRestrictions.length > 0 ? (
                selectedRestrictions.map(restriction => (
                  <Badge
                    key={restriction}
                    variant="secondary"
                    className="flex items-center gap-1 px-2 py-0.5"
                  >
                    {restriction}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${restriction}`}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent PopoverTrigger from toggling
                        handleRemove(restriction);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemove(restriction);
                        }
                      }}
                      className="rounded-full hover:bg-muted-foreground/20 p-0.5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      <XIcon className="h-3 w-3" />
                    </span>
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground font-normal">Select dietary restrictions...</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 dropdown-content-width-same-as-trigger">
          <Command>
            <CommandInput
              ref={inputRef}
              placeholder="Search or add restriction..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                {canCreateNew ? "Press Enter or click below to add." : "No restrictions found."}
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map(option => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      if (!selectedRestrictions.includes(option)) {
                        handleSelect(option);
                      } else {
                        handleRemove(option);
                      }
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedRestrictions.includes(option) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
              {canCreateNew && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value={inputValue.trim()}
                      onSelect={() => {
                        handleCreate(inputValue.trim());
                      }}
                      className="text-accent hover:text-accent-foreground"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add &quot;{inputValue.trim()}&quot;
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground px-1">
        Select from common dietary restrictions, or type to search and add new ones.
      </p>
    </div>
  );
}
