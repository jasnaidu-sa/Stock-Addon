// Simple syntax checker
const fs = require('fs');

try {
  const content = fs.readFileSync('src/components/admin/hierarchy-upload.tsx', 'utf8');
  
  // Basic bracket counting
  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
  }
  
  console.log('Bracket Analysis:');
  console.log(`Braces: ${braceCount} (${braceCount === 0 ? 'BALANCED' : 'IMBALANCED'})`);
  console.log(`Parentheses: ${parenCount} (${parenCount === 0 ? 'BALANCED' : 'IMBALANCED'})`);
  console.log(`Square brackets: ${bracketCount} (${bracketCount === 0 ? 'BALANCED' : 'IMBALANCED'})`);
  
  // Check for common JSX/TSX patterns
  const lines = content.split('\n');
  let inFunction = false;
  let functionName = '';
  let functionLevel = 0;
  let errors = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;
    
    // Check for function definitions
    if (line.includes('const processUser = async')) {
      inFunction = true;
      functionName = 'processUser';
      functionLevel = 0;
      console.log(`Found function: ${functionName} at line ${lineNum}`);
    }
    
    if (line.includes('const processStore = async')) {
      inFunction = true;
      functionName = 'processStore';
      functionLevel = 0;
      console.log(`Found function: ${functionName} at line ${lineNum}`);
    }
    
    if (inFunction) {
      // Count braces in this line
      for (let char of line) {
        if (char === '{') functionLevel++;
        if (char === '}') functionLevel--;
      }
      
      // Check if function ended
      if (functionLevel === 0 && line.includes('};')) {
        console.log(`Function ${functionName} ended at line ${lineNum}`);
        inFunction = false;
        functionName = '';
      }
    }
  }
  
  console.log('\n✅ Basic syntax check completed');
  
} catch (error) {
  console.error('❌ Error reading file:', error.message);
}