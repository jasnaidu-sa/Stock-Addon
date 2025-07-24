import React from 'react';
import { StoreManagerInterface } from '@/components/store-manager/store-manager-interface';

export const TestStoreManagerPage: React.FC = () => {
  return (
    <div>
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h2 className="text-lg font-semibold text-yellow-800 mb-2">🧪 Store Manager Test Interface</h2>
        <p className="text-yellow-700">
          This is a test interface for Store Manager functionality. It allows you to test the store manager workflow 
          for managing weekly plans and submitting amendments.
        </p>
      </div>
      <StoreManagerInterface />
    </div>
  );
};

export default TestStoreManagerPage;