'use client';

import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

export default function ComingSoon({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex p-5 bg-[#E8F0FE] rounded-2xl">
          <Icon size={40} className="text-[#0B5ED7]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-2">{description}</p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
          Coming Soon
        </div>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#0B5ED7] hover:text-[#0840A0] font-medium transition-colors">
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
