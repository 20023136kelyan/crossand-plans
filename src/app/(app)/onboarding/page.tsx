
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Loader2, Save, ArrowLeft, ArrowRight, ChevronsUpDown, Check, X as XIcon, LogOut,
  Users as UsersIcon, ShieldCheck as AdminIcon, CheckCircle, Edit3, CalendarDays, ImageIcon, User, Palette, Heart, Activity, AlertTriangle, ChefHat, Wallet, MessagesSquare as SocialInteractionIcon, UsersRound, MapPin as TravelToleranceIcon
} from 'lucide-react';
import Image from 'next/image'; // Use NextImage alias or ensure no conflict if Lucide also exports Image
import { useToast } from '@/hooks/use-toast';
import type { OnboardingProfileData, UserProfile } from '@/types/user';
import { completeOnboardingAction } from '@/app/actions/userActions';
import { Separator } from '@/components/ui/separator';
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { OnboardingProgress, createOnboardingSteps } from '@/components/onboarding/OnboardingProgress';


const countries = [
  { name: "United States", code: "US", dialCode: "+1" },
  { name: "Canada", code: "CA", dialCode: "+1" },
  { name: "United Kingdom", code: "GB", dialCode: "+44" },
  { name: "Australia", code: "AU", dialCode: "+61" },
  { name: "Germany", code: "DE", dialCode: "+49" },
  { name: "France", code: "FR", dialCode: "+33" },
  { name: "Japan", code: "JP", dialCode: "+81" },
  { name: "India", code: "IN", dialCode: "+91" },
  { name: "Brazil", code: "BR", dialCode: "+55" },
  { name: "Afghanistan", code: "AF", dialCode: "+93" },
  { name: "Aland Islands", code: "AX", dialCode: "+358" },
  { name: "Albania", code: "AL", dialCode: "+355" },
  { name: "Algeria", code: "DZ", dialCode: "+213" },
  { name: "American Samoa", code: "AS", dialCode: "+1684" },
  { name: "Andorra", code: "AD", dialCode: "+376" },
  { name: "Angola", code: "AO", dialCode: "+244" },
  { name: "Anguilla", code: "AI", dialCode: "+1264" },
  { name: "Antarctica", code: "AQ", dialCode: "+672" },
  { name: "Antigua and Barbuda", code: "AG", dialCode: "+1268" },
  { name: "Argentina", code: "AR", dialCode: "+54" },
  { name: "Armenia", code: "AM", dialCode: "+374" },
  { name: "Aruba", code: "AW", dialCode: "+297" },
  { name: "Austria", code: "AT", dialCode: "+43" },
  { name: "Azerbaijan", code: "AZ", dialCode: "+994" },
  { name: "Bahamas", code: "BS", dialCode: "+1242" },
  { name: "Bahrain", code: "BH", dialCode: "+973" },
  { name: "Bangladesh", code: "BD", dialCode: "+880" },
  { name: "Barbados", code: "BB", dialCode: "+1246" },
  { name: "Belarus", code: "BY", dialCode: "+375" },
  { name: "Belgium", code: "BE", dialCode: "+32" },
  { name: "Belize", code: "BZ", dialCode: "+501" },
  { name: "Benin", code: "BJ", dialCode: "+229" },
  { name: "Bermuda", code: "BM", dialCode: "+1441" },
  { name: "Bhutan", code: "BT", dialCode: "+975" },
  { name: "Bolivia", code: "BO", dialCode: "+591" },
  { name: "Bosnia and Herzegovina", code: "BA", dialCode: "+387" },
  { name: "Botswana", code: "BW", dialCode: "+267" },
  { name: "British Indian Ocean Territory", code: "IO", dialCode: "+246" },
  { name: "Brunei Darussalam", code: "BN", dialCode: "+673" },
  { name: "Bulgaria", code: "BG", dialCode: "+359" },
  { name: "Burkina Faso", code: "BF", dialCode: "+226" },
  { name: "Burundi", code: "BI", dialCode: "+257" },
  { name: "Cambodia", code: "KH", dialCode: "+855" },
  { name: "Cameroon", code: "CM", dialCode: "+237" },
  { name: "Cape Verde", code: "CV", dialCode: "+238" },
  { name: "Cayman Islands", code: "KY", dialCode: "+1345" },
  { name: "Central African Republic", code: "CF", dialCode: "+236" },
  { name: "Chad", code: "TD", dialCode: "+235" },
  { name: "Chile", code: "CL", dialCode: "+56" },
  { name: "China", code: "CN", dialCode: "+86" },
  { name: "Christmas Island", code: "CX", dialCode: "+61" },
  { name: "Cocos (Keeling) Islands", code: "CC", dialCode: "+61" },
  { name: "Colombia", code: "CO", dialCode: "+57" },
  { name: "Comoros", code: "KM", dialCode: "+269" },
  { name: "Congo", code: "CG", dialCode: "+242" },
  { name: "Congo, The Democratic Republic of the", code: "CD", dialCode: "+243" },
  { name: "Cook Islands", code: "CK", dialCode: "+682" },
  { name: "Costa Rica", code: "CR", dialCode: "+506" },
  { name: "Cote D'Ivoire", code: "CI", dialCode: "+225" },
  { name: "Croatia", code: "HR", dialCode: "+385" },
  { name: "Cuba", code: "CU", dialCode: "+53" },
  { name: "Cyprus", code: "CY", dialCode: "+357" },
  { name: "Czech Republic", code: "CZ", dialCode: "+420" },
  { name: "Denmark", code: "DK", dialCode: "+45" },
  { name: "Djibouti", code: "DJ", dialCode: "+253" },
  { name: "Dominica", code: "DM", dialCode: "+1767" },
  { name: "Dominican Republic", code: "DO", dialCode: "+1809" },
  { name: "Ecuador", code: "EC", dialCode: "+593" },
  { name: "Egypt", code: "EG", dialCode: "+20" },
  { name: "El Salvador", code: "SV", dialCode: "+503" },
  { name: "Equatorial Guinea", code: "GQ", dialCode: "+240" },
  { name: "Eritrea", code: "ER", dialCode: "+291" },
  { name: "Estonia", code: "EE", dialCode: "+372" },
  { name: "Ethiopia", code: "ET", dialCode: "+251" },
  { name: "Falkland Islands (Malvinas)", code: "FK", dialCode: "+500" },
  { name: "Faroe Islands", code: "FO", dialCode: "+298" },
  { name: "Fiji", code: "FJ", dialCode: "+679" },
  { name: "Finland", code: "FI", dialCode: "+358" },
  { name: "French Guiana", code: "GF", dialCode: "+594" },
  { name: "French Polynesia", code: "PF", dialCode: "+689" },
  { name: "Gabon", code: "GA", dialCode: "+241" },
  { name: "Gambia", code: "GM", dialCode: "+220" },
  { name: "Georgia", code: "GE", dialCode: "+995" },
  { name: "Ghana", code: "GH", dialCode: "+233" },
  { name: "Gibraltar", code: "GI", dialCode: "+350" },
  { name: "Greece", code: "GR", dialCode: "+30" },
  { name: "Greenland", code: "GL", dialCode: "+299" },
  { name: "Grenada", code: "GD", dialCode: "+1473" },
  { name: "Guadeloupe", code: "GP", dialCode: "+590" },
  { name: "Guam", code: "GU", dialCode: "+1671" },
  { name: "Guatemala", code: "GT", dialCode: "+502" },
  { name: "Guernsey", code: "GG", dialCode: "+44" },
  { name: "Guinea", code: "GN", dialCode: "+224" },
  { name: "Guinea-Bissau", code: "GW", dialCode: "+245" },
  { name: "Guyana", code: "GY", dialCode: "+592" },
  { name: "Haiti", code: "HT", dialCode: "+509" },
  { name: "Holy See (Vatican City State)", code: "VA", dialCode: "+379" },
  { name: "Honduras", code: "HN", dialCode: "+504" },
  { name: "Hong Kong", code: "HK", dialCode: "+852" },
  { name: "Hungary", code: "HU", dialCode: "+36" },
  { name: "Iceland", code: "IS", dialCode: "+354" },
  { name: "Indonesia", code: "ID", dialCode: "+62" },
  { name: "Iran, Islamic Republic Of", code: "IR", dialCode: "+98" },
  { name: "Iraq", code: "IQ", dialCode: "+964" },
  { name: "Ireland", code: "IE", dialCode: "+353" },
  { name: "Isle of Man", code: "IM", dialCode: "+44" },
  { name: "Israel", code: "IL", dialCode: "+972" },
  { name: "Italy", code: "IT", dialCode: "+39" },
  { name: "Jamaica", code: "JM", dialCode: "+1876" },
  { name: "Jersey", code: "JE", dialCode: "+44" },
  { name: "Jordan", code: "JO", dialCode: "+962" },
  { name: "Kazakhstan", code: "KZ", dialCode: "+7" },
  { name: "Kenya", code: "KE", dialCode: "+254" },
  { name: "Kiribati", code: "KI", dialCode: "+686" },
  { name: "Korea, Democratic People's Republic of", code: "KP", dialCode: "+850" },
  { name: "Korea, Republic of", code: "KR", dialCode: "+82" },
  { name: "Kuwait", code: "KW", dialCode: "+965" },
  { name: "Kyrgyzstan", code: "KG", dialCode: "+996" },
  { name: "Lao People's Democratic Republic", code: "LA", dialCode: "+856" },
  { name: "Latvia", code: "LV", dialCode: "+371" },
  { name: "Lebanon", code: "LB", dialCode: "+961" },
  { name: "Lesotho", code: "LS", dialCode: "+266" },
  { name: "Liberia", code: "LR", dialCode: "+231" },
  { name: "Libyan Arab Jamahiriya", code: "LY", dialCode: "+218" },
  { name: "Liechtenstein", code: "LI", dialCode: "+423" },
  { name: "Lithuania", code: "LT", dialCode: "+370" },
  { name: "Luxembourg", code: "LU", dialCode: "+352" },
  { name: "Macao", code: "MO", dialCode: "+853" },
  { name: "Macedonia, The Former Yugoslav Republic of", code: "MK", dialCode: "+389" },
  { name: "Madagascar", code: "MG", dialCode: "+261" },
  { name: "Malawi", code: "MW", dialCode: "+265" },
  { name: "Malaysia", code: "MY", dialCode: "+60" },
  { name: "Maldives", code: "MV", dialCode: "+960" },
  { name: "Mali", code: "ML", dialCode: "+223" },
  { name: "Malta", code: "MT", dialCode: "+356" },
  { name: "Marshall Islands", code: "MH", dialCode: "+692" },
  { name: "Martinique", code: "MQ", dialCode: "+596" },
  { name: "Mauritania", code: "MR", dialCode: "+222" },
  { name: "Mauritius", code: "MU", dialCode: "+230" },
  { name: "Mayotte", code: "YT", dialCode: "+262" },
  { name: "Mexico", code: "MX", dialCode: "+52" },
  { name: "Micronesia, Federated States of", code: "FM", dialCode: "+691" },
  { name: "Moldova, Republic of", code: "MD", dialCode: "+373" },
  { name: "Monaco", code: "MC", dialCode: "+377" },
  { name: "Mongolia", code: "MN", dialCode: "+976" },
  { name: "Montenegro", code: "ME", dialCode: "+382" },
  { name: "Montserrat", code: "MS", dialCode: "+1664" },
  { name: "Morocco", code: "MA", dialCode: "+212" },
  { name: "Mozambique", code: "MZ", dialCode: "+258" },
  { name: "Myanmar", code: "MM", dialCode: "+95" },
  { name: "Namibia", code: "NA", dialCode: "+264" },
  { name: "Nauru", code: "NR", dialCode: "+674" },
  { name: "Nepal", code: "NP", dialCode: "+977" },
  { name: "Netherlands", code: "NL", dialCode: "+31" },
  { name: "Netherlands Antilles", code: "AN", dialCode: "+599" },
  { name: "New Caledonia", code: "NC", dialCode: "+687" },
  { name: "New Zealand", code: "NZ", dialCode: "+64" },
  { name: "Nicaragua", code: "NI", dialCode: "+505" },
  { name: "Niger", code: "NE", dialCode: "+227" },
  { name: "Nigeria", code: "NG", dialCode: "+234" },
  { name: "Niue", code: "NU", dialCode: "+683" },
  { name: "Norfolk Island", code: "NF", dialCode: "+672" },
  { name: "Northern Mariana Islands", code: "MP", dialCode: "+1670" },
  { name: "Norway", code: "NO", dialCode: "+47" },
  { name: "Oman", code: "OM", dialCode: "+968" },
  { name: "Pakistan", code: "PK", dialCode: "+92" },
  { name: "Palau", code: "PW", dialCode: "+680" },
  { name: "Palestinian Territory, Occupied", code: "PS", dialCode: "+970" },
  { name: "Panama", code: "PA", dialCode: "+507" },
  { name: "Papua New Guinea", code: "PG", dialCode: "+675" },
  { name: "Paraguay", code: "PY", dialCode: "+595" },
  { name: "Peru", code: "PE", dialCode: "+51" },
  { name: "Philippines", code: "PH", dialCode: "+63" },
  { name: "Pitcairn", code: "PN", dialCode: "+870" },
  { name: "Poland", code: "PL", dialCode: "+48" },
  { name: "Portugal", code: "PT", dialCode: "+351" },
  { name: "Puerto Rico", code: "PR", dialCode: "+1" },
  { name: "Qatar", code: "QA", dialCode: "+974" },
  { name: "Reunion", code: "RE", dialCode: "+262" },
  { name: "Romania", code: "RO", dialCode: "+40" },
  { name: "Russian Federation", code: "RU", dialCode: "+7" },
  { name: "Rwanda", code: "RW", dialCode: "+250" },
  { name: "Saint Barthelemy", code: "BL", dialCode: "+590" },
  { name: "Saint Helena", code: "SH", dialCode: "+290" },
  { name: "Saint Kitts and Nevis", code: "KN", dialCode: "+1869" },
  { name: "Saint Lucia", code: "LC", dialCode: "+1758" },
  { name: "Saint Martin", code: "MF", dialCode: "+590" },
  { name: "Saint Pierre and Miquelon", code: "PM", dialCode: "+508" },
  { name: "Saint Vincent and the Grenadines", code: "VC", dialCode: "+1784" },
  { name: "Samoa", code: "WS", dialCode: "+685" },
  { name: "San Marino", code: "SM", dialCode: "+378" },
  { name: "Sao Tome and Principe", code: "ST", dialCode: "+239" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966" },
  { name: "Senegal", code: "SN", dialCode: "+221" },
  { name: "Serbia", code: "RS", dialCode: "+381" },
  { name: "Seychelles", code: "SC", dialCode: "+248" },
  { name: "Sierra Leone", code: "SL", dialCode: "+232" },
  { name: "Singapore", code: "SG", dialCode: "+65" },
  { name: "Slovakia", code: "SK", dialCode: "+421" },
  { name: "Slovenia", code: "SI", dialCode: "+386" },
  { name: "Solomon Islands", code: "SB", dialCode: "+677" },
  { name: "Somalia", code: "SO", dialCode: "+252" },
  { name: "South Africa", code: "ZA", dialCode: "+27" },
  // { name: "South Georgia and the South Sandwich Islands", code: "GS", dialCode: "+500" }, // Duplicate "ZA" was here
  { name: "Spain", code: "ES", dialCode: "+34" },
  { name: "Sri Lanka", code: "LK", dialCode: "+94" },
  { name: "Sudan", code: "SD", dialCode: "+249" },
  { name: "Suriname", code: "SR", dialCode: "+597" },
  { name: "Svalbard and Jan Mayen", code: "SJ", dialCode: "+47" },
  { name: "Swaziland", code: "SZ", dialCode: "+268" },
  { name: "Sweden", code: "SE", dialCode: "+46" },
  { name: "Switzerland", code: "CH", dialCode: "+41" },
  { name: "Syrian Arab Republic", code: "SY", dialCode: "+963" },
  { name: "Taiwan, Province of China", code: "TW", dialCode: "+886" },
  { name: "Tajikistan", code: "TJ", dialCode: "+992" },
  { name: "Tanzania, United Republic of", code: "TZ", dialCode: "+255" },
  { name: "Thailand", code: "TH", dialCode: "+66" },
  { name: "Timor-Leste", code: "TL", dialCode: "+670" },
  { name: "Togo", code: "TG", dialCode: "+228" },
  { name: "Tokelau", code: "TK", dialCode: "+690" },
  { name: "Tonga", code: "TO", dialCode: "+676" },
  { name: "Trinidad and Tobago", code: "TT", dialCode: "+1868" },
  { name: "Tunisia", code: "TN", dialCode: "+216" },
  { name: "Turkey", code: "TR", dialCode: "+90" },
  { name: "Turkmenistan", code: "TM", dialCode: "+993" },
  { name: "Turks and Caicos Islands", code: "TC", dialCode: "+1649" },
  { name: "Tuvalu", code: "TV", dialCode: "+688" },
  { name: "Uganda", code: "UG", dialCode: "+256" },
  { name: "Ukraine", code: "UA", dialCode: "+380" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971" },
  { name: "Uruguay", code: "UY", dialCode: "+598" },
  { name: "Uzbekistan", code: "UZ", dialCode: "+998" },
  { name: "Vanuatu", code: "VU", dialCode: "+678" },
  { name: "Venezuela", code: "VE", dialCode: "+58" },
  { name: "Vietnam", code: "VN", dialCode: "+84" },
  { name: "Virgin Islands, British", code: "VG", dialCode: "+1284" },
  { name: "Virgin Islands, U.S.", code: "VI", dialCode: "+1340" },
  { name: "Wallis and Futuna", code: "WF", dialCode: "+681" },
  { name: "Western Sahara", code: "EH", dialCode: "+212" },
  { name: "Yemen", code: "YE", dialCode: "+967" },
  { name: "Zambia", code: "ZM", dialCode: "+260" },
  { name: "Zimbabwe", code: "ZW", dialCode: "+263" }
];

const commonAllergies = ["Peanuts", "Shellfish", "Dairy", "Gluten", "Soy", "Eggs", "Tree Nuts", "Fish", "Sesame", "Mustard", "Wheat", "Celery", "Lupin", "Molluscs", "Sulphites"];
const commonDietaryRestrictions = ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Nut-Free", "Soy-Free", "Halal", "Kosher", "Paleo", "Keto", "Low FODMAP", "Pescatarian", "No Pork", "No Red Meat"];
const commonFavoriteCuisines = ["Italian", "Mexican", "Chinese", "Indian", "Japanese", "Thai", "Mediterranean", "French", "American", "Korean", "Vietnamese", "Spanish", "Greek", "Lebanese", "Brazilian", "Caribbean"];
const commonActivityTypes = ["Hiking", "Concerts", "Museums", "Dining Out", "Sports Events", "Movies", "Reading", "Board Games", "Nightlife", "Volunteering", "Cooking Class", "Art Workshop", "Photography", "Yoga/Meditation", "Dancing", "Travel", "Gaming", "Outdoor Sports"];
const commonPhysicalLimitations = ["Difficulty with stairs", "Limited mobility (long distance)", "Wheelchair user", "Visual impairment", "Hearing impairment", "Requires frequent breaks", "Cannot stand for long periods"];
const commonEnvironmentalSensitivities = ["Smoke", "Loud Noises", "Bright Lights", "Strong Scents", "Pollen", "Dust", "Crowds", "Temperature Extremes"];

const preferredGroupSizeOptions = ["Solo", "One-on-one", "Small (2-4 people)", "Medium (5-8 people)", "Large (8+ people)", "No preference"];
const preferredInteractionLevelOptions = ["Mostly observing", "Light conversation", "Balanced mix", "Very talkative & engaging", "Depends on context"];

const getCountryFlagEmoji = (countryCode: string | null | undefined): string => {
  if (!countryCode || countryCode.length !== 2) return '🏳️'; // Default or international flag
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 0x1F1E6 + (char.charCodeAt(0) - 'A'.charCodeAt(0)));
  return String.fromCodePoint(...codePoints);
};

const onboardingFormSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100).optional().nullable(),
  username: z.string().optional().nullable(),
  bio: z.string().max(160, { message: "Bio cannot exceed 160 characters."}).optional().nullable(),
  selectedCountryCode: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  birthDate: z.string().optional().refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: "Birth date must be in YYYY-MM-DD format or empty.",
  }).nullable(),
  physicalAddress: z.object({
    street: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    zipCode: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
  }).optional().nullable(),
  allergies: z.array(z.string()).optional().default([]),
  dietaryRestrictions: z.array(z.string()).optional().default([]),
  generalPreferences: z.string().max(500).optional().nullable(),
  favoriteCuisines: z.array(z.string()).optional().default([]),
  physicalLimitations: z.array(z.string()).optional().default([]),
  activityTypePreferences: z.array(z.string()).optional().default([]),
  activityTypeDislikes: z.array(z.string()).optional().default([]),
  environmentalSensitivities: z.array(z.string()).optional().default([]),
  travelTolerance: z.string().optional().nullable(),
  budgetFlexibilityNotes: z.string().max(300).optional().nullable(),
  socialPreferences: z.object({
    preferredGroupSize: z.string().optional().nullable(),
    interactionLevel: z.string().optional().nullable(),
  }).optional().nullable(),
  availabilityNotes: z.string().max(500).optional().nullable(),
});

type OnboardingFormValues = z.infer<typeof onboardingFormSchema>;

const steps = [
  { id: 1, title: 'Personal Details', icon: User, fields: ['name', 'username', 'bio', 'selectedCountryCode', 'phoneNumber', 'birthDate', 'physicalAddress.street', 'physicalAddress.city', 'physicalAddress.state', 'physicalAddress.zipCode', 'physicalAddress.country'] },
  { id: 2, title: 'Health & Culinary', icon: Heart, fields: ['allergies', 'dietaryRestrictions', 'favoriteCuisines', 'generalPreferences'] },
  { id: 3, title: 'Activity & Lifestyle', icon: Activity, fields: ['physicalLimitations', 'activityTypePreferences', 'activityTypeDislikes', 'environmentalSensitivities', 'travelTolerance', 'budgetFlexibilityNotes'] },
  { id: 4, title: 'Social & Availability', icon: UsersIcon, fields: ['socialPreferences.preferredGroupSize', 'socialPreferences.interactionLevel', 'availabilityNotes'] }
];


interface MultiSelectComboboxProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

const MultiSelectCombobox: React.FC<MultiSelectComboboxProps> = ({
  options,
  selected,
  onChange,
  placeholder,
  label,
  description,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const handleSelect = (option: string) => {
    const newSelected = selected.includes(option)
      ? selected.filter(item => item !== option)
      : [...selected, option];
    onChange(newSelected);
  };

  const handleCustomAdd = () => {
    if (inputValue.trim() && !selected.includes(inputValue.trim()) && !options.map(o => o.toLowerCase()).includes(inputValue.trim().toLowerCase())) {
      onChange([...selected, inputValue.trim()]);
    }
    setInputValue('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && inputValue.trim()) {
      event.preventDefault();
      handleCustomAdd();
    }
  };

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(inputValue.toLowerCase()) && !selected.includes(option)
  );

  return (
    <FormItem className="space-y-1">
      <FormLabel className="text-xs">{label}</FormLabel>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {selected.map(item => (
            <Badge key={item} variant="secondary" className="text-xs h-6 px-1.5 py-0.5">
              {item}
              <button
                type="button"
                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-1 focus:ring-ring focus:ring-offset-1"
                onClick={() => !disabled && handleSelect(item)}
                aria-label={`Remove ${item}`}
                disabled={disabled}
              >
                <XIcon className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between text-xs h-9 px-3 py-2 text-muted-foreground" disabled={disabled}>
            {placeholder}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              ref={inputRef}
              placeholder="Type or select..."
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={handleKeyDown}
              className="h-9 text-xs"
              disabled={disabled}
            />
            <CommandList>
              <CommandEmpty>
                {inputValue.trim() && !options.map(o => o.toLowerCase()).includes(inputValue.trim().toLowerCase())
                  ? "Press Enter to add custom item."
                  : "No results found."}
              </CommandEmpty>
              <ScrollArea className="h-[150px] custom-scrollbar-vertical">
                <CommandGroup>
                  {filteredOptions.map(option => (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => {
                        handleSelect(option);
                        setInputValue('');
                      }}
                      className="text-xs"
                    >
                      <Check className={cn("mr-2 h-3 w-3", selected.includes(option) ? "opacity-100" : "opacity-0")} />
                      {option}
                    </CommandItem>
                  ))}
                  {inputValue.trim() && !options.map(o => o.toLowerCase()).includes(inputValue.trim().toLowerCase()) && !selected.includes(inputValue.trim()) && (
                    <CommandItem
                      key={`add-${inputValue.trim()}`}
                      value={inputValue.trim()}
                      onSelect={() => {
                        handleCustomAdd();
                      }}
                      className="text-xs italic"
                    >
                      <Check className={cn("mr-2 h-3 w-3", "opacity-0")} />
                      Add "{inputValue.trim()}"
                    </CommandItem>
                  )}
                </CommandGroup>
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {description && <FormDescription className="text-xs">{description}</FormDescription>}
      <FormMessage className="text-xs" />
    </FormItem>
  );
};

interface SingleSelectComboboxProps {
  options: string[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

const SingleSelectCombobox: React.FC<SingleSelectComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder,
  label,
  description,
  disabled = false,
}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayValue = value ? options.find(opt => opt === value) || value : placeholder;

  return (
    <FormItem className="space-y-1">
      <FormLabel className="text-xs">{label}</FormLabel>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              role="combobox"
              disabled={disabled}
              className={cn(
                "w-full justify-between text-xs h-9 px-3 py-2",
                !value && "text-muted-foreground"
              )}
            >
              <span className="truncate">{displayValue}</span>
              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder="Search..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="h-9 text-xs"
              disabled={disabled}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <ScrollArea className="h-[150px] custom-scrollbar-vertical">
                <CommandGroup>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => {
                        onChange(option === value ? null : option);
                        setIsPopoverOpen(false);
                        setSearchTerm('');
                      }}
                      className="text-xs"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3 w-3",
                          value === option ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {description && <FormDescription className="text-xs">{description}</FormDescription>}
      <FormMessage className="text-xs" />
    </FormItem>
  );
};


export default function OnboardingPage() {
  // ALL HOOKS MUST BE AT THE TOP LEVEL
  const { user, loading: authLoading, currentUserProfile, isNewUserJustSignedUp, acknowledgeNewUserWelcome, refreshProfileStatus, profileExists, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showWelcomeDialogState, setShowWelcomeDialogState] = useState(false);
  const [countrySearchTerm, setCountrySearchTerm] = useState('');
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: {
      bio: currentUserProfile?.bio || '',
      selectedCountryCode: countries.find(c => c.dialCode === currentUserProfile?.countryDialCode)?.code ||
                           countries.find(c => c.code === currentUserProfile?.countryDialCode)?.code || // Fallback if dialCode wasn't stored but country code was
                           null,
      phoneNumber: currentUserProfile?.phoneNumber || user?.phoneNumber?.replace(currentUserProfile?.countryDialCode || '', '') || '',
      birthDate: currentUserProfile?.birthDate && typeof currentUserProfile.birthDate !== 'string' && typeof (currentUserProfile.birthDate as any)?.toDate === 'function'
        ? (currentUserProfile.birthDate as any).toDate().toISOString().split('T')[0]
        : (typeof currentUserProfile?.birthDate === 'string' ? currentUserProfile.birthDate.split('T')[0] : ''),
      physicalAddress: currentUserProfile?.physicalAddress || { street: '', city: '', state: '', zipCode: '', country: '' },
      allergies: currentUserProfile?.allergies || [],
      dietaryRestrictions: currentUserProfile?.dietaryRestrictions || [],
      generalPreferences: currentUserProfile?.generalPreferences || '',
      favoriteCuisines: currentUserProfile?.favoriteCuisines || [],
      physicalLimitations: currentUserProfile?.physicalLimitations || [],
      activityTypePreferences: currentUserProfile?.activityTypePreferences || [],
      activityTypeDislikes: currentUserProfile?.activityTypeDislikes || [],
      environmentalSensitivities: currentUserProfile?.environmentalSensitivities || [],
      travelTolerance: currentUserProfile?.travelTolerance || '',
      budgetFlexibilityNotes: currentUserProfile?.budgetFlexibilityNotes || '',
      socialPreferences: currentUserProfile?.socialPreferences || { preferredGroupSize: null, interactionLevel: null },
      availabilityNotes: currentUserProfile?.availabilityNotes || '',
    },
  });

  const selectedCountryCodeValue = form.watch('selectedCountryCode');
  const previousPathnameRef = useRef(pathname); // For detecting actual navigation vs. query param changes

  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam && pathname === previousPathnameRef.current) { // Only update step if path itself hasn't changed
      const stepNumber = parseInt(stepParam, 10);
      if (!isNaN(stepNumber) && stepNumber >= 1 && stepNumber <= steps.length) {
        setCurrentStep(stepNumber);
      }
    }
    previousPathnameRef.current = pathname;
  }, [searchParams, pathname]);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to settle

    if (user && isNewUserJustSignedUp && (profileExists === false || profileExists === null)) {
      setShowWelcomeDialogState(true);
    } else {
      setShowWelcomeDialogState(false);
    }
  }, [user, authLoading, isNewUserJustSignedUp, profileExists]);

  const handleStartOnboarding = () => {
    setShowWelcomeDialogState(false);
    acknowledgeNewUserWelcome();
  };

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (form.formState.isDirty && !isSubmitting && !showWelcomeDialogState) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [form.formState.isDirty, isSubmitting, showWelcomeDialogState]);

  const filteredCountries = useMemo(() => {
    if (!countrySearchTerm) return countries;
    const lowerSearchTerm = countrySearchTerm.toLowerCase();
    return countries.filter(country =>
      country.name.toLowerCase().includes(lowerSearchTerm) ||
      country.code.toLowerCase().includes(lowerSearchTerm) ||
      country.dialCode.includes(lowerSearchTerm)
    );
  }, [countrySearchTerm]);

  useEffect(() => {
    if (currentUserProfile) {
      form.reset({
        name: currentUserProfile.name || user?.displayName || '',
        bio: currentUserProfile.bio || '',
        selectedCountryCode: countries.find(c => c.dialCode === currentUserProfile.countryDialCode)?.code ||
                           countries.find(c => c.code === currentUserProfile.countryDialCode)?.code ||
                           null,
        phoneNumber: currentUserProfile.phoneNumber || user?.phoneNumber?.replace(currentUserProfile.countryDialCode || '', '') || '',
        birthDate: currentUserProfile.birthDate && typeof currentUserProfile.birthDate !== 'string' && typeof (currentUserProfile.birthDate as any)?.toDate === 'function'
          ? (currentUserProfile.birthDate as any).toDate().toISOString().split('T')[0]
          : (typeof currentUserProfile.birthDate === 'string' ? currentUserProfile.birthDate.split('T')[0] : ''),
        physicalAddress: currentUserProfile.physicalAddress || { street: '', city: '', state: '', zipCode: '', country: '' },
        allergies: currentUserProfile.allergies || [],
        dietaryRestrictions: currentUserProfile.dietaryRestrictions || [],
        generalPreferences: currentUserProfile.generalPreferences || '',
        favoriteCuisines: currentUserProfile.favoriteCuisines || [],
        physicalLimitations: currentUserProfile.physicalLimitations || [],
        activityTypePreferences: currentUserProfile.activityTypePreferences || [],
        activityTypeDislikes: currentUserProfile.activityTypeDislikes || [],
        environmentalSensitivities: currentUserProfile.environmentalSensitivities || [],
        travelTolerance: currentUserProfile.travelTolerance || '',
        budgetFlexibilityNotes: currentUserProfile.budgetFlexibilityNotes || '',
        socialPreferences: currentUserProfile.socialPreferences || { preferredGroupSize: null, interactionLevel: null },
        availabilityNotes: currentUserProfile.availabilityNotes || '',
      });
    } else if (user && !currentUserProfile && !authLoading) {
      // Pre-fill for a new user if some info is available from Firebase Auth user
      // For new users, the Google data will be available in the user-data API response
      // but since currentUserProfile is null here, we'll use the displayName from Firebase Auth
      form.reset({
        name: user.displayName || '',
        bio: '',
        selectedCountryCode: null,
        phoneNumber: user.phoneNumber || '',
        birthDate: '',
        physicalAddress: { street: '', city: '', state: '', zipCode: '', country: '' },
        allergies: [], dietaryRestrictions: [], generalPreferences: '', favoriteCuisines: [],
        physicalLimitations: [], activityTypePreferences: [], activityTypeDislikes: [], environmentalSensitivities: [],
        travelTolerance: '', budgetFlexibilityNotes: '',
        socialPreferences: { preferredGroupSize: null, interactionLevel: null },
        availabilityNotes: '',
      });
    }
  }, [currentUserProfile, user, authLoading, form.reset]);


  const onSubmit = async (data: OnboardingFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const authUserDataPayload = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      };

      const selectedCountryObject = countries.find(c => c.code === data.selectedCountryCode);
      const countryDialCodeForAction = selectedCountryObject ? selectedCountryObject.dialCode : null;

      const profileDataForAction: OnboardingProfileData = {
        ...data,
        countryDialCode: countryDialCodeForAction,
        birthDate: data.birthDate || null,
        phoneNumber: data.phoneNumber || null,
      };

      const result = await completeOnboardingAction(profileDataForAction, authUserDataPayload);

      if (result.success) {
        toast({
          title: currentUserProfile ? "Profile Updated!" : "Onboarding Complete!",
          description: currentUserProfile ? "Your profile has been saved." : "Welcome to Macaroom!",
        });
        await refreshProfileStatus();
        if (!currentUserProfile) { 
          acknowledgeNewUserWelcome();
        }
        router.push('/feed');
      } else {
        toast({ title: "Save Failed", description: result.error || "An unknown error occurred.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Onboarding submission error:", error);
      toast({ title: "Error", description: `Could not save profile: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1);
      router.replace(`/onboarding?step=${currentStep + 1}`, { scroll: false });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      router.replace(`/onboarding?step=${currentStep - 1}`, { scroll: false });
    }
  };

  if (authLoading && !user && !showWelcomeDialogState) {
    return (
      <div className="min-h-screen flex flex-col pt-8 pb-4 px-4">
        <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const currentSelectedCountryData = countries.find(c => c.code === selectedCountryCodeValue);
  const userInitial = user?.displayName ? user.displayName.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U');
  const progressValue = (currentStep / steps.length) * 100;
  
  const CurrentStepIcon = steps[currentStep -1]?.icon || Edit3;


  return (
    <>
      <Dialog open={showWelcomeDialogState} onOpenChange={(open) => { if (!open) handleStartOnboarding(); }}>
        <DialogContent className="sm:max-w-md bg-card/80 backdrop-blur-sm border-primary/30 text-center p-6 rounded-lg">
          <DialogHeader className="space-y-4 mt-4">
            <div className="text-7xl flex justify-center gap-4">
              <span>🎉</span>
              <span>✨</span>
            </div>
            <DialogTitle className="text-3xl font-bold text-gradient-primary">Account Created!</DialogTitle>
            <DialogDescription className="text-lg text-foreground/90 px-4">
              Welcome to Macaroom! Let's personalize your experience.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={handleStartOnboarding} className="w-full mt-8 mb-4">
            Start Onboarding
          </Button>
        </DialogContent>
      </Dialog>

      {!showWelcomeDialogState && user && (
        <div className="min-h-screen flex flex-col pt-8 pb-4 px-4">
          <div className="w-full max-w-2xl mx-auto flex flex-col">
            <div className="p-4 pb-2">
              {/* Progress Tracker */}
              <OnboardingProgress 
                  steps={[
                    {
                      id: 'personal-details',
                      title: '👤 Personal Details',
                      description: 'Basic information and contact details',
                      completed: currentStep > 1,
                      current: currentStep === 1
                    },
                    {
                      id: 'health-culinary',
                      title: '🍽️ Health & Culinary',
                      description: 'Dietary preferences and restrictions',
                      completed: currentStep > 2,
                      current: currentStep === 2
                    },
                    {
                      id: 'activity-lifestyle',
                      title: '🏃‍♂️ Activity & Lifestyle',
                      description: 'Physical preferences and limitations',
                      completed: currentStep > 3,
                      current: currentStep === 3
                    },
                    {
                      id: 'social-availability',
                      title: '👥 Social & Availability',
                      description: 'Social preferences and schedule',
                      completed: currentStep > 4,
                      current: currentStep === 4
                    }
                  ]}
                  className="mb-2"
                />            </div>

            <Separator className="bg-border/30" />

            <div className="flex flex-col">
              <div className="p-4 pt-2 overflow-y-auto custom-scrollbar-vertical">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 h-full flex flex-col">

                  {currentStep === 1 && (
                    <div className="space-y-3">
                         <FormField
                            control={form.control}
                            name="bio"
                            render={({ field }) => (
                            <FormItem className="space-y-1">
                                <FormLabel className="text-xs">📝 Bio (Optional, max 160 chars)</FormLabel>
                                <FormControl><Textarea placeholder="Tell us a little about yourself..." {...field} value={field.value || ''} className="min-h-[64px] text-sm bg-card border-border" maxLength={160} /></FormControl>
                                <FormMessage className="text-xs" />
                            </FormItem>
                            )}
                        />
                        <div className="flex items-end gap-2">
                            <FormField
                            control={form.control}
                            name="selectedCountryCode"
                            render={({ field }) => (
                                <FormItem className="space-y-1 w-[150px] flex-shrink-0">
                                <FormLabel className="text-xs">🌍 Country Code</FormLabel>
                                <Popover open={isCountryPickerOpen} onOpenChange={setIsCountryPickerOpen}>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isCountryPickerOpen}
                                        className={cn("w-full justify-between text-xs h-9 px-2 py-1", !field.value && "text-muted-foreground")}
                                        >
                                        {currentSelectedCountryData ? (
                                            <span className="flex items-center gap-1.5 truncate">
                                            {getCountryFlagEmoji(currentSelectedCountryData.code)}
                                            {currentSelectedCountryData.dialCode}
                                            </span>
                                        ) : ("Code...")}
                                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                        <CommandInput
                                        placeholder="Search country..."
                                        value={countrySearchTerm}
                                        onValueChange={setCountrySearchTerm}
                                        className="h-9 rounded-b-none border-x-0 border-t-0 focus-visible:ring-0 text-xs"
                                        />
                                        <ScrollArea className="h-[200px] custom-scrollbar-vertical">
                                        <CommandList>
                                            {filteredCountries.length === 0 && (
                                            <CommandEmpty className="p-4 text-center text-xs text-muted-foreground">No country found.</CommandEmpty>
                                            )}
                                            <CommandGroup>
                                            {filteredCountries.map((country) => (
                                                <CommandItem
                                                key={country.code} // Use unique country code as key
                                                value={country.code} // Value for Command filtering/selection logic
                                                onSelect={() => {
                                                    form.setValue("selectedCountryCode", country.code === field.value ? null : country.code, { shouldValidate: true });
                                                    setIsCountryPickerOpen(false);
                                                    setCountrySearchTerm('');
                                                }}
                                                className="flex items-center gap-2 p-2 text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                                >
                                                <span className="w-4">
                                                    {getCountryFlagEmoji(country.code)}
                                                </span>
                                                <span className="flex-1 truncate" title={country.name}>{country.name} ({country.dialCode})</span>
                                                <Check
                                                    className={cn("ml-auto h-3 w-3", field.value === country.code ? "opacity-100" : "opacity-0")}
                                                />
                                                </CommandItem>
                                            ))}
                                            </CommandGroup>
                                        </CommandList>
                                        </ScrollArea>
                                    </Command>
                                    </PopoverContent>
                                </Popover>
                                <FormMessage className="text-xs" />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                                <FormItem className="space-y-1 flex-grow">
                                <FormLabel className="text-xs">📱 Phone Number (Optional)</FormLabel>
                                <FormControl><Input type="tel" placeholder="555-123-4567" {...field} value={field.value || ''} className="h-9 text-sm bg-card border-border" /></FormControl>
                                <FormMessage className="text-xs" />
                                </FormItem>
                            )}
                            />
                        </div>
                        <FormField control={form.control} name="birthDate" render={({ field }) => (
                            <FormItem className="space-y-1">
                            <FormLabel className="text-xs">🎂 Birth Date (Optional)</FormLabel>
                            <FormControl><Input type="date" {...field} value={field.value || ''} className="h-9 text-sm bg-card border-border [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer" /></FormControl>
                            <FormMessage className="text-xs" />
                            </FormItem>
                        )} />
                        <FormLabel className="text-xs block pt-1">🏠 Physical Address (Optional)</FormLabel>
                        <FormField control={form.control} name="physicalAddress.street" render={({ field }) => (
                            <FormItem className="space-y-1">
                            <FormLabel className="text-xs sr-only">Street Address</FormLabel>
                            <FormControl><Input placeholder="Street Address" {...field} value={field.value || ''} className="h-9 text-sm bg-card border-border" /></FormControl>
                            <FormMessage className="text-xs" />
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="physicalAddress.city" render={({ field }) => (
                                <FormItem className="space-y-1"> <FormLabel className="text-xs sr-only">City</FormLabel> <FormControl><Input placeholder="City" {...field} value={field.value || ''} className="h-9 text-sm bg-card border-border" /></FormControl> <FormMessage className="text-xs" /> </FormItem>
                            )} />
                            <FormField control={form.control} name="physicalAddress.zipCode" render={({ field }) => (
                                <FormItem className="space-y-1"> <FormLabel className="text-xs sr-only">Zip/Postal Code</FormLabel> <FormControl><Input placeholder="Zip/Postal Code" {...field} value={field.value || ''} className="h-9 text-sm bg-card border-border" /></FormControl> <FormMessage className="text-xs" /> </FormItem>
                            )} />
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="physicalAddress.state" render={({ field }) => (
                                <FormItem className="space-y-1"> <FormLabel className="text-xs sr-only">State/Province</FormLabel> <FormControl><Input placeholder="State/Province" {...field} value={field.value || ''} className="h-9 text-sm bg-card border-border" /></FormControl> <FormMessage className="text-xs" /> </FormItem>
                            )} />
                             <FormField control={form.control} name="physicalAddress.country" render={({ field }) => (
                                <FormItem className="space-y-1"> <FormLabel className="text-xs sr-only">Country</FormLabel> <FormControl><Input placeholder="Country" {...field} value={field.value || ''} className="h-9 text-sm bg-card border-border" /></FormControl> <FormMessage className="text-xs" /> </FormItem>
                            )} />
                        </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-3">
                      <FormField control={form.control} name="allergies"
                        render={({ field }) => (
                          <MultiSelectCombobox label="🚫 Allergies (Optional)" options={commonAllergies} selected={field.value || []} onChange={field.onChange} placeholder="Select or add allergies..." disabled={isSubmitting} />
                        )} />
                      <FormField control={form.control} name="dietaryRestrictions"
                        render={({ field }) => (
                          <MultiSelectCombobox label="🥗 Dietary Restrictions (Optional)" options={commonDietaryRestrictions} selected={field.value || []} onChange={field.onChange} placeholder="Select or add restrictions..." disabled={isSubmitting} />
                        )} />
                      <FormField control={form.control} name="favoriteCuisines"
                        render={({ field }) => (
                          <MultiSelectCombobox label="🍜 Favorite Cuisines (Optional)" options={commonFavoriteCuisines} selected={field.value || []} onChange={field.onChange} placeholder="Select or add cuisines..." disabled={isSubmitting} />
                        )} />
                      <FormField control={form.control} name="generalPreferences" render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">📋 Other Food Notes/Preferences (Optional)</FormLabel>
                          <FormControl><Textarea placeholder="e.g., Love spicy food, dislike olives, prefer organic" {...field} value={field.value ?? ''} className="min-h-[64px] text-sm bg-card border-border" disabled={isSubmitting} /></FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-3">
                      <FormField control={form.control} name="physicalLimitations"
                        render={({ field }) => (
                          <MultiSelectCombobox label="⚠️ Physical Limitations (Optional)" options={commonPhysicalLimitations} selected={field.value || []} onChange={field.onChange} placeholder="Select or add limitations..." disabled={isSubmitting} />
                        )} />
                      <FormField control={form.control} name="activityTypePreferences"
                        render={({ field }) => (
                          <MultiSelectCombobox label="❤️ Preferred Activity Types (Optional)" options={commonActivityTypes} selected={field.value || []} onChange={field.onChange} placeholder="Select or add preferences..." disabled={isSubmitting} />
                        )} />
                      <FormField control={form.control} name="activityTypeDislikes"
                        render={({ field }) => (
                          <MultiSelectCombobox label="❌ Disliked Activity Types (Optional)" options={commonActivityTypes} selected={field.value || []} onChange={field.onChange} placeholder="Select or add dislikes..." disabled={isSubmitting} />
                        )} />
                      <FormField control={form.control} name="environmentalSensitivities"
                        render={({ field }) => (
                          <MultiSelectCombobox label="🌿 Environmental Sensitivities (Optional)" options={commonEnvironmentalSensitivities} selected={field.value || []} onChange={field.onChange} placeholder="Select or add sensitivities..." disabled={isSubmitting} />
                        )} />
                      <FormField control={form.control} name="travelTolerance" render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">🚗 Travel Tolerance (Optional)</FormLabel>
                          <FormControl><Input placeholder="e.g., Up to 1 hour, prefer local" {...field} value={field.value || ''} className="h-9 text-sm bg-card border-border" disabled={isSubmitting} /></FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="budgetFlexibilityNotes" render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">💰 Budget Notes (Optional)</FormLabel>
                          <FormControl><Textarea placeholder="e.g., Prefer free/cheap, splurge for special occasions" {...field} value={field.value ?? ''} className="min-h-[64px] text-sm bg-card border-border" disabled={isSubmitting} /></FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="socialPreferences.preferredGroupSize"
                        render={({ field }) => (
                          <SingleSelectCombobox
                            label="👥 Preferred Group Size (Optional)"
                            options={preferredGroupSizeOptions}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select preferred group size..."
                            disabled={isSubmitting}
                          />
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="socialPreferences.interactionLevel"
                        render={({ field }) => (
                          <SingleSelectCombobox
                            label="🤝 Preferred Interaction Level (Optional)"
                            options={preferredInteractionLevelOptions}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select interaction level..."
                            disabled={isSubmitting}
                          />
                        )}
                      />
                      <FormField control={form.control} name="availabilityNotes" render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">📅 General Availability Notes (Optional)</FormLabel>
                          <FormControl><Textarea placeholder="e.g., Usually free on weekends, prefer evenings" {...field} value={field.value ?? ''} className="min-h-[64px] text-sm bg-card border-border" disabled={isSubmitting} /></FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                    </div>
                  )}
                  </form>
                </Form>
              </div>
              
              <Separator className="bg-border/30" />
              
              <div className="p-4 pt-3">
                <div className="flex justify-between items-center">
                  {currentStep === 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={signOut}
                      disabled={isSubmitting}
                      className="transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 active:shadow-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label="Log out"
                      size="sm"
                    >
                      <LogOut className="h-4 w-4" /> <span className="hidden sm:inline ml-1.5">Log Out</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handlePrevious}
                      disabled={isSubmitting}
                      className="transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 active:shadow-sm text-muted-foreground hover:text-primary"
                      aria-label="Previous step"
                      size="sm"
                    >
                      <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline ml-1.5">Previous</span>
                    </Button>
                  )}

                  {currentStep < steps.length && (
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={isSubmitting}
                      className='transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 active:shadow-sm'
                      aria-label="Next step"
                      size="sm"
                    >
                      <span className="hidden sm:inline mr-1.5">Next</span> <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                  {currentStep === steps.length && (
                    <Button
                      type="submit"
                      className="w-full md:w-auto ml-auto transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 active:shadow-sm"
                      disabled={isSubmitting || authLoading}
                      size="sm"
                      onClick={form.handleSubmit(onSubmit)}
                    >
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {currentUserProfile ? 'Save Profile' : 'Complete Profile & Start Planning!'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
