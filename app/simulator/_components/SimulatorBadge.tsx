export function SimulatorBadge() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <a
        href="https://spatialable.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-gray-900 text-white text-xs font-medium px-3 py-2 rounded-full shadow-lg hover:bg-gray-800 transition-colors"
      >
        <div className="w-4 h-4 bg-white rounded-sm flex items-center justify-center">
          <span className="text-gray-900 text-[8px] font-bold">SA</span>
        </div>
        Powered by SpatialAble
      </a>
    </div>
  );
}
