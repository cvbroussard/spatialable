export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
      <main className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-zinc-900">SpatialAble</h1>
        <p className="text-zinc-500">Spatial Commerce Asset Library</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full text-sm text-green-700">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Operational
        </div>
      </main>
    </div>
  );
}
