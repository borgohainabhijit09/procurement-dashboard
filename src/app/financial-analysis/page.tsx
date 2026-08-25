'use client';

import ComingSoon from '@/components/ComingSoon';
import { DollarSign } from 'lucide-react';

export default function FinancialAnalysisPage() {
  return (
    <ComingSoon
      icon={DollarSign}
      title="Financial Analysis"
      description="Cost analysis, budget tracking, and financial reporting for IT operations."
    />
  );
}
