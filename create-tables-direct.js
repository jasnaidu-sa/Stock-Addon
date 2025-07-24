import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cfjvskafvcljvxnawccs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmanZza2FmdmNsanZ4bmF3Y2NzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDYzNzM4NCwiZXhwIjoyMDU2MjEzMzg0fQ.OmQM_6v1dmcImgab-KiWswvBzuRnbyLLOcr9EHXhb_8'
);

async function createTables() {
  console.log('🔧 Creating assignment tables...');
  
  // Create each table individually to avoid complex dependencies
  const tables = [
    {
      name: 'store_manager_assignments',
      sql: `
        CREATE TABLE IF NOT EXISTS store_manager_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          store_id UUID NOT NULL,
          store_manager_id UUID NOT NULL,
          assignment_source VARCHAR(50) DEFAULT 'manual',
          status VARCHAR(20) DEFAULT 'active',
          assigned_by UUID,
          assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deactivated_at TIMESTAMP WITH TIME ZONE,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        ALTER TABLE store_manager_assignments ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage store manager assignments" ON store_manager_assignments
          FOR ALL TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM users 
              WHERE id = auth.uid() AND role = 'admin'
            )
          );
      `
    },
    {
      name: 'area_manager_store_assignments',
      sql: `
        CREATE TABLE IF NOT EXISTS area_manager_store_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          store_id UUID NOT NULL,
          area_manager_id UUID NOT NULL,
          assignment_source VARCHAR(50) DEFAULT 'manual',
          status VARCHAR(20) DEFAULT 'active',
          assigned_by UUID,
          assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deactivated_at TIMESTAMP WITH TIME ZONE,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        ALTER TABLE area_manager_store_assignments ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage area manager store assignments" ON area_manager_store_assignments
          FOR ALL TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM users 
              WHERE id = auth.uid() AND role = 'admin'
            )
          );
      `
    },
    {
      name: 'regional_manager_assignments',
      sql: `
        CREATE TABLE IF NOT EXISTS regional_manager_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          store_id UUID NOT NULL,
          regional_manager_id UUID NOT NULL,
          assignment_source VARCHAR(50) DEFAULT 'manual',
          status VARCHAR(20) DEFAULT 'active',
          assigned_by UUID,
          assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deactivated_at TIMESTAMP WITH TIME ZONE,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        ALTER TABLE regional_manager_assignments ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage regional manager assignments" ON regional_manager_assignments
          FOR ALL TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM users 
              WHERE id = auth.uid() AND role = 'admin'
            )
          );
      `
    },
    {
      name: 'regional_area_manager_assignments',
      sql: `
        CREATE TABLE IF NOT EXISTS regional_area_manager_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          regional_manager_id UUID NOT NULL,
          area_manager_id UUID NOT NULL,
          assignment_source VARCHAR(50) DEFAULT 'manual',
          status VARCHAR(20) DEFAULT 'active',
          assigned_by UUID,
          assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deactivated_at TIMESTAMP WITH TIME ZONE,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        ALTER TABLE regional_area_manager_assignments ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage regional area manager assignments" ON regional_area_manager_assignments
          FOR ALL TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM users 
              WHERE id = auth.uid() AND role = 'admin'
            )
          );
      `
    },
    {
      name: 'excel_sync_logs',
      sql: `
        CREATE TABLE IF NOT EXISTS excel_sync_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sync_id UUID NOT NULL,
          operation_type VARCHAR(50) NOT NULL,
          total_rows_processed INTEGER DEFAULT 0,
          users_created INTEGER DEFAULT 0,
          users_updated INTEGER DEFAULT 0,
          stores_created INTEGER DEFAULT 0,
          stores_updated INTEGER DEFAULT 0,
          assignments_created INTEGER DEFAULT 0,
          conflicts_found INTEGER DEFAULT 0,
          sync_status VARCHAR(20) DEFAULT 'started',
          error_details TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        ALTER TABLE excel_sync_logs ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage sync logs" ON excel_sync_logs
          FOR ALL TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM users 
              WHERE id = auth.uid() AND role = 'admin'
            )
          );
      `
    },
    {
      name: 'sync_conflicts',
      sql: `
        CREATE TABLE IF NOT EXISTS sync_conflicts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sync_id UUID NOT NULL,
          conflict_type VARCHAR(50) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id UUID,
          conflict_description TEXT NOT NULL,
          resolution_status VARCHAR(20) DEFAULT 'pending',
          resolution_notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage sync conflicts" ON sync_conflicts
          FOR ALL TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM users 
              WHERE id = auth.uid() AND role = 'admin'
            )
          );
      `
    }
  ];
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const table of tables) {
    try {
      console.log(`Creating ${table.name}...`);
      
      // Try to use exec_sql function if available
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: table.sql
      });
      
      if (error) {
        console.log(`❌ ${table.name}: ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ ${table.name}: created successfully`);
        successCount++;
      }
    } catch (err) {
      console.log(`❌ ${table.name}: ${err.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Results: ${successCount} success, ${errorCount} errors`);
  
  // Verify tables were created
  console.log('\n🔍 Verifying tables...');
  const tableNames = tables.map(t => t.name);
  
  for (const tableName of tableNames) {
    try {
      const { data, error } = await supabase.from(tableName).select('*').limit(1);
      console.log(`${tableName}: ${error ? 'MISSING' : 'EXISTS'}`);
    } catch (err) {
      console.log(`${tableName}: ERROR`);
    }
  }
  
  console.log('\n✅ Assignment tables setup complete!');
  console.log('The hierarchy-upload.tsx component should now work without 400 errors.');
}

createTables().catch(console.error);