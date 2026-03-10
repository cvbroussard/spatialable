'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LIBRARY_NAV = [
  { href: '/admin/library', label: 'Dashboard' },
  { href: '/admin/library/assets', label: 'Assets' },
  { href: '/admin/library/products', label: 'Product Sets' },
  { href: '/admin/library/materials', label: 'Materials' },
  { href: '/admin/library/taxonomy', label: 'Taxonomy' },
  { href: '/admin/library/pipeline', label: 'Pipeline' },
  { href: '/admin/library/swatch-jobs', label: 'Swatch Jobs' },
];

const CLIENTS_NAV = [
  { href: '/admin/clients', label: 'Dashboard' },
  { href: '/admin/clients/subscriptions', label: 'Subscriptions' },
  { href: '/admin/clients/stores', label: 'Shopify Stores' },
  { href: '/admin/clients/usage', label: 'Usage' },
];

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
        isActive
          ? 'bg-zinc-100 text-zinc-900 font-medium'
          : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
      }`}
    >
      {label}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white">
        <div className="sticky top-0 flex flex-col h-screen overflow-y-auto">
          {/* Logo */}
          <div className="px-4 py-5 border-b border-zinc-100">
            <Link href="/admin/library" className="text-lg font-bold text-zinc-900">
              SpatialAble
            </Link>
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">Admin</div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-6">
            {/* Library Section */}
            <div>
              <div className="px-3 mb-2 text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Library
              </div>
              <div className="space-y-0.5">
                {LIBRARY_NAV.map((item) => (
                  <NavLink key={item.href} {...item} pathname={pathname} />
                ))}
              </div>
            </div>

            {/* Clients Section */}
            <div>
              <div className="px-3 mb-2 text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Clients
              </div>
              <div className="space-y-0.5">
                {CLIENTS_NAV.map((item) => (
                  <NavLink key={item.href} {...item} pathname={pathname} />
                ))}
              </div>
            </div>
          </nav>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
