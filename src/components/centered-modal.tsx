"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export type CenteredModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  titleId?: string;
  headerIcon?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  /** Panel width, e.g. max-w-sm, max-w-md */
  maxWidthClass?: string;
  panelClassName?: string;
  /** When true, backdrop, Escape, and header close are disabled (e.g. while saving). */
  closeBlocked?: boolean;
};

/**
 * Centered dialog for mobile and desktop: stays in the visual center with safe-area
 * padding, scrolls when content is tall, and locks body scroll while open.
 */
export function CenteredModal({
  open,
  onClose,
  title,
  titleId = "centered-modal-title",
  headerIcon,
  children,
  footer,
  maxWidthClass = "max-w-sm",
  panelClassName = "",
  closeBlocked = false,
}: CenteredModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeBlocked) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, closeBlocked]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-violet-950/55 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !closeBlocked) onClose();
      }}
    >
      <div
        className="flex min-h-full w-full items-center justify-center p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
      >
        <div
          className={`relative my-4 sm:my-6 flex w-full ${maxWidthClass} max-h-[min(92dvh,640px)] flex-col overflow-hidden rounded-2xl bg-white dark:bg-violet-950 shadow-2xl animate-in zoom-in-95 duration-200 ${panelClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 dark:border-violet-500/15 bg-gray-50/50 dark:bg-violet-900/10 p-4 sm:p-5">
            <h2 id={titleId} className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-violet-100 sm:text-xl">
              {headerIcon}
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={closeBlocked}
              className="rounded-full p-2 text-gray-500 hover:text-gray-800 dark:text-violet-400 dark:hover:text-violet-200 transition-colors hover:bg-gray-200 dark:hover:bg-violet-800/30 disabled:pointer-events-none disabled:opacity-40"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 dark:text-violet-200">{children}</div>

          <div className="shrink-0 border-t border-gray-100 dark:border-violet-500/15 bg-gray-50 dark:bg-violet-900/10 p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
