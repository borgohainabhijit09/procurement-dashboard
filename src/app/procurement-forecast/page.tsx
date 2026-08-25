'use client';

import ComingSoon from '@/components/ComingSoon';
import { TrendingUp } from 'lucide-react';

export default function ProcurementForecastPage() {
  return (
    <ComingSoon
      icon={TrendingUp}
      title="Procurement Forecast"
      description="Predictive analytics for procurement planning and budget optimization."
    />
  );
}
