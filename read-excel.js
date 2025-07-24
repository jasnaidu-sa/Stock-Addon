import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the Excel file
const workbook = XLSX.readFile('rm_store_structure.xlsx');

// Get the first sheet
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];

// Convert to JSON
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Total rows:', data.length);
console.log('\nColumn names:');
if (data.length > 0) {
    console.log(Object.keys(data[0]));
}

console.log('\nFirst 10 rows:');
console.log(data.slice(0, 10));

// Analyze specific columns
const amUsernameColumn = 'am_username';
const amEmailColumn = 'am_email';
const smUsernameColumn = 'Store_manager_username';
const smEmailColumn = 'Store_manager_email';

console.log('\n' + '='.repeat(50));
console.log('Area Manager Columns Analysis:');

// Check am_username
if (data.length > 0 && amUsernameColumn in data[0]) {
    const amUsernames = data.map(row => row[amUsernameColumn]);
    const nonEmptyAmUsernames = amUsernames.filter(val => val && val.toString().trim() !== '');
    console.log(`\n${amUsernameColumn}:`);
    console.log(`  - Total entries: ${amUsernames.length}`);
    console.log(`  - Non-empty entries: ${nonEmptyAmUsernames.length}`);
    console.log(`  - Empty/null entries: ${amUsernames.length - nonEmptyAmUsernames.length}`);
    console.log(`  - Sample values: ${nonEmptyAmUsernames.slice(0, 5).join(', ')}`);
}

// Check am_email
if (data.length > 0 && amEmailColumn in data[0]) {
    const amEmails = data.map(row => row[amEmailColumn]);
    const nonEmptyAmEmails = amEmails.filter(val => val && val.toString().trim() !== '');
    console.log(`\n${amEmailColumn}:`);
    console.log(`  - Total entries: ${amEmails.length}`);
    console.log(`  - Non-empty entries: ${nonEmptyAmEmails.length}`);
    console.log(`  - Empty/null entries: ${amEmails.length - nonEmptyAmEmails.length}`);
    console.log(`  - Sample values: ${nonEmptyAmEmails.slice(0, 5).join(', ')}`);
}

console.log('\n' + '='.repeat(50));
console.log('Store Manager Columns Analysis:');

// Check Store_manager_username
if (data.length > 0 && smUsernameColumn in data[0]) {
    const smUsernames = data.map(row => row[smUsernameColumn]);
    const nonEmptySmUsernames = smUsernames.filter(val => val && val.toString().trim() !== '');
    console.log(`\n${smUsernameColumn}:`);
    console.log(`  - Total entries: ${smUsernames.length}`);
    console.log(`  - Non-empty entries: ${nonEmptySmUsernames.length}`);
    console.log(`  - Empty/null entries: ${smUsernames.length - nonEmptySmUsernames.length}`);
    console.log(`  - Sample values: ${nonEmptySmUsernames.slice(0, 5).join(', ')}`);
}

// Check Store_manager_email
if (data.length > 0 && smEmailColumn in data[0]) {
    const smEmails = data.map(row => row[smEmailColumn]);
    const nonEmptySmEmails = smEmails.filter(val => val && val.toString().trim() !== '');
    console.log(`\n${smEmailColumn}:`);
    console.log(`  - Total entries: ${smEmails.length}`);
    console.log(`  - Non-empty entries: ${nonEmptySmEmails.length}`);
    console.log(`  - Empty/null entries: ${smEmails.length - nonEmptySmEmails.length}`);
    console.log(`  - Sample values: ${nonEmptySmEmails.slice(0, 5).join(', ')}`);
}

// Check if columns exist
console.log('\n' + '='.repeat(50));
console.log('Column existence check:');
console.log(`- ${amUsernameColumn}: ${data.length > 0 && amUsernameColumn in data[0] ? 'EXISTS' : 'NOT FOUND'}`);
console.log(`- ${amEmailColumn}: ${data.length > 0 && amEmailColumn in data[0] ? 'EXISTS' : 'NOT FOUND'}`);
console.log(`- ${smUsernameColumn}: ${data.length > 0 && smUsernameColumn in data[0] ? 'EXISTS' : 'NOT FOUND'}`);
console.log(`- ${smEmailColumn}: ${data.length > 0 && smEmailColumn in data[0] ? 'EXISTS' : 'NOT FOUND'}`);

// Look for any other potential username/email columns
console.log('\n' + '='.repeat(50));
console.log('All columns in the Excel file:');
if (data.length > 0) {
    Object.keys(data[0]).forEach(col => {
        console.log(`- ${col}`);
    });
}