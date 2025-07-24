import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Package, AlertTriangle, CheckCircle, XCircle, Edit3 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StoreContextSheetProps {
  storeId: string;
  storeName: string;
  region?: string;
  allStoreItems: any[];
  storeAmendments: any[];
  onAmendmentAction?: (amendmentId: string, action: 'approve' | 'reject' | 'modify') => void;
  isOpen: boolean;
  onClose: () => void;
}

export function StoreContextSheet({
  storeId,
  storeName,
  region,
  allStoreItems,
  storeAmendments,
  onAmendmentAction,
  isOpen,
  onClose
}: StoreContextSheetProps) {
  const [contextStats, setContextStats] = useState({
    totalItems: 0,
    totalValue: 0,
    totalAmendments: 0,
    pendingAmendments: 0
  });

  useEffect(() => {
    // Calculate store context statistics
    // The data structure uses order_qty + add_ons_qty for total quantity
    const itemsWithQty = allStoreItems.filter(item => {
      const totalQty = (item.order_qty || 0) + (item.add_ons_qty || 0);
      return totalQty > 0;
    });
    const totalValue = itemsWithQty.reduce((sum, item) => {
      const totalQty = (item.order_qty || 0) + (item.add_ons_qty || 0);
      return sum + totalQty;
    }, 0);
    
    const stats = {
      totalItems: itemsWithQty.length,
      totalValue: totalValue,
      totalAmendments: storeAmendments.length,
      pendingAmendments: storeAmendments.filter(a => 
        ['pending', 'submitted', 'area_manager_approved', 'regional_direct', 'area_direct'].includes(a.status)
      ).length
    };
    
    setContextStats(stats);
  }, [allStoreItems, storeAmendments]);

  const formatQuantity = (qty: number) => {
    return qty > 0 ? qty.toString() : '-';
  };

  const getAmendmentStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'submitted': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'area_manager_approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAmendmentImpact = (amendment: any) => {
    const originalQty = amendment.original_qty || 0;
    const amendedQty = amendment.amended_qty || 0;
    const difference = amendedQty - originalQty;
    
    if (difference > 0) {
      return { text: `+${difference}`, color: 'text-green-600', icon: '↗' };
    } else if (difference < 0) {
      return { text: `${difference}`, color: 'text-red-600', icon: '↘' };
    }
    return { text: '±0', color: 'text-gray-600', icon: '→' };
  };

  // Filter items with quantities > 0 for current orders section
  // The data structure uses order_qty + add_ons_qty for total quantity
  const currentOrders = allStoreItems.filter(item => {
    const totalQty = (item.order_qty || 0) + (item.add_ons_qty || 0);
    return totalQty > 0;
  });

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        className="w-[75vw] sm:!w-[1120px] !max-w-[80vw] sm:!max-w-[1120px] inset-y-0 right-0 h-full border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500" 
        side="right"
      >
        <SheetHeader className="space-y-3">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {storeName}
              {region && <Badge variant="outline">{region}</Badge>}
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-600">{contextStats.totalItems}</span>
                <span className="text-gray-600">Items Ordered</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-purple-600">{contextStats.pendingAmendments}</span>
                <span className="text-gray-600">Pending Amendments</span>
              </div>
            </div>
          </SheetTitle>
          <SheetDescription>
            Complete store context for informed amendment decisions
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Current Orders Section - Increased Width */}
          <div className="flex-1">
            <div className="mb-3">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Package className="h-4 w-4" />
                Current Orders (Qty &gt; 0)
                <Badge variant="outline" className="text-xs">{currentOrders.length} items</Badge>
              </h3>
            </div>
            <div className="border rounded-lg">
              <ScrollArea className="h-[400px]">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="py-2 text-xs w-[160px]">Product Code</TableHead>
                      <TableHead className="py-2 text-xs w-[200px]">Description</TableHead>
                      <TableHead className="py-2 text-xs w-[120px]">Category</TableHead>
                      <TableHead className="py-2 text-xs w-[90px] text-center">On Hand</TableHead>
                      <TableHead className="py-2 text-xs w-[90px] text-center">In Transit</TableHead>
                      <TableHead className="py-2 text-xs w-[90px] text-center">Pending</TableHead>
                      <TableHead className="py-2 text-xs w-[90px] text-center">Model Stock</TableHead>
                      <TableHead className="py-2 text-xs w-[90px] text-center">Order Qty</TableHead>
                      <TableHead className="py-2 text-xs w-[90px] text-center">Add-Ons</TableHead>
                      <TableHead className="py-2 text-xs w-[90px] text-center">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentOrders.map((item, index) => {
                      const orderQty = item.order_qty || 0;
                      const addOnsQty = item.add_ons_qty || 0;
                      const totalQty = orderQty + addOnsQty;
                      return (
                        <TableRow key={index} className="text-xs">
                          <TableCell className="font-mono py-1.5 text-xs font-medium">{item.stock_code}</TableCell>
                          <TableCell className="py-1.5 text-xs text-gray-600">{item.description || '-'}</TableCell>
                          <TableCell className="py-1.5 text-xs">{item.category}</TableCell>
                          <TableCell className="text-center py-1.5 text-xs">{item.qty_on_hand || 0}</TableCell>
                          <TableCell className="text-center py-1.5 text-xs">{item.qty_in_transit || 0}</TableCell>
                          <TableCell className="text-center py-1.5 text-xs">{item.qty_pending_orders || 0}</TableCell>
                          <TableCell className="text-center py-1.5 text-xs">{item.model_stock_qty || 0}</TableCell>
                          <TableCell className="text-center py-1.5 text-xs font-medium">{orderQty > 0 ? orderQty : '-'}</TableCell>
                          <TableCell className="text-center py-1.5 text-xs font-medium">{addOnsQty > 0 ? addOnsQty : '-'}</TableCell>
                          <TableCell className="text-center py-1.5 text-xs font-bold">{totalQty}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {currentOrders.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No items with quantities above zero
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Amendments Section - Reduced Width */}
          <div className="w-full max-w-3xl">
            <div className="mb-3">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Amendments & Changes
                <Badge variant="outline" className="text-xs">{storeAmendments.length} total</Badge>
              </h3>
            </div>
            <div className="border rounded-lg">
              <ScrollArea className="h-[250px]">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="py-2 text-xs w-[140px]">Product Code</TableHead>
                      <TableHead className="py-2 text-xs w-[100px]">Status</TableHead>
                      <TableHead className="py-2 text-xs w-[80px] text-center">Original</TableHead>
                      <TableHead className="py-2 text-xs w-[80px] text-center">Amended</TableHead>
                      <TableHead className="py-2 text-xs w-[80px] text-center">Change</TableHead>
                      <TableHead className="py-2 text-xs w-[250px]">Justification</TableHead>
                      <TableHead className="py-2 text-xs w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storeAmendments.map((amendment) => {
                      const impact = getAmendmentImpact(amendment);
                      const canTakeAction = ['pending', 'submitted', 'area_manager_approved', 'regional_direct', 'area_direct'].includes(amendment.status);
                      
                      return (
                        <TableRow key={amendment.id} className="text-xs">
                          <TableCell className="font-mono py-2 text-xs font-medium">
                            {amendment.stock_code}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge className={`${getAmendmentStatusColor(amendment.status)} text-xs`}>
                              {amendment.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-2 text-xs font-medium">{amendment.original_qty || 0}</TableCell>
                          <TableCell className="text-center py-2 text-xs font-medium">{amendment.amended_qty || 0}</TableCell>
                          <TableCell className={`text-center py-2 text-xs font-medium ${impact.color}`}>
                            <div className="flex items-center justify-center gap-1">
                              <span>{impact.icon}</span>
                              <span>{impact.text}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-xs text-gray-600">
                            {amendment.justification ? (
                              <div className="max-w-[230px] truncate" title={amendment.justification}>
                                "{amendment.justification}"
                              </div>
                            ) : (
                              <span className="text-gray-400">No justification provided</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2">
                            {canTakeAction && onAmendmentAction ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 border-green-300 hover:bg-green-50 px-1.5 h-6 text-xs"
                                  onClick={() => onAmendmentAction(amendment.id, 'approve')}
                                >
                                  <CheckCircle className="h-2.5 w-2.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-300 hover:bg-red-50 px-1.5 h-6 text-xs"
                                  onClick={() => onAmendmentAction(amendment.id, 'reject')}
                                >
                                  <XCircle className="h-2.5 w-2.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-blue-600 border-blue-300 hover:bg-blue-50 px-1.5 h-6 text-xs"
                                  onClick={() => onAmendmentAction(amendment.id, 'modify')}
                                >
                                  <Edit3 className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Final</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {storeAmendments.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No amendments found for this store
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}