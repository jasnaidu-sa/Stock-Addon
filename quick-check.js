import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cfjvskafvcljvxnawccs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmanZza2FmdmNsanZ4bmF3Y2NzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDYzNzM4NCwiZXhwIjoyMDU2MjEzMzg0fQ.OmQM_6v1dmcImgab-KiWswvBzuRnbyLLOcr9EHXhb_8'
);

async function checkTables() {
  const tables = [
    'store_manager_assignments',
    'area_manager_store_assignments', 
    'regional_manager_assignments',
    'regional_area_manager_assignments'
  ];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      console.log(`${table}: ${error ? 'MISSING' : 'EXISTS'}`);
      if (error) console.log(`  Error: ${error.message}`);
    } catch (err) {
      console.log(`${table}: ERROR - ${err.message}`);
    }
  }
}

checkTables().catch(console.error);