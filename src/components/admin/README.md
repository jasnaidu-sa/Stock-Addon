# Admin Components

This directory contains components used in the admin dashboard.

## Order Status Management

### Order Status Workflow

Orders can have the following statuses:
- `pending`: New orders waiting to be processed
- `approved`: Orders that have been approved
- `completed`: Orders that have been fulfilled
- `cancelled`: Orders that have been cancelled
- `review`: Orders that have been edited by an admin and require customer approval

### Important: Review Status

The `review` status is special and can **only** be set automatically when an order is edited by an admin. Admins cannot manually set an order to "review" status through the status dropdown.

When you edit an order (modify quantities, add/remove items, etc.), you should call the `markOrderForReview` function from `src/lib/order-status.tsx` to:
1. Automatically set the order status to "review"
2. Record the changes in the order history
3. Notify the customer that their order needs review

### Sample Usage

```typescript
import { markOrderForReview } from '@/lib/order-status';

// In your order edit save function:
async function saveOrderChanges(orderId, changes) {
  // Save the actual changes to the order items, etc.
  
  // Then mark the order for review
  const userId = "current-admin-user-id"; // Get from auth context
  const changeDetails = "Changed quantity of item X from 2 to 5"; // Summary of changes
  
  const result = await markOrderForReview(orderId, userId, changeDetails);
  
  if (result.success) {
    // Show success notification
  } else {
    // Handle error
  }
}
```

## Order Status Update Component

The `OrderStatusUpdate` component has been modified to prevent admins from manually setting orders to "review" status. The dropdown will not show "review" as an option unless the order is already in review status. 