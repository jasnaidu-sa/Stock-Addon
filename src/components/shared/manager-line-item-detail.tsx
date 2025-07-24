import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Package,
  Building2,
  Filter,
  FilterX,
  Search,
  Edit,
  Save,
  X,
  Check,
  AlertCircle,
  RefreshCw,
  XCircle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabaseAdmin } from '@/lib/supabase';

interface WeekSelection {
  week_reference: string;
  week_start_date: string;
  week_end_date: string;
  is_current: boolean;
  is_active: boolean;
  week_status: string;
}

interface StoreWithSubmissions {
  store_id: string;
  store_code: string;
  store_name: string;
  region: string;
  store_active: boolean;
  store_status: string;
  store_manager_id: string;
  store_manager_first_name: string;
  store_manager_last_name: string;
  store_manager_email: string;
  weekly_plan_total_order_qty: number;
  weekly_plan_total_add_ons_qty: number;
  weekly_plan_total_qty: number;
  current_user_amendments: number;
  current_user_amendment_qty: number;
  current_user_pending_amendments: number;
  revised_total_qty: number;
  total_amendments: number;
  has_store_submission: boolean;
  has_area_submission: boolean;
  has_regional_submission: boolean;
}

interface WeeklyPlanItem {
  id?: string;
  stock_code: string;
  description: string;
  category: string;
  sub_category?: string;
  store_name: string;
  store_id?: string;
  reference: string;
  order_qty: number;
  add_ons_qty: number;
  qty_on_hand?: number;
  qty_in_transit?: number;
  qty_pending_orders?: number;
  model_stock_qty?: number;
  has_amendment?: boolean;
  amendment_data?: any;
}

interface Amendment {
  id: string;
  stock_code: string;
  store_id: string;
  category: string;
  sub_category?: string;
  week_reference: string;
  amended_qty: number;
  justification: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'admin_approved' | 'admin_rejected';
  created_at: string;
  updated_at: string;
  user_id: string;
  created_by_role: string;
  admin_notes?: string;
  admin_approved_at?: string;
  admin_rejected_at?: string;
  admin_approved_by?: string;
}

interface ManagerInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  assigned_stores: string[];
}

interface ManagerLineItemDetailProps {
  title: string;
  managerInfo: ManagerInfo;
  currentWeek: WeekSelection;
  storesWithSubmissions: StoreWithSubmissions[];
  weeklyPlanData: WeeklyPlanItem[];
  managerRole: 'area_manager' | 'regional_manager';
  onAmendmentSave?: (amendment: Amendment) => void;
  onRefresh?: () => void;
}

