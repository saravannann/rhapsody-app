"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { SUPPORTED_COUNTRY_CODES, stripToDigits } from "@/utils/phone";
import { useState, useRef, useEffect } from "react";

type Props = {
  id?: string;
  countryCode: string;
  nationalDigits: string;
  onDigitsChange: (digits: string) => void;
  onCountryCodeChange: (cc: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  LeftIcon?: LucideIcon;
  /** Merged onto the outer flex container */
  className?: string;
  /** Extra classes on the inner input */
  inputClassName?: string;
  /** Prefix strip (default gray) */
  prefixClassName?: string;
};

export function InternationalMobileInput({
  id,
  countryCode,
  nationalDigits,
  onDigitsChange,
  onCountryCodeChange,
  required,
  disabled,
  placeholder = "Enter mobile number",
  LeftIcon,
  className = "",
  inputClassName = "",
  prefixClassName = "bg-gray-50 border-r border-gray-100 dark:bg-violet-950/40 dark:border-violet-500/10",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getFlag = (cc: string) => {
    switch (cc) {
      case "+91": return "🇮🇳";
      case "+1": return "🇺🇸";
      default: return "🌐";
    }
  };

  const getName = (cc: string) => {
    switch (cc) {
      case "+91": return "India";
      case "+1": return "US/CA";
      default: return "Other";
    }
  };

  return (
    <div
      className={`flex min-h-[44px] items-stretch rounded-xl border bg-[#f8fafc] dark:bg-violet-950/35 overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all ${className}`}
    >
      {/* Left Icon (Phone/User) */}
      {LeftIcon ? (
        <span className="pl-3.5 flex items-center text-gray-400 dark:text-violet-400/60 shrink-0" aria-hidden>
          <LeftIcon className="w-4 h-4" />
        </span>
      ) : null}

      {/* Country Selector */}
      <div className="relative flex items-stretch" ref={dropdownRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1.5 px-3 text-sm font-bold select-none hover:bg-gray-100 dark:hover:bg-violet-900/40 transition-colors ${prefixClassName} disabled:opacity-50`}
        >
          <span className="text-base">{getFlag(countryCode)}</span>
          <span className="text-gray-700 dark:text-violet-200">{countryCode}</span>
          <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-violet-900 border border-gray-200 dark:border-violet-500/30 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
            {SUPPORTED_COUNTRY_CODES.map((cc) => (
              <button
                key={cc}
                type="button"
                onClick={() => {
                  onCountryCodeChange(cc);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-700 dark:text-violet-100 hover:bg-gray-50 dark:hover:bg-violet-800/60 transition-colors border-b last:border-0 border-gray-50 dark:border-violet-500/10"
              >
                <span>{getFlag(cc)}</span>
                <span>{cc}</span>
                <span className="text-[10px] text-gray-400 font-medium ml-auto">{getName(cc)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Digits Input */}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        required={required}
        disabled={disabled}
        value={nationalDigits}
        onChange={(e) => onDigitsChange(stripToDigits(e.target.value).slice(0, 10))}
        placeholder={placeholder}
        className={`flex-1 min-w-0 bg-transparent border-0 py-2.5 pr-4 pl-3 text-sm font-bold text-gray-900 dark:text-violet-100 placeholder:text-gray-400 dark:placeholder:text-violet-400/50 focus:outline-none focus:ring-0 disabled:opacity-60 ${inputClassName}`}
      />
    </div>
  );
}
