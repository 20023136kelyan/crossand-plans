
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { COUNTRIES } from "@/lib/countries"; // Assuming countries are stored here

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CountrySelect({ value, onChange, disabled }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCountryName = COUNTRIES.find(country => country.code === value)?.name || value;

  const handleSelect = (countryCode: string) => {
    onChange(countryCode);
    setOpen(false);
    setInputValue(""); 
  };

  const filteredCountries = inputValue
    ? COUNTRIES.filter(country =>
        country.name.toLowerCase().includes(inputValue.toLowerCase()) ||
        country.code.toLowerCase().includes(inputValue.toLowerCase())
      )
    : COUNTRIES;

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
          {selectedCountryName ? (
            <span className="truncate">{selectedCountryName}</span>
          ) : (
            <span className="text-muted-foreground">Select country...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 dropdown-content-width-same-as-trigger">
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder="Search country..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {filteredCountries.map(country => (
                <CommandItem
                  key={country.code}
                  value={country.name} // Use name for display and searching in Command
                  onSelect={() => {
                    handleSelect(country.code);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === country.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {country.name} ({country.code})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
