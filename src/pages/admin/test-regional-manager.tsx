import { RegionalManagerInterface } from '@/components/regional-manager/regional-manager-interface';

export default function TestRegionalManager() {
  return (
    <div>
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h2 className="text-lg font-semibold text-yellow-800 mb-2">🧪 Regional Manager Test Interface</h2>
        <p className="text-yellow-700">
          This is a test interface for Regional Manager functionality. It allows you to test the regional manager workflow 
          for reviewing and approving area manager submissions in the hierarchical submission system.
        </p>
      </div>
      <RegionalManagerInterface />
    </div>
  );
}