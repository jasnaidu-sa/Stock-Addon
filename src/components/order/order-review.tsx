import React from "react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Check, X } from "lucide-react"
import type { Order } from "@/types/order"

interface OrderHistory {
  id: string
  order_id: string
  created_at: string
  order_items: any[]
  action_type: string
  user_id: string
  details: string
  original_qty: number
  updated_qty: number
  original_value: number
  updated_value: number
  admin_notes?: string
  changes_summary?: string
}

interface OrderReviewProps {
  order: Order
  onClose: () => void
  onOrderUpdated?: () => void
}

export function OrderReview({ order, onClose, onOrderUpdated }: OrderReviewProps) {
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [orderHistory, setOrderHistory] = useState<OrderHistory | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadOrderHistory()
  }, [order.id])

  const loadOrderHistory = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('order_history')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error

      setOrderHistory(data)
    } catch (err: any) {
      setError('Failed to load order history: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `R ${amount.toLocaleString()}`
  }

  const handleAccept = async () => {
    try {
      setProcessing(true)
      setError(null)

      // Update order status to completed
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', order.id)

      if (updateError) throw updateError

      // Update order history to record acceptance
      const { error: historyError } = await supabase
        .from('order_history')
        .update({ 
          action_type: 'changes_accepted',
          details: 'Customer accepted order changes'
        })
        .eq('order_id', order.id)

      if (historyError) throw historyError

      onOrderUpdated?.()
      onClose()
    } catch (err: any) {
      setError('Failed to accept changes: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    try {
      setProcessing(true)
      setError(null)

      if (!orderHistory) throw new Error('No order history found')

      // Restore original order details
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'pending',
          quantity: orderHistory.original_qty,
          total: orderHistory.original_value
        })
        .eq('id', order.id)

      if (updateError) throw updateError

      // Restore original order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .upsert(orderHistory.order_items)

      if (itemsError) throw itemsError

      // Update order history to record rejection
      const { error: historyError } = await supabase
        .from('order_history')
        .update({ 
          action_type: 'changes_rejected',
          details: 'Customer rejected order changes'
        })
        .eq('order_id', order.id)

      if (historyError) throw historyError

      onOrderUpdated?.()
      onClose()
    } catch (err: any) {
      setError('Failed to reject changes: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-center">Loading order history...</div>
  }

  if (!orderHistory) {
    return <div className="p-6 text-center">No order history found</div>
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Review Order Changes</h2>
        <p className="text-sm text-muted-foreground">
          Please review the changes made to your order
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {orderHistory.admin_notes && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Admin Notes</h3>
          <p className="text-sm text-muted-foreground rounded-md border p-3">
            {orderHistory.admin_notes}
          </p>
        </div>
      )}

      {orderHistory.changes_summary && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Changes Made</h3>
          <p className="text-sm text-muted-foreground rounded-md border p-3">
            {orderHistory.changes_summary}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <Separator />
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Original Order</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderHistory.order_items.map((item: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} />
                  <TableCell className="text-right font-medium">Total:</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(orderHistory.original_value)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">Updated Order</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items?.map((item: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} />
                  <TableCell className="text-right font-medium">Total:</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={processing}
          >
            <X className="mr-2 h-4 w-4" />
            Reject Changes
          </Button>
          <Button
            onClick={handleAccept}
            disabled={processing}
          >
            <Check className="mr-2 h-4 w-4" />
            Accept Changes
          </Button>
        </div>
      </div>
    </div>
  )
} 