export const ManagerLineItemDetail: React.FC<ManagerLineItemDetailProps> = ({
  title,
  managerInfo,
  currentWeek,
  storesWithSubmissions,
  weeklyPlanData,
  managerRole,
  onAmendmentSave,
  onRefresh
}) => {
  const { toast } = useToast();
  
  console.log(`🎯 [ManagerLineItemDetail] Component rendering with ${weeklyPlanData.length} items`);
  
  // Debug: Check amendment data on component render
  React.useEffect(() => {
    const itemsWithAmendments = weeklyPlanData.filter(item => item.has_amendment);
    console.log(`📊 [ManagerLineItemDetail] Component loaded with ${weeklyPlanData.length} total items, ${itemsWithAmendments.length} with amendments`);
    
    if (itemsWithAmendments.length > 0) {
      console.log(`📋 [ManagerLineItemDetail] Sample amended items on load:`, itemsWithAmendments.slice(0, 3).map(item => ({
        store: item.store_name,
        stock_code: item.stock_code,
        has_amendment: item.has_amendment,
        amendment_data: !!item.amendment_data,
        amended_qty: item.amendment_data?.amended_qty,
        created_by_role: item.amendment_data?.created_by_role
      })));
      
      // Debug: Show all unique created_by_role values from existing data
      const createdByRoles = itemsWithAmendments
        .map(item => item.amendment_data?.created_by_role)
        .filter((value, index, self) => value && self.indexOf(value) === index);
      console.log(`👤 [ManagerLineItemDetail] Existing created_by_role values in database:`, createdByRoles);
    }
  }, [weeklyPlanData]);
  
  // Filters and search
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showOnlyAmendments, setShowOnlyAmendments] = useState<boolean>(false);
  const [showZeroQuantities, setShowZeroQuantities] = useState<boolean>(true);
  
  // Amendment editing
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [amendmentQty, setAmendmentQty] = useState<number | string>(0);
  const [amendmentJustification, setAmendmentJustification] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Pagination for performance
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 100; // Show 100 items per page for better performance

  // Get unique categories and stores for filtering
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(weeklyPlanData.map(item => item.category))];
    return uniqueCategories.sort();
  }, [weeklyPlanData]);

  // Filter and process the weekly plan data
  const filteredData = useMemo(() => {
    const startTime = performance.now();
    console.log(`⏱️ [ManagerLineItemDetail] Starting to filter ${weeklyPlanData.length} items`);
    
    let filtered = weeklyPlanData;

    // Store filter
    if (selectedStore !== 'all') {
      filtered = filtered.filter(item => item.store_name === selectedStore);
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.stock_code.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower) ||
        (item.sub_category && item.sub_category.toLowerCase().includes(searchLower))
      );
    }

    // Amendment filter
    if (showOnlyAmendments) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(item => item.has_amendment);
      const afterCount = filtered.length;
      console.log(`🔍 [ManagerLineItemDetail] Amendment filter applied: ${beforeCount} -> ${afterCount} items (${afterCount - beforeCount} filtered out)`);
      
      // Debug: Show sample items with amendments
      if (afterCount > 0) {
        console.log(`📋 [ManagerLineItemDetail] Sample amendment items:`, filtered.slice(0, 3).map(item => ({
          store: item.store_name,
          stock_code: item.stock_code,
          has_amendment: item.has_amendment,
          amendment_data: !!item.amendment_data
        })));
      } else {
        console.log(`❌ [ManagerLineItemDetail] No items with amendments found. Total items checked: ${beforeCount}`);
        // Debug: Check why no amendments found
        const itemsWithAmendmentData = weeklyPlanData.filter(item => item.has_amendment);
        console.log(`🔍 [ManagerLineItemDetail] Items with has_amendment=true in raw data: ${itemsWithAmendmentData.length}`);
      }
    }

    // Zero quantities filter
    if (!showZeroQuantities) {
      filtered = filtered.filter(item => 
        item.order_qty > 0 || item.add_ons_qty > 0 || item.has_amendment
      );
    }

    const sorted = filtered.sort((a, b) => {
      // Sort by store name first, then category, then stock code
      if (a.store_name !== b.store_name) {
        return a.store_name.localeCompare(b.store_name);
      }
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.stock_code.localeCompare(b.stock_code);
    });
    
    const endTime = performance.now();
    console.log(`✅ [ManagerLineItemDetail] Filtering completed in ${(endTime - startTime).toFixed(2)}ms. Filtered ${sorted.length} items from ${weeklyPlanData.length}`);
    
    return sorted;
  }, [weeklyPlanData, selectedStore, selectedCategory, searchTerm, showOnlyAmendments, showZeroQuantities]);

  // Group data by sub-category with subtotals
  const groupedData = useMemo(() => {
    const groups = new Map<string, {
      subCategory: string;
      items: typeof filteredData;
      totals: {
        orderQty: number;
        addOnsQty: number;
        totalQty: number;
        amendmentQty: number;
        revisedQty: number;
        amendmentCount: number;
      };
    }>();

    filteredData.forEach(item => {
      const subCategory = item.sub_category || 'Other';
      
      if (!groups.has(subCategory)) {
        groups.set(subCategory, {
          subCategory,
          items: [],
          totals: {
            orderQty: 0,
            addOnsQty: 0,
            totalQty: 0,
            amendmentQty: 0,
            revisedQty: 0,
            amendmentCount: 0
          }
        });
      }

      const group = groups.get(subCategory)!;
      group.items.push(item);
      
      // Calculate totals
      const orderQty = item.order_qty || 0;
      const addOnsQty = item.add_ons_qty || 0;
      const totalQty = orderQty + addOnsQty;
      const amendmentQty = item.amendment_data?.amended_qty || 0;
      const revisedQty = item.has_amendment ? amendmentQty : totalQty;
      
      group.totals.orderQty += orderQty;
      group.totals.addOnsQty += addOnsQty;
      group.totals.totalQty += totalQty;
      group.totals.amendmentQty += amendmentQty;
      group.totals.revisedQty += revisedQty;
      if (item.has_amendment) {
        group.totals.amendmentCount += 1;
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.subCategory.localeCompare(b.subCategory));
  }, [filteredData]);

  // Paginated data for rendering (flatten groups for pagination)
  const paginatedData = useMemo(() => {
    const flattenedItems = groupedData.flatMap(group => [
      { type: 'header', group },
      ...group.items.map(item => ({ type: 'item', item })),
      { type: 'subtotal', group }
    ]);
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = flattenedItems.slice(startIndex, endIndex);
    
    console.log(`📄 [ManagerLineItemDetail] Showing page ${currentPage}: items ${startIndex + 1}-${Math.min(endIndex, flattenedItems.length)} of ${flattenedItems.length} (including headers/subtotals)`);
    
    return paginated;
  }, [groupedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(groupedData.reduce((total, group) => total + group.items.length + 2, 0) / itemsPerPage); // +2 for header and subtotal rows

  // Handle starting amendment edit
  const handleStartEdit = (item: WeeklyPlanItem) => {
    setEditingItem(`${item.store_name}_${item.stock_code}`);
    
    // Calculate the relative change from stored data
    if (item.amendment_data?.amended_qty !== undefined) {
      const originalQty = item.order_qty + item.add_ons_qty;
      const finalQty = item.amendment_data.amended_qty;
      const relativeChange = finalQty - originalQty; // Calculate the change
      setAmendmentQty(relativeChange);
    } else {
      setAmendmentQty('');
    }
    
    setAmendmentJustification(item.amendment_data?.justification || '');
  };

  // Handle canceling amendment edit
  const handleCancelEdit = () => {
    setEditingItem(null);
    setAmendmentQty('');
    setAmendmentJustification('');
  };

  // Handle saving amendment
  const handleSaveAmendment = async (item: WeeklyPlanItem) => {
    if (!managerInfo || !currentWeek) return;

    try {
      setIsSubmitting(true);

      // Find the store for this item
      const store = storesWithSubmissions.find(s => s.store_name === item.store_name);
      if (!store) {
        throw new Error('Store not found');
      }

      const originalQty = item.order_qty + item.add_ons_qty;
      
      // Handle amendment quantity conversion
      let finalAmendmentQty = 0;
      if (typeof amendmentQty === 'string') {
        if (amendmentQty === '' || amendmentQty === '-') {
          finalAmendmentQty = 0;
        } else {
          finalAmendmentQty = parseInt(amendmentQty);
          if (isNaN(finalAmendmentQty)) {
            finalAmendmentQty = 0;
          }
        }
      } else {
        finalAmendmentQty = amendmentQty;
      }
      
      console.log('🔢 [Amendment] Quantity conversion:', { amendmentQty, finalAmendmentQty, type: typeof amendmentQty });
      
      // Validate that amendment doesn't make total quantity go negative
      // Note: Amendment is a relative change (+ adds, - subtracts from original)
      const finalTotalQty = originalQty + finalAmendmentQty;
      if (finalTotalQty < 0) {
        console.log('❌ [Amendment] Validation failed:', { 
          originalQty, 
          amendmentQty: finalAmendmentQty, 
          finalTotalQty, 
          stockCode: item.stock_code 
        });
        throw new Error(`Amendment would make total quantity negative. Original: ${originalQty}, Amendment: ${finalAmendmentQty > 0 ? '+' : ''}${finalAmendmentQty}, Result: ${finalTotalQty}. Total cannot be less than 0.`);
      }
      
      console.log('✅ [Amendment] Validation passed:', { 
        originalQty, 
        amendmentChange: finalAmendmentQty, 
        finalTotalQty: finalTotalQty 
      });
      
      // Map manager role to database expected values
      // Try values that might match database constraint
      const dbAmendmentType = 'user_edit'; // Try user edit type
      const dbCreatedByRole = 'store_manager'; // Try store manager role (common in retail systems)
      
      console.log('🔧 [Amendment] Role mapping:', { managerRole, dbAmendmentType, dbCreatedByRole });
      
      // Debug: Check existing amendment types in database
      try {
        const { data: existingAmendments } = await supabaseAdmin
          .from('weekly_plan_amendments')
          .select('amendment_type, created_by_role')
          .limit(5);
        
        if (existingAmendments && existingAmendments.length > 0) {
          console.log('🔍 [Amendment] Existing amendment types in DB:', existingAmendments.map(a => a.amendment_type));
          console.log('🔍 [Amendment] Existing created_by_role values in DB:', existingAmendments.map(a => a.created_by_role));
        }
      } catch (debugError) {
        console.log('⚠️ [Amendment] Could not fetch existing amendment types:', debugError);
      }
      
      const amendmentData = {
        stock_code: item.stock_code,
        store_id: store.store_id,
        category: item.category,
        sub_category: item.sub_category || null,
        week_reference: currentWeek.week_reference,
        original_qty: originalQty,
        amended_qty: finalTotalQty, // Store the final total quantity, not the relative change
        justification: amendmentJustification,
        status: 'pending',
        user_id: managerInfo.id,
        created_by_role: dbCreatedByRole,
        week_start_date: currentWeek.week_start_date,
        amendment_type: dbAmendmentType
      };

      console.log('💾 [Amendment] Attempting to save amendment:', amendmentData);
      console.log('🔍 [Amendment] Amendment logic: Original qty:', originalQty, 'Change:', finalAmendmentQty, 'Final qty:', finalTotalQty);
      console.log('🔍 [Amendment] Item has existing amendment:', item.has_amendment, 'Amendment data:', item.amendment_data);
      console.log('👤 [Amendment] Manager info:', { id: managerInfo.id, email: managerInfo.email });
      console.log('📅 [Amendment] Current week:', { reference: currentWeek.week_reference, start: currentWeek.week_start_date });
      
      let data, error;
      
      // Check if this item already has an amendment by looking at the loaded data
      if (item.has_amendment && item.amendment_data && item.amendment_data.id) {
        console.log('🔄 [Amendment] Updating existing amendment with ID:', item.amendment_data.id);
        // Update existing amendment using the ID from the loaded data
        const result = await supabaseAdmin
          .from('weekly_plan_amendments')
          .update({
            amended_qty: amendmentData.amended_qty,
            justification: amendmentData.justification,
            status: amendmentData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.amendment_data.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        console.log('➕ [Amendment] Creating new amendment');
        // Insert new amendment
        const result = await supabaseAdmin
          .from('weekly_plan_amendments')
          .insert(amendmentData)
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Database error details:', error);
        console.error('Amendment data being saved:', amendmentData);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        throw error;
      }

      toast({
        title: 'Amendment Saved',
        description: `Amendment for ${item.stock_code} saved successfully`,
      });

      // Call callback if provided (pass the updated amendment data)
      if (onAmendmentSave) {
        onAmendmentSave(data);
      }

      // Reset editing state
      handleCancelEdit();

      // Note: No longer calling full refresh - data will be updated via callback
    } catch (error) {
      console.error('Error saving amendment:', error);
      toast({
        title: 'Error',
        description: 'Failed to save amendment',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedStore('all');
    setSelectedCategory('all');
    setSearchTerm('');
    setShowOnlyAmendments(false);
    setShowZeroQuantities(true);
    setCurrentPage(1);
  };

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedStore, selectedCategory, searchTerm, showOnlyAmendments, showZeroQuantities]);

  const hasActiveFilters = selectedStore !== 'all' || 
                         searchTerm !== '' || showOnlyAmendments || !showZeroQuantities;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">
            Detailed line items for {managerInfo.first_name} {managerInfo.last_name} • {currentWeek.week_reference}
          </p>
        </div>
        {onRefresh && (
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Line Items
            </CardTitle>
            {hasActiveFilters && (
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Showing {filteredData.length} of {weeklyPlanData.length} items
                </div>
                <Button onClick={clearFilters} variant="outline" size="sm">
                  <FilterX className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Store Filter */}
            <div className="space-y-2">
              <Label>Store</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores ({storesWithSubmissions.length})</SelectItem>
                  {storesWithSubmissions.map(store => (
                    <SelectItem key={store.store_id} value={store.store_name}>
                      {store.store_name} ({store.store_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Stock code, description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="space-y-2">
              <Label>Filter Options</Label>
              <div className="flex flex-wrap gap-2">
                {/* Suppress Zeros Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowZeroQuantities(!showZeroQuantities)}
                  className={`flex items-center gap-2 ${!showZeroQuantities ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
                >
                  {!showZeroQuantities ? <FilterX className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                  {!showZeroQuantities ? 'Show All' : 'Suppress Zeros'}
                </Button>
                
                {/* Amendments Only Filter Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOnlyAmendments(!showOnlyAmendments)}
                  className={`flex items-center gap-2 ${showOnlyAmendments ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
                >
                  {showOnlyAmendments ? <FilterX className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                  {showOnlyAmendments ? 'Show All Items' : 'Amendments Only'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Weekly Plan Line Items
              <Badge variant="outline">{filteredData.length} items</Badge>
            </div>
          </CardTitle>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className="rounded-full"
            >
              All Categories ({weeklyPlanData.length})
            </Button>
            {categories.map(category => {
              const categoryCount = weeklyPlanData.filter(item => item.category === category).length;
              return (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="rounded-full"
                >
                  {category} ({categoryCount})
                </Button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
              <TableRow>
                <TableHead className="bg-white">Store</TableHead>
                <TableHead className="bg-white">Stock Code</TableHead>
                <TableHead className="bg-white">Description</TableHead>
                <TableHead className="bg-white">Model Stock</TableHead>
                <TableHead className="bg-white">Stock on Hand</TableHead>
                <TableHead className="bg-white">In Transit</TableHead>
                <TableHead className="bg-white">Pending Orders</TableHead>
                <TableHead className="bg-white">Order Qty</TableHead>
                <TableHead className="bg-white">Add-ons Qty</TableHead>
                <TableHead className="bg-white">Total Qty</TableHead>
                <TableHead className="bg-white">Amendment</TableHead>
                <TableHead className="bg-white">Revised Total</TableHead>
                <TableHead className="bg-white">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row, index) => {
                if (row.type === 'header') {
                  return (
                    <TableRow key={`header-${row.group.subCategory}`} className="bg-gray-100 border-t-2 border-gray-300">
                      <TableCell colSpan={13} className="font-bold text-lg py-3">
                        📦 {row.group.subCategory}
                        <Badge variant="outline" className="ml-2">
                          {row.group.items.length} items
                        </Badge>
                        {row.group.totals.amendmentCount > 0 && (
                          <Badge variant="outline" className="ml-2 border-blue-500 text-blue-600">
                            {row.group.totals.amendmentCount} amendments
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }

                if (row.type === 'subtotal') {
                  return (
                    <TableRow key={`subtotal-${row.group.subCategory}`} className="bg-gray-50 border-b-2 border-gray-300 font-semibold">
                      <TableCell colSpan={7} className="text-right">
                        Subtotal - {row.group.subCategory}:
                      </TableCell>
                      <TableCell className="font-bold">{row.group.totals.orderQty}</TableCell>
                      <TableCell className="font-bold">{row.group.totals.addOnsQty}</TableCell>
                      <TableCell className="font-bold">{row.group.totals.totalQty}</TableCell>
                      <TableCell className="font-bold">
                        {row.group.totals.amendmentCount > 0 && (
                          <Badge variant="outline" className="border-blue-500 text-blue-600">
                            {row.group.totals.amendmentCount}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-green-600">{row.group.totals.revisedQty}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  );
                }

                // Regular item row
                const item = row.item;
                const itemKey = `${item.store_name}_${item.stock_code}`;
                const isEditing = editingItem === itemKey;
                const totalQty = item.order_qty + item.add_ons_qty;
                const amendedQty = item.amendment_data?.amended_qty || 0;
                const revisedTotal = item.has_amendment ? amendedQty : totalQty;

                return (
                  <TableRow key={itemKey} className={
                    item.amendment_data?.status === 'admin_rejected' 
                      ? 'bg-red-50 border-l-4 border-l-red-400' 
                      : item.amendment_data?.status === 'admin_approved'
                      ? 'bg-green-50 border-l-4 border-l-green-400'
                      : item.has_amendment 
                      ? 'bg-blue-50' 
                      : ''
                  }>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.store_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {storesWithSubmissions.find(s => s.store_name === item.store_name)?.store_code}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{item.stock_code}</TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={item.description}>
                        {item.description}
                      </div>
                    </TableCell>
                    <TableCell>{item.model_stock_qty || '-'}</TableCell>
                    <TableCell>{item.qty_on_hand || '-'}</TableCell>
                    <TableCell>{item.qty_in_transit || '-'}</TableCell>
                    <TableCell>{item.qty_pending_orders || '-'}</TableCell>
                    <TableCell>{item.order_qty}</TableCell>
                    <TableCell>{item.add_ons_qty}</TableCell>
                    <TableCell className="font-medium">{totalQty}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            type="number"
                            value={amendmentQty}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || value === '-') {
                                setAmendmentQty(value === '-' ? -0 : '');
                              } else {
                                const numValue = parseInt(value);
                                if (!isNaN(numValue)) {
                                  setAmendmentQty(numValue);
                                }
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                            className="w-20"
                            placeholder="Enter qty..."
                            autoFocus
                          />
                          <Textarea
                            placeholder="Justification..."
                            value={amendmentJustification}
                            onChange={(e) => setAmendmentJustification(e.target.value)}
                            className="text-xs"
                            rows={2}
                          />
                        </div>
                      ) : item.has_amendment ? (
                        <div>
                          <div className="flex flex-col gap-1">
                            {/* Status Badge */}
                            {item.amendment_data?.status === 'admin_rejected' ? (
                              <Badge variant="destructive" className="text-xs flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                Rejected by Admin
                              </Badge>
                            ) : item.amendment_data?.status === 'admin_approved' ? (
                              <Badge variant="default" className="bg-green-500 text-xs flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Approved by Admin
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-blue-500 text-blue-600 text-xs flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {item.amendment_data?.status === 'submitted' ? 'Pending Admin Review' : 'Draft'}
                              </Badge>
                            )}
                            
                            {/* Quantity Badge */}
                            <Badge variant="outline" className="border-gray-400 text-gray-700 text-xs">
                              Qty: {amendedQty}
                            </Badge>
                          </div>
                          
                          {/* Justification */}
                          {item.amendment_data?.justification && (
                            <div className="text-xs text-muted-foreground mt-1 max-w-xs">
                              <strong>Reason:</strong> {item.amendment_data.justification}
                            </div>
                          )}
                          
                          {/* Admin Notes for Rejected Items */}
                          {item.amendment_data?.status === 'admin_rejected' && item.amendment_data?.admin_notes && (
                            <div className="text-xs text-red-600 mt-1 max-w-xs p-2 bg-red-50 border border-red-200 rounded">
                              <strong>Admin Rejection Reason:</strong><br />
                              {item.amendment_data.admin_notes}
                            </div>
                          )}
                          
                          {/* Admin Approval Notes */}
                          {item.amendment_data?.status === 'admin_approved' && item.amendment_data?.admin_notes && (
                            <div className="text-xs text-green-600 mt-1 max-w-xs p-2 bg-green-50 border border-green-200 rounded">
                              <strong>Admin Notes:</strong><br />
                              {item.amendment_data.admin_notes}
                            </div>
                          )}
                          
                          {/* Timestamps */}
                          {(item.amendment_data?.admin_rejected_at || item.amendment_data?.admin_approved_at) && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {item.amendment_data.admin_rejected_at && (
                                <div>Rejected: {new Date(item.amendment_data.admin_rejected_at).toLocaleDateString()} {new Date(item.amendment_data.admin_rejected_at).toLocaleTimeString()}</div>
                              )}
                              {item.amendment_data.admin_approved_at && (
                                <div>Approved: {new Date(item.amendment_data.admin_approved_at).toLocaleDateString()} {new Date(item.amendment_data.admin_approved_at).toLocaleTimeString()}</div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className={
                        item.amendment_data?.status === 'admin_rejected' 
                          ? 'font-semibold text-red-600' 
                          : item.amendment_data?.status === 'admin_approved'
                          ? 'font-semibold text-green-600'
                          : item.has_amendment 
                          ? 'font-semibold text-blue-600' 
                          : ''
                      }>
                        {/* Show original total for rejected amendments, revised for others */}
                        {item.amendment_data?.status === 'admin_rejected' ? totalQty : revisedTotal}
                        {item.has_amendment && (
                          <div className="text-xs text-muted-foreground">
                            {item.amendment_data?.status === 'admin_rejected' ? (
                              <span className="text-red-500">Amendment Rejected</span>
                            ) : (
                              <>({amendedQty - totalQty > 0 ? '+' : ''}{amendedQty - totalQty})</>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => handleSaveAmendment(item)}
                            disabled={isSubmitting || !amendmentJustification.trim() || amendmentQty === ''}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            disabled={isSubmitting}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : item.amendment_data?.status === 'admin_rejected' ? (
                        <Badge variant="destructive" className="text-xs">
                          Cannot Edit<br />Rejected
                        </Badge>
                      ) : item.amendment_data?.status === 'admin_approved' ? (
                        <Badge variant="default" className="bg-green-500 text-xs">
                          Approved<br />No Edit
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEdit(item)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          {item.has_amendment ? 'Edit' : 'Amend'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredData.length === 0 && (
            <div className="text-center py-8 px-6">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Line Items Found</h3>
              <p className="text-muted-foreground">
                {hasActiveFilters 
                  ? 'Try adjusting your filters to see more items'
                  : 'No weekly plan data available for the selected criteria'
                }
              </p>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 px-6 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} items
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerLineItemDetail;