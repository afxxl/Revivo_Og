const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

// Directories to optimize
const directories = [
  path.join(__dirname, '../public/js'),
  path.join(__dirname, '../public/css')
];

// File extensions to process
const extensions = ['.js', '.css'];

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

// Function to minify JavaScript
async function minifyJS(filePath) {
  try {
    // Install terser if not already installed
    try {
      require.resolve('terser');
    } catch (e) {
      console.log('Installing terser package...');
      require('child_process').execSync('npm install terser --save-dev');
      console.log('Terser installed successfully.');
    }
    
    const terser = require('terser');
    
    // Create backup if it doesn't exist
    const backupPath = `${filePath}.backup`;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
      console.log(`Created backup: ${backupPath}`);
    }
    
    // Read file content
    const content = await readFile(filePath, 'utf8');
    
    // Minify
    const result = await terser.minify(content, {
      compress: true,
      mangle: true
    });
    
    if (result.error) {
      throw result.error;
    }
    
    // Write minified content
    await writeFile(filePath, result.code);
    
    // Get file sizes for reporting
    const originalSize = fs.statSync(backupPath).size;
    const minifiedSize = fs.statSync(filePath).size;
    const savings = ((originalSize - minifiedSize) / originalSize * 100).toFixed(2);
    
    console.log(`Minified JS: ${filePath}`);
    console.log(`  Original: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`  Minified: ${(minifiedSize / 1024).toFixed(2)} KB`);
    console.log(`  Savings: ${savings}%`);
    
  } catch (error) {
    console.error(`Error minifying JS ${filePath}:`, error);
  }
}

// Function to minify CSS
async function minifyCSS(filePath) {
  try {
    // Install clean-css if not already installed
    try {
      require.resolve('clean-css');
    } catch (e) {
      console.log('Installing clean-css package...');
      require('child_process').execSync('npm install clean-css --save-dev');
      console.log('Clean-CSS installed successfully.');
    }
    
    const CleanCSS = require('clean-css');
    
    // Create backup if it doesn't exist
    const backupPath = `${filePath}.backup`;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
      console.log(`Created backup: ${backupPath}`);
    }
    
    // Read file content
    const content = await readFile(filePath, 'utf8');
    
    // Minify
    const output = new CleanCSS({
      level: 2
    }).minify(content);
    
    // Write minified content
    await writeFile(filePath, output.styles);
    
    // Get file sizes for reporting
    const originalSize = fs.statSync(backupPath).size;
    const minifiedSize = fs.statSync(filePath).size;
    const savings = ((originalSize - minifiedSize) / originalSize * 100).toFixed(2);
    
    console.log(`Minified CSS: ${filePath}`);
    console.log(`  Original: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`  Minified: ${(minifiedSize / 1024).toFixed(2)} KB`);
    console.log(`  Savings: ${savings}%`);
    
  } catch (error) {
    console.error(`Error minifying CSS ${filePath}:`, error);
  }
}

// Main function
async function optimizeAssets() {
  console.log('Starting asset optimization...');
  
  // Process each directory
  for (const dir of directories) {
    console.log(`Processing directory: ${dir}`);
    try {
      const files = await getFiles(dir);
      console.log(`Found ${files.length} files in ${dir}`);
      
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        
        if (ext === '.js') {
          await minifyJS(file);
        } else if (ext === '.css') {
          await minifyCSS(file);
        }
      }
    } catch (error) {
      console.error(`Error processing directory ${dir}:`, error);
    }
  }
  
  console.log('Asset optimization complete!');
}

// Run the optimization
optimizeAssets().catch(console.error);
