
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, PlusCircle, X as XIcon } from "lucide-react"; // Renamed X to XIcon to avoid conflict
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
import { COMMON_US_FOOD_ALLERGENS } from "@/lib/constants";

interface AllergiesInputProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function AllergiesInput({ value: selectedAllergies, onChange }: AllergiesInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  // Initialize allOptions with common allergens and any initially selected custom ones
  const [allOptions, setAllOptions] = useState<string[]>(() => 
    [...new Set([...COMMON_US_FOOD_ALLERGENS, ...selectedAllergies])].sort()
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Ensure all selected items are options if selectedAllergies changes from parent
    const newOptions = [...new Set([...COMMON_US_FOOD_ALLERGENS, ...selectedAllergies, ...allOptions])].sort();
    if (newOptions.length !== allOptions.length || !newOptions.every((val, idx) => val === allOptions[idx])) {
        setAllOptions(newOptions);
    }
  }, [selectedAllergies, allOptions]);


  const handleSelect = (option: string) => {
    if (!selectedAllergies.includes(option)) {
      onChange([...selectedAllergies, option].sort());
    }
    setInputValue(""); // Reset input after selection
  };

  const handleCreate = (option: string) => {
    const trimmedOption = option.trim();
    if (trimmedOption && !allOptions.some(o => o.toLowerCase() === trimmedOption.toLowerCase())) {
      setAllOptions(prev => [...prev, trimmedOption].sort());
    }
    if (trimmedOption && !selectedAllergies.includes(trimmedOption)) {
      onChange([...selectedAllergies, trimmedOption].sort());
    }
    setInputValue(""); 
  };

  const handleRemove = (option: string) => {
    onChange(selectedAllergies.filter(item => item !== option));
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
            className="w-full justify-between h-auto min-h-10 py-1.5" // Adjusted padding
          >
            <div className="flex flex-wrap gap-1 items-center">
              {selectedAllergies.length > 0 ? (
                selectedAllergies.map(allergy => (
                  <Badge
                    key={allergy}
                    variant="secondary"
                    className="flex items-center gap-1 px-2 py-0.5" // Adjusted padding
                  >
                    {allergy}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${allergy}`}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent PopoverTrigger from toggling
                        handleRemove(allergy);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemove(allergy);
                        }
                      }}
                      className="rounded-full hover:bg-muted-foreground/20 p-0.5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      <XIcon className="h-3 w-3" />
                    </span>
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground font-normal">Select allergies...</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 dropdown-content-width-same-as-trigger">
          <Command>
            <CommandInput
              ref={inputRef}
              placeholder="Search or add allergy..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                {canCreateNew ? "Press Enter or click below to add." : "No allergies found."}
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map(option => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      if (!selectedAllergies.includes(option)) {
                        handleSelect(option);
                      } else {
                        handleRemove(option);
                      }
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedAllergies.includes(option) ? "opacity-100" : "opacity-0"
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
                      value={inputValue.trim()} // Use trimmed value for creation
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
        Select from common allergies, or type to search and add new ones.
      </p>
    </div>
  );
}

// Helper CSS class to ensure PopoverContent matches trigger width if needed by parent
// For example, if PopoverContent is inside a FormItem with a specific width.
// You can add global style or Tailwind arbitrary variants if needed.
// For Shadcn Combobox, width is usually handled well by `w-[--radix-popover-trigger-width]`
// but ensure the parent container allows the PopoverTrigger to define this width.
// For example:
// @layer utilities {
//   .dropdown-content-width-same-as-trigger {
//     width: var(--radix-popover-trigger-width);
//   }
// }

