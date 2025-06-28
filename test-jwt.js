// Test script to check the JWT test function
async function testJwtFunction() {
  try {
    console.log('Testing JWT function...');
    
    // Get a Clerk JWT token
    const token = localStorage.getItem('clerk-db-jwt');
    if (!token) {
      console.error('No Clerk JWT token found in localStorage');
      return;
    }
    
    console.log('Using token starting with:', token.substring(0, 10) + '...');
    
    // Call the JWT test function
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jwt-test`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status, response.statusText);
    
    const responseText = await response.text();
    console.log('Raw response:', responseText);
    
    try {
      const data = JSON.parse(responseText);
      console.log('Parsed response:', data);
    } catch (e) {
      console.error('Error parsing response as JSON:', e);
    }
  } catch (error) {
    console.error('Error testing JWT function:', error);
  }
}

// Run the test
testJwtFunction();
