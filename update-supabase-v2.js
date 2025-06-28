// ES Module script to update Supabase imports across the project
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current file's directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const rootDir = path.resolve(__dirname, 'src');
const extensions = ['.ts', '.tsx', '.js', '.jsx'];
const oldImportPattern = /import\s+\{\s*supabase\s*\}\s+from\s+['"](@\/lib\/supabase|\.\/lib\/supabase)['"]/;
const newImportStatement = `import { getSupabaseClient } from '@/lib/supabase';`;
const logFilePath = path.resolve(__dirname, 'supabase-update-log.txt');

// Function to append to log file
async function appendToLog(message) {
  await fs.appendFile(logFilePath, message + '\n', 'utf8');
}

// Function to check if a file is a React component
function isReactComponent(content) {
  return /function\s+\w+\(\)/.test(content) || 
         /const\s+\w+\s*=\s*\(\)\s*=>/.test(content) ||
         /export\s+(default\s+)?(function|class)/.test(content);
}

// Function to find where to insert the supabase initialization
function findInitializationPoint(content, filePath) {
  // Special case for utility files with no component structure
  if (filePath.includes('utils') || filePath.includes('lib')) {
    // For utility files, add initialization at the top level, after imports
    const lastImportIndex = content.lastIndexOf('import');
    if (lastImportIndex !== -1) {
      const endOfImports = content.indexOf(';', lastImportIndex) + 1;
      if (endOfImports !== 0) {
        return {
          point: endOfImports,
          isComponent: false,
          functionName: 'top-level'
        };
      }
    }
  }

  // Look for component function definition
  const componentMatch = content.match(/export\s+(?:default\s+)?(?:function|const)\s+(\w+)(?:\s*=\s*(?:\(\)|\(props\)|\{[^}]*\})\s*=>|\([^)]*\)\s*{)/);
  
  if (componentMatch) {
    const componentName = componentMatch[1];
    const componentStart = content.indexOf(componentMatch[0]);
    
    // Find the opening brace of the component function
    const openBraceIndex = content.indexOf('{', componentStart);
    if (openBraceIndex !== -1) {
      // Find the first statement after the opening brace
      let insertPoint = openBraceIndex + 1;
      
      // Skip whitespace and newlines
      while (insertPoint < content.length && /\s/.test(content[insertPoint])) {
        insertPoint++;
      }
      
      return {
        point: insertPoint,
        isComponent: true,
        componentName
      };
    }
  }
  
  // If not a component, look for the first function or top-level code
  const functionMatch = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*{/);
  if (functionMatch) {
    const functionName = functionMatch[1];
    const functionStart = content.indexOf(functionMatch[0]);
    
    // Find the opening brace of the function
    const openBraceIndex = content.indexOf('{', functionStart);
    if (openBraceIndex !== -1) {
      // Find the first statement after the opening brace
      let insertPoint = openBraceIndex + 1;
      
      // Skip whitespace and newlines
      while (insertPoint < content.length && /\s/.test(content[insertPoint])) {
        insertPoint++;
      }
      
      return {
        point: insertPoint,
        isComponent: false,
        functionName
      };
    }
  }
  
  // If no suitable insertion point found, return null
  return null;
}

