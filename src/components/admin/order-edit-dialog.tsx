import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import type { Order, OrderItem } from "@/types/order";
import { formatCurrency } from "@/lib/utils";

// Format date helper function
const formatDate = (dateString: string): string => {
  if (!dateString) return 'Unknown date';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

interface OrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOrder: Order | null;
  orderItems: OrderItem[];
  adminNotes: string;
  onAdminNotesChange: (notes: string) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onDeleteItem: (itemId: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  isSaving: boolean;
  isItemModified: (itemId: string) => boolean;
  isItemAdded: (itemId: string) => boolean;
  isItemDeleted: (itemId: string) => boolean;
  getProductCode: (item: OrderItem) => string;
}

export function OrderEditDialog({
  open,
  onOpenChange,
  currentOrder,
  orderItems,
  adminNotes,
  onAdminNotesChange,
  onQuantityChange,
  onDeleteItem,
  onSave,
  onDiscard,
  isSaving,
  isItemModified,
  isItemAdded,
  isItemDeleted,
  getProductCode
}: OrderEditDialogProps) {
  
  // Helper to get the appropriate class name for order items based on their state
  const getItemClassName = (item: OrderItem) => {
    if (isItemDeleted(item.id || '')) {
      return 'line-through bg-red-50';
    } else if (isItemAdded(item.id || '')) {
      return 'bg-green-50';
    } else if (isItemModified(item.id || '')) {
      return 'bg-amber-50';
    }
    return '';
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Order {currentOrder?.id}</DialogTitle>
          <DialogDescription>
            Manage order items and add administrative notes
          </DialogDescription>
        </DialogHeader>
        
        {currentOrder && (
          <>
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Customer: {currentOrder.customer_name || 'No name provided'}
                </p>
                <p className="text-sm text-gray-500">
                  Order Date: {formatDate(currentOrder.created_at)}
                </p>
              </div>
              
              <div className="border rounded p-2">
                <h3 className="font-medium mb-2">Order Items</h3>
                <div className="max-h-60 overflow-y-auto">
                  {orderItems.map((item) => (
                    <div 
                      key={item.id} 
                      className={`flex items-center justify-between p-2 border-b ${getItemClassName(item)}`}
                    >
                      <div className="flex-grow">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-gray-500">
                          Product Code: {getProductCode(item)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Price: {formatCurrency(item.price)} × {item.quantity} = {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => onQuantityChange(item.id || '', Math.max(1, (item.quantity || 1) - 1))}
                            disabled={isItemDeleted(item.id || '')}
                          >
                            -
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => onQuantityChange(item.id || '', (item.quantity || 1) + 1)}
                            disabled={isItemDeleted(item.id || '')}
                          >
                            +
                          </Button>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="h-8 w-8" 
                          onClick={() => onDeleteItem(item.id || '')}
                          disabled={isItemDeleted(item.id || '')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label htmlFor="admin-notes" className="text-sm font-medium">Admin Notes</label>
                <Textarea 
                  id="admin-notes"
                  placeholder="Add notes for this order"
                  value={adminNotes}
                  onChange={(e) => onAdminNotesChange(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={onDiscard}>
                Discard Changes
              </Button>
              <Button onClick={onSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
