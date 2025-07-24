const fs = require('fs');

try {
  const content = fs.readFileSync('src/components/admin/hierarchy-upload.tsx', 'utf8');
  const lines = content.split('\n');
  
  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Count braces
    for (let char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
    }
    
    // Report significant imbalances
    if (lineNum >= 870 && lineNum <= 900) {
      console.log(`Line ${lineNum}: ${line.trim()}`);
      console.log(`  Braces: ${braceCount}, Parens: ${parenCount}, Brackets: ${bracketCount}`);
    }
  }
  
  console.log(`\nFinal counts:`);
  console.log(`Braces: ${braceCount}`);
  console.log(`Parentheses: ${parenCount}`);
  console.log(`Square brackets: ${bracketCount}`);
  
  if (braceCount === 0 && parenCount === 0 && bracketCount === 0) {
    console.log('✅ All brackets are balanced!');
  } else {
    console.log('❌ Bracket imbalance detected!');
  }
} catch (error) {
  console.error('Error:', error.message);
}