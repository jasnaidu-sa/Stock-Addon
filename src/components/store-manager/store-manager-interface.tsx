import React from 'react';
import { WeeklyPlanInterface } from '@/components/shared/weekly-plan-interface';

export function StoreManagerInterface() {
  return (
    <WeeklyPlanInterface
      userRole="store_manager"
      title="Store Manager - Weekly Plan"
      description="Manage weekly plans for your store and submit amendments"
      showSummaryTab={false}
      allowedAmendmentTypes={['store_manager']}
      hierarchyLevel="Store Manager"
    />
  );
}