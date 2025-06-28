import React, { useState, useEffect } from 'react';
import { ArrowUpDown, Eye, ChevronDown, ChevronUp, History } from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Order, OrderItem } from '@/types/order';
import { OrderHistory } from './order-history';
import { OrderStatusBadge } from '@/lib/order-status';
import { OrderStatusUpdate } from './order-status-update';
import { fetchProductCodes, getProductCode } from '@/lib/product-utils';

interface OrderDetailProps {
  order: Order;
  onBack: () => void;
  formatOrderId: (id: string) => string;
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
  onOrderUpdated: () => void;
}

export function OrderDetail({ 
  order, 
  onBack, 
  formatOrderId, 
  formatDate, 
  formatCurrency,
  onOrderUpdated
}: OrderDetailProps) {
  const [expandedItems, setExpandedItems] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('details');
  const [productCodes, setProductCodes] = useState<Record<string, string>>({});

  const toggleItems = () => {
    setExpandedItems(!expandedItems);
  };

  // Load product codes when items are expanded
  useEffect(() => {
    if (expandedItems && order.items && order.items.length > 0) {
      const stockItemIds = order.items
        .map((item: any) => item.stock_item_id)
        .filter(Boolean);
      
      if (stockItemIds.length > 0) {
        const loadProductCodes = async () => {
          try {
            const codes = await fetchProductCodes(stockItemIds);
            setProductCodes(codes);
          } catch (err) {
            console.error('Error loading product codes:', err);
          }
        };
        
        loadProductCodes();
      }
    }
  }, [expandedItems, order.items]);

  return (
    <div>
      <Button 
        variant="ghost" 
        onClick={onBack}
        className="mb-4"
      >
        <ArrowUpDown className="h-4 w-4 mr-2" />
        Back to Orders
      </Button>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Order Details</TabsTrigger>
          <TabsTrigger value="history">Order History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="font-medium">Order ID:</dt>
                    <dd>{formatOrderId(order.id)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium">Date:</dt>
                    <dd>{formatDate(order.created_at)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium">Description:</dt>
                    <dd>{order.description || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="font-medium">Status:</dt>
                    <dd>
                      <OrderStatusBadge status={order.status || 'pending'} />
                    </dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="font-medium">Update Status:</dt>
                    <dd>
                      <OrderStatusUpdate 
                        orderId={order.id} 
                        currentStatus={order.status || 'pending'} 
                        onStatusUpdated={onOrderUpdated} 
                      />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">Total Amount</dt>
                    <dd className="font-bold text-lg">{formatCurrency(order.total || 0)}</dd>
                  </div>
                  
                  {/* Collapsible Line Items */}
                  <div className="mt-4 border-t pt-3">
                    <Button 
                      variant="ghost" 
                      className="w-full flex justify-between items-center p-2 hover:bg-slate-50 rounded-md"
                      onClick={toggleItems}
                    >
                      <span className="font-medium">Line Items ({order.items?.length || 0})</span>
                      {expandedItems ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {expandedItems && order.items && order.items.length > 0 && (
                      <div className="mt-2 bg-slate-50 p-3 rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Code</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-right">Price</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {order.items.map((item: any, index: number) => {
                              // Use our utility function to get the product code
                              const productCode = getProductCode(item, productCodes);
                              
                              // Extract the product description without the code prefix
                              let productDesc = item.product_name || '';
                              const codeRegex = /^([A-Z0-9]+-[A-Z0-9]+(?:\s+XL)?)\s+-\s+/;
                              const codeMatch = productDesc.match(codeRegex);
                              if (codeMatch) {
                                productDesc = productDesc.replace(codeRegex, '');
                              }
                                
                              return (
                              <TableRow key={item.id || index}>
                                  <TableCell className="font-medium">{productCode}</TableCell>
                                  <TableCell>{productDesc}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                              </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    
                    {expandedItems && (!order.items || order.items.length === 0) && (
                      <div className="mt-2 bg-slate-50 p-3 rounded-md text-center text-muted-foreground">
                        No line items found for this order
                      </div>
                    )}
                  </div>
                </dl>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="font-medium">Name:</dt>
                    <dd>{order.customer_name || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium">User ID:</dt>
                    <dd className="truncate max-w-[150px]">{order.user_id || 'N/A'}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Store Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="font-medium">Store:</dt>
                  <dd>{order.store_name || 'N/A'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-medium">Category:</dt>
                  <dd>{order.category || 'Uncategorized'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-medium">Description:</dt>
                  <dd>{order.description || 'N/A'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-medium">Status:</dt>
                  <dd>
                    <Badge
                      variant="outline"
                      className={
                        order.status === 'delivered' || order.status === 'completed' ? 'bg-green-100 text-green-800' :
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'processing' ? 'bg-purple-100 text-purple-800' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }
                    >
                      {order.status || 'unknown'}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-medium">Quantity:</dt>
                  <dd>{order.quantity || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Total Amount</dt>
                  <dd className="font-bold text-lg">{formatCurrency(order.total || 0)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Order History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderHistory 
                orderId={order.id} 
                formatDate={formatDate} 
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 