// Function to update a single file
async function updateFile(filePath) {
  try {
    console.log(`Processing ${filePath}...`);
    await appendToLog(`Processing ${filePath}...`);
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Skip if file is supabase.ts itself
    if (filePath.includes('supabase.ts')) {
      console.log(`  Skipping supabase.ts itself`);
      await appendToLog(`  Skipping supabase.ts itself`);
      return { success: true, message: 'Skipped supabase.ts', filePath };
    }
    
    // Check if the file imports supabase
    if (!oldImportPattern.test(content)) {
      console.log(`  No supabase import found in ${filePath}`);
      await appendToLog(`  No supabase import found`);
      return { success: true, message: 'No supabase import found', filePath };
    }
    
    // Update import statement
    let updatedContent = content.replace(oldImportPattern, newImportStatement);
    
    // Find where to insert the supabase initialization
    const initPoint = findInitializationPoint(updatedContent, filePath);
    
    if (!initPoint) {
      console.log(`  ⚠️ Could not find suitable insertion point in ${filePath}`);
      await appendToLog(`  ⚠️ Could not find suitable insertion point`);
      return { 
        success: false, 
        message: 'Could not find suitable insertion point',
        filePath 
      };
    }
    
    // Insert the initialization line
    const initLine = initPoint.isComponent || initPoint.functionName !== 'top-level'
      ? `\n  const supabase = getSupabaseClient(); // Initialize Supabase client`
      : `\n\n// Initialize Supabase client\nconst supabase = getSupabaseClient();\n`;
    
    updatedContent = 
      updatedContent.substring(0, initPoint.point) + 
      initLine + 
      updatedContent.substring(initPoint.point);
    
    // Write updated content back to file
    await fs.writeFile(filePath, updatedContent, 'utf8');
    
    console.log(`  ✅ Updated ${filePath}`);
    console.log(`     - Changed import statement`);
    console.log(`     - Added initialization in ${initPoint.isComponent ? 'component' : 'function'} ${initPoint.functionName}`);
    
    await appendToLog(`  ✅ Updated file`);
    await appendToLog(`     - Changed import statement`);
    await appendToLog(`     - Added initialization in ${initPoint.isComponent ? 'component' : 'function'} ${initPoint.functionName}`);
    
    return { success: true, message: 'File updated successfully', filePath };
  } catch (error) {
    console.error(`  ❌ Error updating ${filePath}:`, error.message);
    await appendToLog(`  ❌ Error: ${error.message}`);
    return { success: false, message: error.message, filePath };
  }
}

// Recursive function to find all files with specified extensions
async function findFiles(dir, fileList = []) {
  const files = await fs.readdir(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other irrelevant directories
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
        fileList = await findFiles(filePath, fileList);
      }
    } else if (extensions.includes(path.extname(file))) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

// Main function
async function main() {
  try {
    // Initialize log file
    await fs.writeFile(logFilePath, `Supabase Import Update Log - ${new Date().toISOString()}\n\n`, 'utf8');
    
    console.log('Starting Supabase import update script...');
    await appendToLog('Starting Supabase import update script...');
    
    console.log(`Searching for files in ${rootDir}...`);
    await appendToLog(`Searching for files in ${rootDir}...`);
    
    // Find all relevant files
    const files = await findFiles(rootDir);
    console.log(`Found ${files.length} files with relevant extensions`);
    await appendToLog(`Found ${files.length} files with relevant extensions`);
    
    // Process each file
    const results = [];
    for (const file of files) {
      const result = await updateFile(file);
      results.push({ file, ...result });
    }
    
    // Print summary
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const updatedCount = results.filter(r => r.success && r.message === 'File updated successfully').length;
    const skippedCount = results.filter(r => r.success && r.message === 'Skipped supabase.ts').length;
    const noImportCount = results.filter(r => r.success && r.message === 'No supabase import found').length;
    
    console.log('\n=== Summary ===');
    console.log(`Total files processed: ${results.length}`);
    console.log(`Files with supabase imports updated: ${updatedCount}`);
    console.log(`Files with no supabase imports: ${noImportCount}`);
    console.log(`Files skipped (supabase.ts): ${skippedCount}`);
    console.log(`Files that failed to update: ${failCount}`);
    
    await appendToLog('\n=== Summary ===');
    await appendToLog(`Total files processed: ${results.length}`);
    await appendToLog(`Files with supabase imports updated: ${updatedCount}`);
    await appendToLog(`Files with no supabase imports: ${noImportCount}`);
    await appendToLog(`Files skipped (supabase.ts): ${skippedCount}`);
    await appendToLog(`Files that failed to update: ${failCount}`);
    
    if (failCount > 0) {
      console.log('\n=== Failed Files ===');
      await appendToLog('\n=== Failed Files ===');
      
      results.filter(r => !r.success).forEach(r => {
        console.log(`- ${r.filePath}: ${r.message}`);
        appendToLog(`- ${r.filePath}: ${r.message}`);
      });
      
      console.log('\nPlease check these files manually.');
      await appendToLog('\nPlease check these files manually.');
    }
    
    console.log('\nUpdate complete! Check supabase-update-log.txt for details.');
    await appendToLog('\nUpdate complete!');
  } catch (error) {
    console.error('Error:', error.message);
    await appendToLog(`Fatal Error: ${error.message}`);
  }
}

// Run the script
main();
