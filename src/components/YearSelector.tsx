"use client";

import React from 'react';
import { useEvents } from '@/context/EventContext';
import { Calendar, ChevronDown } from 'lucide-react';

export function YearSelector() {
  const { events, selectedEventId, setSelectedEventId, loading } = useEvents();

  if (loading || events.length <= 1) return null;

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-2 bg-white dark:bg-violet-950/20 border border-gray-200 dark:border-violet-500/20 rounded-lg px-3 py-1.5 shadow-sm">
        <Calendar className="w-4 h-4 text-primary" />
        <select
          value={selectedEventId || ''}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="bg-transparent text-sm font-bold text-gray-700 dark:text-violet-100 outline-none cursor-pointer appearance-none pr-6"
        >
          {events.map((event) => (
            <option key={event.id} value={event.id} className="dark:bg-[#0F172A]">
              {event.name} ({event.year})
            </option>
          ))}
        </select>
        <div className="absolute right-3 pointer-events-none">
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </div>
      </div>
    </div>
  );
}
