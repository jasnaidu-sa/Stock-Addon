// Simple script to create Sarah Johnson in Clerk via Edge Function
const supabaseUrl = 'https://cfjvskafvcljvxnawccs.supabase.co';

async function createSarahInClerk() {
  try {
    console.log('Creating Sarah Johnson in Clerk via Edge Function...');
    
    // We'll use the admin-create-user Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/admin-create-user`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'manager.somersetwest@company.com',
        username: 'sarah.johnson',
        password: 'TempPass123!',
        firstName: 'Sarah',
        lastName: 'Johnson (Store 2056 - Somerset West)',
        role: 'store_manager',
        group_type: 'store',
        company_name: 'The Bed Shop',
        status: 'active'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error creating Sarah Johnson:', errorText);
      return;
    }

    const result = await response.json();
    console.log('Successfully created Sarah Johnson:', result);
    
  } catch (error) {
    console.error('Error in createSarahInClerk:', error);
  }
}

createSarahInClerk();