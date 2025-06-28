import React from 'react';
import { OrderItem, OrderStatus } from '@/types/order';
import { formatCurrency } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OrderItemsSubTableProps {
  items: OrderItem[];
  getProductCode: (item: OrderItem) => string;
  orderStatus?: OrderStatus;
}

export const OrderItemsSubTable: React.FC<OrderItemsSubTableProps> = ({ items, getProductCode, orderStatus }) => {
  if (!items || items.length === 0) {
    return <div className="p-4 text-center text-sm text-gray-500">No items in this order.</div>;
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Code</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const showHistory = orderStatus === 'review' && item.history && item.history.length > 0;
            const previousValues = showHistory ? item.history![0] : null;

            return (
              <TableRow key={item.id} className={showHistory ? 'bg-yellow-50 dark:bg-yellow-900/30' : ''}>
                <TableCell>
                  {item.product_name}
                  {showHistory && previousValues?.previous_product_name && previousValues.previous_product_name !== item.product_name && (
                    <div className="text-xs text-gray-500 line-through">Old: {previousValues.previous_product_name}</div>
                  )}
                </TableCell>
                <TableCell>
                  {getProductCode(item)}
                  {showHistory && previousValues?.previous_code && previousValues.previous_code !== getProductCode(item) && (
                    <div className="text-xs text-gray-500 line-through">Old: {previousValues.previous_code}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {item.quantity}
                  {showHistory && previousValues?.original_qty !== undefined && previousValues.original_qty !== item.quantity && (
                    <div className="text-xs text-gray-500 line-through">Old: {previousValues.original_qty}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.price)}
                  {showHistory && previousValues?.previous_price_at_purchase !== undefined && previousValues.previous_price_at_purchase !== item.price_at_purchase && (
                    <div className="text-xs text-gray-500 line-through">Old: {previousValues.previous_price_at_purchase !== null ? formatCurrency(previousValues.previous_price_at_purchase) : 'N/A'}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.total)}
                  {/* Optional: Show previous total if needed, though it's derived */}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
