import { useState } from "react";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Search, X } from "lucide-react";
import { format } from "date-fns";

// Define OrderStatus type directly instead of importing it
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'completed';

interface OrderFiltersProps {
  onFilter: (filters: OrderFilters) => void;
  onReset: () => void;
  onSort: (field: string, direction: 'asc' | 'desc') => void;
  statusOptions: OrderStatus[];
}

export interface OrderFilters {
  orderId: string;
  customerName: string;
  status: OrderStatus | '';
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export function OrderFilters({ onFilter, onReset, onSort, statusOptions }: OrderFiltersProps) {
  // Default handler for missing props to prevent crashes
  const handleFilter = onFilter || (() => {});
  const handleReset = onReset || (() => {});
  const handleSort = onSort || (() => {});
  const options = statusOptions || ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

  const [filters, setFilters] = useState<OrderFilters>({
    orderId: '',
    customerName: '',
    status: '',
    dateFrom: undefined,
    dateTo: undefined
  });
  
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleFilterChange = (key: keyof OrderFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilter(filters);
  };

  const handleResetFilters = () => {
    setFilters({
      orderId: '',
      customerName: '',
      status: '',
      dateFrom: undefined,
      dateTo: undefined
    });
    setSortField('created_at');
    setSortDirection('desc');
    handleReset();
  };

  const handleSortChange = (field: string) => {
    try {
      // If clicking the same field, toggle direction
      if (field === sortField) {
        const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        setSortDirection(newDirection);
        handleSort(field, newDirection);
      } else {
        // New field, default to desc
        setSortField(field);
        setSortDirection('desc');
        handleSort(field, 'desc');
      }
    } catch (error) {
      console.error("Error in sort handling:", error);
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Order ID Filter */}
            <div className="space-y-2">
              <Label htmlFor="orderId">Order ID</Label>
              <Input
                id="orderId"
                placeholder="Search by order ID"
                value={filters.orderId}
                onChange={(e) => handleFilterChange('orderId', e.target.value)}
              />
            </div>
            
            {/* Customer Name Filter */}
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                placeholder="Search by customer name"
                value={filters.customerName}
                onChange={(e) => handleFilterChange('customerName', e.target.value)}
              />
            </div>
            
            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  {options.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Date From Filter */}
            <div className="space-y-2">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateFrom ? (
                      format(filters.dateFrom, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => {
                      // If dateTo is defined and the new dateFrom is after dateTo,
                      // update dateTo to be the same as dateFrom
                      if (date && filters.dateTo && date > filters.dateTo) {
                        handleFilterChange('dateTo', date);
                      }
                      handleFilterChange('dateFrom', date);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Date To Filter */}
            <div className="space-y-2">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateTo ? (
                      format(filters.dateTo, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => {
                      // If dateFrom is defined and the new dateTo is before dateFrom,
                      // update dateFrom to be the same as dateTo
                      if (date && filters.dateFrom && date < filters.dateFrom) {
                        handleFilterChange('dateFrom', date);
                      }
                      handleFilterChange('dateTo', date);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Sort By */}
            <div className="space-y-2">
              <Label htmlFor="sort">Sort By</Label>
              <Select
                value={sortField}
                onValueChange={(value) => handleSortChange(value)}
              >
                <SelectTrigger id="sort">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Date</SelectItem>
                  <SelectItem value="total">Total</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="customer_name">Customer Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Sort Direction */}
            <div className="space-y-2">
              <Label htmlFor="direction">Direction</Label>
              <Select
                value={sortDirection}
                onValueChange={(value: 'asc' | 'desc') => {
                  setSortDirection(value);
                  handleSort(sortField, value);
                }}
              >
                <SelectTrigger id="direction">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest first</SelectItem>
                  <SelectItem value="asc">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleResetFilters}>
              <X className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 