const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const rename = promisify(fs.rename);
const unlink = promisify(fs.unlink);

// Directories to restore
const directories = [
  path.join(__dirname, '../public/js'),
  path.join(__dirname, '../public/css'),
  path.join(__dirname, '../public')
];

// Function to get all files in a directory recursively
async function getFiles(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory does not exist: ${dir}`);
    return [];
  }
  
  const subdirs = await readdir(dir);
  const files = await Promise.all(subdirs.map(async (subdir) => {
    const res = path.resolve(dir, subdir);
    return (await stat(res)).isDirectory() ? getFiles(res) : res;
  }));
  return files.flat();
}

// Function to restore backup files
async function restoreBackups() {
  console.log('Starting restoration of backup files...');
  
  // Process each directory
  for (const dir of directories) {
    console.log(`Processing directory: ${dir}`);
    try {
      const files = await getFiles(dir);
      
      for (const file of files) {
        if (file.endsWith('.backup')) {
          const originalFile = file.replace('.backup', '');
          console.log(`Restoring backup: ${file} -> ${originalFile}`);
          
          try {
            await rename(file, originalFile);
            console.log(`✓ Successfully restored: ${originalFile}`);
          } catch (error) {
            console.error(`Error restoring ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing directory ${dir}:`, error);
    }
  }
  
  console.log('Backup restoration complete!');
}

// Function to remove minified files
async function removeMinifiedFiles() {
  console.log('Removing minified files...');
  
  // Process each directory
  for (const dir of directories) {
    console.log(`Processing directory: ${dir}`);
    try {
      const files = await getFiles(dir);
      
      for (const file of files) {
        if (file.includes('.min.') && (file.endsWith('.js') || file.endsWith('.css'))) {
          console.log(`Removing minified file: ${file}`);
          
          try {
            await unlink(file);
            console.log(`✓ Successfully removed: ${file}`);
          } catch (error) {
            console.error(`Error removing ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing directory ${dir}:`, error);
    }
  }
  
  console.log('Minified files removal complete!');
}

// Function to restore header.js if missing
async function restoreHeaderJS() {
  const headerJsPath = path.join(__dirname, '../public/js/header.js');
  const headerScriptsPath = path.join(__dirname, '../public/js/header-scripts.js');
  
  if (!fs.existsSync(headerJsPath) && fs.existsSync(headerScriptsPath)) {
    console.log('Restoring header.js from header-scripts.js...');
    
    try {
      await rename(headerScriptsPath, headerJsPath);
      console.log(`✓ Successfully restored header.js`);
    } catch (error) {
      console.error(`Error restoring header.js:`, error);
    }
  }
}

// Main function
async function restoreOriginalFiles() {
  console.log('Starting restoration process...');
  
  await restoreBackups();
  await removeMinifiedFiles();
  await restoreHeaderJS();
  
  console.log('Restoration process complete!');
  console.log('Please restart your application to apply the changes.');
}

// Run the restoration
restoreOriginalFiles().catch(console.error);
