'use client';

import { ClientSwitcher } from './ClientSwitcher';

interface NavProps {
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
  categories: Array<{
    category_path: string;
    name: string;
  }>;
}

export function StorefrontNav({ activeClient, allClients, categories }: NavProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo / Store Name */}
        <a href="/simulator" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-900 rounded-md flex items-center justify-center">
            <span className="text-white text-sm font-bold">SA</span>
          </div>
          <span className="text-lg font-semibold text-gray-900">
            {activeClient?.display_name || 'SpatialAble Simulator'}
          </span>
        </a>

        {/* Category links */}
        <div className="hidden md:flex items-center gap-6">
          {categories.map((cat) => (
            <a
              key={cat.category_path}
              href={`/collection/${cat.category_path}`}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {cat.name}
            </a>
          ))}
        </div>

        {/* Client switcher */}
        <ClientSwitcher
          activeClient={activeClient}
          allClients={allClients}
        />
      </div>
    </nav>
  );
}
