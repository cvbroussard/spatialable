import Script from 'next/script';
import { getActiveSimulatorClient, getAllSimulatorClients } from '@/lib/simulator/client';
import { getSimulatorCategories } from '@/lib/simulator/products';
import { StorefrontNav } from './_components/StorefrontNav';
import { SimulatorBadge } from './_components/SimulatorBadge';

export const metadata = {
  title: 'SpatialAble Simulator',
  description: 'Experience SpatialAble spatial commerce media delivery in a live storefront',
};

export default async function SimulatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const activeClient = await getActiveSimulatorClient();
  const allClients = await getAllSimulatorClients();
  const categories = await getSimulatorCategories();

  return (
    <>
      {/* Load <sa-media> web component */}
      <Script src="/embed/loader.js" strategy="afterInteractive" />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__SA_CONFIG__={apiBase:window.location.origin};`,
        }}
      />

      <StorefrontNav
        activeClient={activeClient ? {
          slug: activeClient.slug,
          display_name: activeClient.display_name,
          client_id: activeClient.client_id,
          tier: activeClient.tier,
        } : null}
        allClients={allClients.map((c) => ({
          slug: c.slug,
          display_name: c.display_name,
          client_id: c.client_id,
          tier: c.tier,
        }))}
        categories={categories.map((c) => ({
          category_path: c.category_path,
          name: c.name,
        }))}
      />

      <main className="min-h-screen bg-white pt-16">
        {children}
      </main>

      <SimulatorBadge />
    </>
  );
}
