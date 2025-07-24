import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedOrders() {
  console.log('Seeding sample orders...');

  try {
    // Get all users to assign orders to
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id');
    
    if (userError) {
      console.error('Error fetching users:', userError.message);
      return;
    }

    if (!users || users.length === 0) {
      console.error('No users found to assign orders to.');
      return;
    }

    console.log(`Found ${users.length} users to assign orders to.`);

    // Sample orders data
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    const sampleOrders = [];
    
    // Create 10 sample orders
    for (let i = 0; i < 10; i++) {
      const userIndex = i % users.length;
      const userId = users[userIndex].id;
      const sampleItems = [
        {
          id: `item-${i}-1`,
          name: `Sample Product ${i+1}`,
          price: Math.floor(Math.random() * 100) + 20,
          quantity: Math.floor(Math.random() * 5) + 1
        },
        {
          id: `item-${i}-2`,
          name: `Another Product ${i+1}`,
          price: Math.floor(Math.random() * 200) + 50,
          quantity: Math.floor(Math.random() * 3) + 1
        }
      ];
      
      const total = sampleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      sampleOrders.push({
        user_id: userId,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        items: sampleItems,
        total,
        created_at: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Insert orders
    const { error: insertError } = await supabase
      .from('orders')
      .insert(sampleOrders);
    
    if (insertError) {
      console.error('Error inserting orders:', insertError.message);
      return;
    }

    console.log(`Successfully inserted ${sampleOrders.length} sample orders!`);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

seedOrders(); 