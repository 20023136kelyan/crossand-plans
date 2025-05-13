
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { COMMON_PRICE_RANGES } from "@/lib/constants";

interface PriceRangeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function PriceRangeInput({ value, onChange, disabled }: PriceRangeInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(""); // For search and new value input
  const [allOptions, setAllOptions] = useState<string[]>(() => {
    const initialOptions = new Set(COMMON_PRICE_RANGES);
    if (value && !initialOptions.has(value)) {
      initialOptions.add(value);
    }
    return Array.from(initialOptions).sort();
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // If the external value changes and it's not in our current options, add it.
    if (value && !allOptions.includes(value)) {
      setAllOptions(prev => [...new Set([...prev, value])].sort());
    }
    // If the value is cleared externally, reflect that. (inputValue might not be needed here)
  }, [value, allOptions]);

  const handleSelect = (option: string) => {
    onChange(option);
    setOpen(false);
    setInputValue(""); // Reset search/new input
  };

  const handleCreate = (newOption: string) => {
    const trimmedOption = newOption.trim();
    if (trimmedOption) {
      if (!allOptions.some(o => o.toLowerCase() === trimmedOption.toLowerCase())) {
        setAllOptions(prev => [...prev, trimmedOption].sort());
      }
      onChange(trimmedOption);
    }
    setOpen(false);
    setInputValue("");
  };

  const filteredOptions = inputValue
    ? allOptions.filter(option =>
        option.toLowerCase().includes(inputValue.toLowerCase())
      )
    : allOptions;
  
  const canCreateNew = inputValue.trim() && !allOptions.some(opt => opt.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">Select or enter price range...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 dropdown-content-width-same-as-trigger">
        <Command shouldFilter={false}> {/* We handle filtering manually for `allOptions` */}
          <CommandInput
            ref={inputRef}
            placeholder="Search or type new..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {canCreateNew ? "Press Enter or click below to add." : "No matching price range."}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map(option => (
                <CommandItem
                  key={option}
                  value={option} 
                  onSelect={() => {
                    handleSelect(option);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
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
  );
}
