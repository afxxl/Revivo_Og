const { batchOptimizeImages } = require('./imageOptimizer');
const path = require('path');
const fs = require('fs');

/**
 * Recursively gets all image files from a directory
 * @param {string} dir - Directory to scan
 * @returns {Array<string>} - Array of image file paths
 */
function getImageFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      // Recursively scan subdirectories, but skip node_modules
      if (file !== 'node_modules') {
        results = results.concat(getImageFiles(filePath));
      }
    } else {
      // Check if file is an image
      const ext = path.extname(file).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        results.push(filePath);
      }
    }
  });
  
  return results;
}

/**
 * Optimizes all images in the project
 */
async function optimizeAllImages() {
  try {
    // Directories to scan for images
    const dirsToScan = [
      path.join(__dirname, '../public/Images'),
      path.join(__dirname, '../public/uploads'),
      path.join(__dirname, '../Images')
    ];
    
    let totalSavings = 0;
    let totalFiles = 0;
    let successfulOptimizations = 0;
    
    for (const dir of dirsToScan) {
      if (fs.existsSync(dir)) {
        console.log(`Scanning ${dir} for images...`);
        const imageFiles = getImageFiles(dir);
        totalFiles += imageFiles.length;
        
        console.log(`Found ${imageFiles.length} images in ${dir}`);
        
        // Process each image
        for (const imagePath of imageFiles) {
          // Create optimized version in same directory
          const parsedPath = path.parse(imagePath);
          const optimizedPath = path.join(
            parsedPath.dir,
            `${parsedPath.name}_optimized${parsedPath.ext}`
          );
          
          // Skip if already optimized
          if (imagePath.includes('_optimized')) {
            continue;
          }
          
          // Optimize the image
          console.log(`Optimizing: ${imagePath}`);
          const result = await require('./imageOptimizer').optimizeImage(
            imagePath,
            optimizedPath,
            {
              quality: 80,
              format: parsedPath.ext.replace('.', ''),
            }
          );
          
          if (result.success) {
            successfulOptimizations++;
            totalSavings += result.savings;
            
            // Replace original with optimized version if optimization saved space
            if (result.savings > 0) {
              fs.unlinkSync(imagePath);
              fs.renameSync(optimizedPath, imagePath);
              console.log(`✓ Saved ${(result.savings / 1024).toFixed(2)} KB (${result.savingsPercentage}%) for ${path.basename(imagePath)}`);
            } else {
              // Remove optimized version if it's larger than original
              fs.unlinkSync(optimizedPath);
              console.log(`✗ No savings for ${path.basename(imagePath)}, keeping original`);
            }
          }
        }
      }
    }
    
    console.log('\nOptimization complete!');
    console.log(`Processed ${totalFiles} images`);
    console.log(`Successfully optimized ${successfulOptimizations} images`);
    console.log(`Total space saved: ${(totalSavings / (1024 * 1024)).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('Error optimizing images:', error);
  }
}

// Run the optimization
optimizeAllImages();
