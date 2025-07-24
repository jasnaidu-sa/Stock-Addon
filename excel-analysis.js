const XLSX = require('xlsx');
const fs = require('fs');

// Function to analyze Excel file
function analyzeExcel() {
  try {
    // Read the Excel file
    const workbook = XLSX.readFile('rm_store_structure.xlsx');
    
    let output = [];
    output.push('EXCEL FILE ANALYSIS REPORT');
    output.push('=' + '='.repeat(60));
    output.push('\nSheet names: ' + workbook.SheetNames.join(', '));
    
    // Get the first sheet (or Sheet1 if it exists)
    const sheetName = workbook.SheetNames.includes('Sheet1') ? 'Sheet1' : workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    output.push(`\nUsing sheet: ${sheetName}`);
    output.push(`Total rows: ${data.length}`);
    
    if (data.length > 0) {
      output.push('\nColumn names found:');
      Object.keys(data[0]).forEach(col => output.push(`  - ${col}`));
      
      // Analyze specific columns
      const columnsToAnalyze = [
        'am_username', 'am_email', 'am_name', 'am_surname',
        'Store_manager_username', 'Store_manager_email', 'store_manager'
      ];
      
      output.push('\n' + '='.repeat(60));
      output.push('COLUMN ANALYSIS:');
      output.push('='.repeat(60));
      
      columnsToAnalyze.forEach(colName => {
        if (colName in data[0]) {
          const values = data.map(row => row[colName]);
          const nonEmpty = values.filter(v => v && String(v).trim() !== '' && String(v).toLowerCase() !== 'vacant');
          const vacant = values.filter(v => String(v).toLowerCase() === 'vacant');
          const empty = values.filter(v => !v || String(v).trim() === '');
          
          output.push(`\n${colName}:`);
          output.push(`  Total rows: ${values.length}`);
          output.push(`  Non-empty values: ${nonEmpty.length}`);
          output.push(`  Vacant values: ${vacant.length}`);
          output.push(`  Empty/null values: ${empty.length}`);
          
          if (nonEmpty.length > 0) {
            output.push(`  Sample values (first 5):`);
            nonEmpty.slice(0, 5).forEach(v => output.push(`    - "${v}"`));
          }
        } else {
          output.push(`\n${colName}: COLUMN NOT FOUND`);
        }
      });
      
      // Show first few complete rows
      output.push('\n' + '='.repeat(60));
      output.push('FIRST 3 ROWS (COMPLETE DATA):');
      output.push('='.repeat(60));
      
      data.slice(0, 3).forEach((row, index) => {
        output.push(`\nRow ${index + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          if (columnsToAnalyze.includes(key)) {
            output.push(`  ${key}: "${value || ''}"`);  
          }
        });
      });
      
      // Also show some random rows to check for vacant values
      output.push('\n' + '='.repeat(60));
      output.push('CHECKING FOR VACANT VALUES (random sample):');
      output.push('='.repeat(60));
      
      // Find rows with 'vacant' values
      const rowsWithVacant = data.filter((row, idx) => {
        return columnsToAnalyze.some(col => 
          row[col] && String(row[col]).toLowerCase() === 'vacant'
        );
      });
      
      output.push(`\nFound ${rowsWithVacant.length} rows with 'vacant' values`);
      if (rowsWithVacant.length > 0) {
        output.push('\nShowing first 3 rows with vacant values:');
        rowsWithVacant.slice(0, 3).forEach((row, index) => {
          output.push(`\nRow with vacant values #${index + 1}:`);
          columnsToAnalyze.forEach(col => {
            if (col in row) {
              output.push(`  ${col}: "${row[col] || ''}"`);  
            }
          });
        });
      }
    }
    
    // Write output to file
    const outputText = output.join('\n');
    fs.writeFileSync('excel-analysis-results.txt', outputText);
    console.log('Analysis complete! Results written to excel-analysis-results.txt');
    
    // Also output to console
    console.log('\n' + outputText);
    
  } catch (error) {
    const errorMsg = `Error reading Excel file: ${error.message}\nStack trace: ${error.stack}`;
    fs.writeFileSync('excel-analysis-error.txt', errorMsg);
    console.error(errorMsg);
  }
}

// Run the analysis
analyzeExcel();