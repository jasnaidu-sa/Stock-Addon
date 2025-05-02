import { ColumnDef } from "@tanstack/react-table"
import type { Order } from "@/types/order"
import { OrderStatusBadge } from "@/lib/order-status"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export const columns: ColumnDef<Order>[] = [
  {
    accessorKey: "order_number",
    header: "Order",
  },
  {
    accessorKey: "created_at",
    header: "Date",
    cell: ({ row }) => {
      const date = new Date(row.getValue("created_at"));
      return date.toLocaleDateString();
    },
  },
  {
    accessorKey: "store_name",
    header: "Store",
    cell: ({ row }) => row.getValue("store_name") || "N/A",
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.getValue("description") || "N/A",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return <OrderStatusBadge status={status || 'pending'} />
    },
  },
  {
    accessorKey: "quantity",
    header: "Qty",
    cell: ({ row }) => {
      const quantity = row.getValue("quantity") as number;
      return quantity?.toLocaleString() || "0"
    },
  },
  {
    accessorKey: "total",
    header: "Value",
    cell: ({ row }) => {
      const value = row.getValue("total") as number;
      return value ? `R ${value.toLocaleString()}` : "R 0"
    },
  },
]