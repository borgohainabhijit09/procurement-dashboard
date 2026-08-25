'use client';

import { type LucideIcon } from 'lucide-react';

export default function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="p-4 bg-gray-50 rounded-2xl mb-4">
        <Icon size={32} className="text-gray-300" />
      </div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-xs text-gray-400 text-center max-w-xs mb-4">{description}</p>
      {action}
    </div>
  );
}
