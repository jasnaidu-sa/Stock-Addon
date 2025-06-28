import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current file's directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use native promise-based fs methods
const readFileAsync = fs.promises.readFile;
const writeFileAsync = fs.promises.writeFile;
const readdirAsync = fs.promises.readdir;
const statAsync = fs.promises.stat;

// Configuration
const rootDir = path.resolve(__dirname, 'src');
const extensions = ['.ts', '.tsx', '.js', '.jsx'];
const oldImportPattern = /import\s+\{\s*supabase\s*\}\s+from\s+['"](@\/lib\/supabase|\.\/lib\/supabase)['"]/;
const newImportStatement = `import { getSupabaseClient } from '@/lib/supabase';`;

// Function to check if a file is a React component
function isReactComponent(content) {
  return /function\s+\w+\(\)/.test(content) || 
         /const\s+\w+\s*=\s*\(\)\s*=>/.test(content) ||
         /export\s+(default\s+)?(function|class)/.test(content);
}

// Function to find where to insert the supabase initialization
function findInitializationPoint(content) {
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
    
    // Read file content
    const content = await readFileAsync(filePath, 'utf8');
    
    // Check if the file imports supabase
    if (!oldImportPattern.test(content)) {
      console.log(`  No supabase import found in ${filePath}`);
      return { success: true, message: 'No supabase import found' };
    }
    
    // Update import statement
    let updatedContent = content.replace(oldImportPattern, newImportStatement);
    
    // Find where to insert the supabase initialization
    const initPoint = findInitializationPoint(updatedContent);
    
    if (!initPoint) {
      console.log(`  ⚠️ Could not find suitable insertion point in ${filePath}`);
      return { 
        success: false, 
        message: 'Could not find suitable insertion point',
        filePath 
      };
    }
    
    // Insert the initialization line
    const initLine = `\n  const supabase = getSupabaseClient(); // Initialize Supabase client`;
    updatedContent = 
      updatedContent.substring(0, initPoint.point) + 
      initLine + 
      updatedContent.substring(initPoint.point);
    
    // Write updated content back to file
    await writeFileAsync(filePath, updatedContent, 'utf8');
    
    console.log(`  ✅ Updated ${filePath}`);
    console.log(`     - Changed import statement`);
    console.log(`     - Added initialization in ${initPoint.isComponent ? 'component' : 'function'} ${initPoint.isComponent ? initPoint.componentName : initPoint.functionName}`);
    
    return { success: true, message: 'File updated successfully' };
  } catch (error) {
    console.error(`  ❌ Error updating ${filePath}:`, error.message);
    return { success: false, message: error.message, filePath };
  }
}

// Recursive function to find all files with specified extensions
async function findFiles(dir, fileList = []) {
  const files = await readdirAsync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await statAsync(filePath);
    
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
    console.log('Starting Supabase import update script...');
    console.log(`Searching for files in ${rootDir}...`);
    
    // Find all relevant files
    const files = await findFiles(rootDir);
    console.log(`Found ${files.length} files with relevant extensions`);
    
    // Process each file
    const results = [];
    for (const file of files) {
      const result = await updateFile(file);
      results.push({ file, ...result });
    }
    
    // Print summary
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const updatedCount = results.filter(r => r.success && r.message !== 'No supabase import found').length;
    
    console.log('\n=== Summary ===');
    console.log(`Total files processed: ${results.length}`);
    console.log(`Files with supabase imports updated: ${updatedCount}`);
    console.log(`Files with no supabase imports: ${successCount - updatedCount}`);
    console.log(`Files that failed to update: ${failCount}`);
    
    if (failCount > 0) {
      console.log('\n=== Failed Files ===');
      results.filter(r => !r.success).forEach(r => {
        console.log(`- ${r.file}: ${r.message}`);
      });
      console.log('\nPlease check these files manually.');
    }
    
    console.log('\nUpdate complete!');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the script
main();
