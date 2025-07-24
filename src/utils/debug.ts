// Debug utility functions to help diagnose issues

/**
 * Log order data details to help debug rendering issues
 * @param orders Array of orders to analyze
 */
export function debugOrderData(orders: any[]) {
  console.log('DEBUG: Total number of orders:', orders.length);
  
  if (orders.length > 0) {
    // Log keys of the first order to see what properties are available
    console.log('DEBUG: Order data structure keys:', Object.keys(orders[0]));
    
    // Specifically check if customer_name exists on each order
    orders.forEach((order, index) => {
      console.log(`DEBUG: Order ${index} - order_number: ${order.order_number}, has customer_name: ${!!order.customer_name}, value: ${order.customer_name}`);
    });
    
    // Check if the "users" property exists and what it contains
    if (orders[0].users) {
      console.log('DEBUG: Sample "users" property:', orders[0].users);
    }
    
    // Log rendering props for table
    console.log('DEBUG: Order data to render:', orders.map(order => ({
      id: order.id,
      order_number: order.order_number,
      created_at: order.created_at,
      store_name: order.store_name,
      customer_name: order.customer_name,
      status: order.status,
      quantity: order.quantity,
      value: order.value
    })));
  }
} 