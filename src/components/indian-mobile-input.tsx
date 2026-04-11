"use client";

import type { LucideIcon } from "lucide-react";
import { nationalDigitsForIndia, INDIA_CC } from "@/utils/phone";

type Props = {
  id?: string;
  value: string;
  onChange: (nationalDigits: string) => void;
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

export function IndianMobileInput({
  id,
  value,
  onChange,
  required,
  disabled,
  placeholder = "98765 43210",
  LeftIcon,
  className = "",
  inputClassName = "",
  prefixClassName = "bg-gray-100/80 border-gray-200 text-slate-600 dark:bg-violet-950/50 dark:border-violet-500/25 dark:text-violet-200",
}: Props) {
  return (
    <div
      className={`flex min-h-[44px] items-stretch rounded-xl border overflow-hidden focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary/30 dark:border-violet-500/20 ${className}`}
    >
      {LeftIcon ? (
        <span className="pl-3 flex items-center text-gray-400 dark:text-violet-400/70 shrink-0" aria-hidden>
          <LeftIcon className="w-4 h-4" />
        </span>
      ) : null}
      <span
        className={`flex items-center px-2.5 sm:px-3 text-sm font-bold border-r shrink-0 select-none ${prefixClassName}`}
      >
        {INDIA_CC}
      </span>
      <input
        id={id}
        type="text"
        name="phone-national"
        inputMode="numeric"
        autoComplete="tel-national"
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(nationalDigitsForIndia(e.target.value))}
        placeholder={placeholder}
        className={`flex-1 min-w-0 bg-transparent border-0 py-2.5 pr-3 pl-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 dark:text-violet-100 dark:placeholder:text-purple-400/45 focus:outline-none focus:ring-0 disabled:opacity-60 ${inputClassName}`}
      />
    </div>
  );
}
