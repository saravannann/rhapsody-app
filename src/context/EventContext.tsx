"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/utils/supabase';

interface Event {
  id: string;
  name: string;
  year: number;
  status: string;
  is_default: boolean;
  date: string;
}

interface EventContextType {
  events: Event[];
  selectedEventId: string | null;
  selectedEvent: Event | null;
  setSelectedEventId: (id: string) => void;
  loading: boolean;
  refreshEvents: () => Promise<void>;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export function EventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('year', { ascending: false });

      if (error) throw error;

      setEvents(data || []);

      // Set default event if none selected
      if (!selectedEventId && data && data.length > 0) {
        const defaultEvent = data.find((e: Event) => e.is_default) || data[0];
        setSelectedEventId(defaultEvent.id);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const selectedEvent = events.find(e => e.id === selectedEventId) || null;

  return (
    <EventContext.Provider value={{ 
      events, 
      selectedEventId, 
      selectedEvent, 
      setSelectedEventId, 
      loading,
      refreshEvents: fetchEvents 
    }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvents() {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEvents must be used within an EventProvider');
  }
  return context;
}
