'use client';

export function SkeletonCard() {
  return (
    <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-gray-200 w-9 h-9" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-12" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-full animate-pulse" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="h-3 bg-gray-100 rounded flex-1" />
            <div className="h-3 bg-gray-100 rounded flex-1" />
            <div className="h-3 bg-gray-100 rounded flex-1" />
            <div className="h-3 bg-gray-100 rounded w-20" />
            <div className="h-3 bg-gray-100 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-32 mb-4" />
      <div className="h-56 bg-gray-100 rounded" />
    </div>
  );
}
