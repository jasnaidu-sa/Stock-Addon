import XLSX from 'xlsx';
import fs from 'fs';

try {
  // Read the Excel file
  const workbook = XLSX.readFile('rm_store_structure.xlsx');
  
  // Get sheet names
  console.log('Sheet names:', workbook.SheetNames);
  
  // Get the first sheet (or Sheet1 if it exists)
  const sheetName = workbook.SheetNames.includes('Sheet1') ? 'Sheet1' : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log('\nTotal rows:', data.length);
  
  if (data.length > 0) {
    console.log('\nColumn names found:');
    Object.keys(data[0]).forEach(col => console.log(`  - ${col}`));
    
    // Analyze specific columns
    const columnsToAnalyze = [
      'am_username', 'am_email', 'am_name', 'am_surname',
      'Store_manager_username', 'Store_manager_email', 'store_manager'
    ];
    
    console.log('\n' + '='.repeat(60));
    console.log('COLUMN ANALYSIS:');
    console.log('='.repeat(60));
    
    columnsToAnalyze.forEach(colName => {
      if (colName in data[0]) {
        const values = data.map(row => row[colName]);
        const nonEmpty = values.filter(v => v && String(v).trim() !== '' && String(v).toLowerCase() !== 'vacant');
        const vacant = values.filter(v => String(v).toLowerCase() === 'vacant');
        const empty = values.filter(v => !v || String(v).trim() === '');
        
        console.log(`\n${colName}:`);
        console.log(`  Total rows: ${values.length}`);
        console.log(`  Non-empty values: ${nonEmpty.length}`);
        console.log(`  Vacant values: ${vacant.length}`);
        console.log(`  Empty/null values: ${empty.length}`);
        
        if (nonEmpty.length > 0) {
          console.log(`  Sample values (first 5):`);
          nonEmpty.slice(0, 5).forEach(v => console.log(`    - "${v}"`));
        }
      } else {
        console.log(`\n${colName}: COLUMN NOT FOUND`);
      }
    });
    
    // Show first few complete rows
    console.log('\n' + '='.repeat(60));
    console.log('FIRST 3 ROWS (COMPLETE DATA):');
    console.log('='.repeat(60));
    
    data.slice(0, 3).forEach((row, index) => {
      console.log(`\nRow ${index + 1}:`);
      Object.entries(row).forEach(([key, value]) => {
        if (columnsToAnalyze.includes(key)) {
          console.log(`  ${key}: "${value || ''}"`);  
        }
      });
    });
  }
  
} catch (error) {
  console.error('Error reading Excel file:', error.message);
  console.error('Stack trace:', error.stack);
}