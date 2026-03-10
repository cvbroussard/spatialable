'use client';

import { useState, useRef, useEffect } from 'react';

interface ClientSwitcherProps {
  activeClient: {
    slug: string;
    display_name: string;
    client_id: string;
    tier: string;
  } | null;
  allClients: Array<{
    slug: string;
    display_name: string;
    client_id: string;
    tier: string;
  }>;
}

const TIER_COLORS: Record<string, string> = {
  base: 'bg-gray-100 text-gray-600',
  standard: 'bg-blue-100 text-blue-700',
  premium: 'bg-amber-100 text-amber-700',
};

export function ClientSwitcher({ activeClient, allClients }: ClientSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (allClients.length <= 1) return null;

  function switchClient(clientId: string) {
    // Navigate with query param — middleware sets cookie and redirects
    window.location.href = `?asset_client_id=${clientId}`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
      >
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TIER_COLORS[activeClient?.tier || 'base']}`}>
          {activeClient?.tier || 'base'}
        </span>
        <span>{activeClient?.display_name || 'Select client'}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[220px] z-50">
          {allClients.map((client) => (
            <button
              key={client.client_id}
              onClick={() => switchClient(client.client_id)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-3 ${
                client.client_id === activeClient?.client_id ? 'bg-gray-50 font-medium' : ''
              }`}
            >
              <span>{client.display_name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${TIER_COLORS[client.tier]}`}>
                {client.tier}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
