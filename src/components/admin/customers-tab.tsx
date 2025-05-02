import React, { useState } from 'react';
import { Loader2, RefreshCw, Search, ArrowUpDown } from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { SortConfig } from '@/types/common';

interface Customer {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  role?: string;
}

interface CustomersTabProps {
  customers: Customer[];
  loading: boolean;
  sortConfig: SortConfig;
  handleSort: (field: string) => void;
  loadCustomers: () => void;
  formatDate: (date: string) => string;
}

export function CustomersTab({
  customers,
  loading,
  sortConfig,
  handleSort,
  loadCustomers,
  formatDate
}: CustomersTabProps) {
  const [customerSearch, setCustomerSearch] = useState('');

  // Filter customers based on search
  const filteredCustomers = customers.filter(customer => {
    if (!customerSearch) return true;
    
    const searchLower = customerSearch.toLowerCase();
    return (
      (customer.name && customer.name.toLowerCase().includes(searchLower)) ||
      (customer.email && customer.email.toLowerCase().includes(searchLower)) ||
      (customer.role && customer.role.toLowerCase().includes(searchLower))
    );
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Customer Management</CardTitle>
          <CardDescription>View and manage customers</CardDescription>
        </div>
        <Button 
          variant="outline" 
          onClick={loadCustomers}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers by name or email..."
            className="pl-8"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
          />
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No customers found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('name')}
                  >
                    Name
                    {sortConfig.field === 'name' && (
                      <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                    )}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('email')}
                  >
                    Email
                    {sortConfig.field === 'email' && (
                      <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                    )}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('created_at')}
                  >
                    Joined
                    {sortConfig.field === 'created_at' && (
                      <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                    )}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('role')}
                  >
                    Role
                    {sortConfig.field === 'role' && (
                      <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                    )}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      {customer.name || 'Unknown'}
                    </TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{formatDate(customer.created_at)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={customer.role === 'admin' ? 'default' : 'outline'}
                      >
                        {customer.role || 'customer'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 