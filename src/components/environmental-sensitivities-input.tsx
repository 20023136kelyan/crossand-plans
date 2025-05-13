
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
import { COMMON_ENVIRONMENTAL_SENSITIVITIES } from "@/lib/constants";

interface EnvironmentalSensitivitiesInputProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function EnvironmentalSensitivitiesInput({ value: selectedSensitivities, onChange }: EnvironmentalSensitivitiesInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [allOptions, setAllOptions] = useState<string[]>(() =>
    [...new Set([...COMMON_ENVIRONMENTAL_SENSITIVITIES, ...selectedSensitivities])].sort()
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const newOptions = [...new Set([...COMMON_ENVIRONMENTAL_SENSITIVITIES, ...selectedSensitivities, ...allOptions])].sort();
    if (newOptions.length !== allOptions.length || !newOptions.every((val, idx) => val === allOptions[idx])) {
        setAllOptions(newOptions);
    }
  }, [selectedSensitivities, allOptions]);

  const handleSelect = (option: string) => {
    if (!selectedSensitivities.includes(option)) {
      onChange([...selectedSensitivities, option].sort());
    }
    setInputValue("");
  };

  const handleCreate = (option: string) => {
    const trimmedOption = option.trim();
    if (trimmedOption && !allOptions.some(o => o.toLowerCase() === trimmedOption.toLowerCase())) {
      setAllOptions(prev => [...prev, trimmedOption].sort());
    }
    if (trimmedOption && !selectedSensitivities.includes(trimmedOption)) {
      onChange([...selectedSensitivities, trimmedOption].sort());
    }
    setInputValue("");
  };

  const handleRemove = (option: string) => {
    onChange(selectedSensitivities.filter(item => item !== option));
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
              {selectedSensitivities.length > 0 ? (
                selectedSensitivities.map(sensitivity => (
                  <Badge
                    key={sensitivity}
                    variant="secondary"
                    className="flex items-center gap-1 px-2 py-0.5"
                  >
                    {sensitivity}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${sensitivity}`}
                      onClick={(e) => {
                        e.stopPropagation(); 
                        handleRemove(sensitivity);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemove(sensitivity);
                        }
                      }}
                      className="rounded-full hover:bg-muted-foreground/20 p-0.5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      <XIcon className="h-3 w-3" />
                    </span>
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground font-normal">Select environmental sensitivities...</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 dropdown-content-width-same-as-trigger">
          <Command>
            <CommandInput
              ref={inputRef}
              placeholder="Search or add sensitivity..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                {canCreateNew ? "Press Enter or click below to add." : "No sensitivities found."}
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map(option => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      if (!selectedSensitivities.includes(option)) {
                        handleSelect(option);
                      } else {
                        handleRemove(option);
                      }
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedSensitivities.includes(option) ? "opacity-100" : "opacity-0"
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
        Note any sensitivities to environments (e.g., noise, crowds).
      </p>
    </div>
  );
}
