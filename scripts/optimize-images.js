const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Directories to optimize
const directories = [
  path.join(__dirname, '../public/uploads'),
  path.join(__dirname, '../public/Images')
];

// Image extensions to process
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

// Quality settings
const jpegOptions = { quality: 80 };
const pngOptions = { quality: 80 };
const webpOptions = { quality: 80 };

// Max width for large images
const MAX_WIDTH = 1200;

// Function to get all files in a directory recursively
async function getFiles(dir) {
  const subdirs = await readdir(dir);
  const files = await Promise.all(subdirs.map(async (subdir) => {
    const res = path.resolve(dir, subdir);
    return (await stat(res)).isDirectory() ? getFiles(res) : res;
  }));
  return files.flat();
}

// Function to optimize a single image
async function optimizeImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  // Skip if not an image we want to process
  if (!imageExtensions.includes(ext)) {
    return;
  }
  
  // Create backup if it doesn't exist
  const backupPath = `${filePath}.backup`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`Created backup: ${backupPath}`);
  }
  
  try {
    // Get image info
    const metadata = await sharp(filePath).metadata();
    
    // Skip small images
    if (metadata.width <= MAX_WIDTH) {
      console.log(`Skipping ${filePath} (already small enough: ${metadata.width}px)`);
      return;
    }
    
    // Process based on file type
    let processedImage;
    
    if (ext === '.jpg' || ext === '.jpeg') {
      processedImage = await sharp(filePath)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg(jpegOptions);
    } else if (ext === '.png') {
      processedImage = await sharp(filePath)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .png(pngOptions);
    } else if (ext === '.webp') {
      processedImage = await sharp(filePath)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp(webpOptions);
    }
    
    // Save the optimized image
    await processedImage.toFile(`${filePath}.optimized`);
    fs.renameSync(`${filePath}.optimized`, filePath);
    
    // Get file sizes for reporting
    const originalSize = fs.statSync(backupPath).size;
    const optimizedSize = fs.statSync(filePath).size;
    const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);
    
    console.log(`Optimized: ${filePath}`);
    console.log(`  Original: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`  Optimized: ${(optimizedSize / 1024).toFixed(2)} KB`);
    console.log(`  Savings: ${savings}%`);
    
  } catch (error) {
    console.error(`Error optimizing ${filePath}:`, error);
  }
}

// Main function
async function optimizeImages() {
  console.log('Starting image optimization...');
  
  // Install sharp if not already installed
  try {
    require.resolve('sharp');
    console.log('Sharp is already installed.');
  } catch (e) {
    console.log('Installing sharp package...');
    require('child_process').execSync('npm install sharp --save');
    console.log('Sharp installed successfully.');
  }
  
  // Process each directory
  for (const dir of directories) {
    console.log(`Processing directory: ${dir}`);
    try {
      const files = await getFiles(dir);
      console.log(`Found ${files.length} files in ${dir}`);
      
      // Process files in batches to avoid memory issues
      const BATCH_SIZE = 10;
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(file => optimizeImage(file)));
        console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(files.length / BATCH_SIZE)}`);
      }
    } catch (error) {
      console.error(`Error processing directory ${dir}:`, error);
    }
  }
  
  console.log('Image optimization complete!');
}

// Run the optimization
optimizeImages().catch(console.error);
