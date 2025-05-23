const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Optimizes an image file using sharp
 * @param {string} inputPath - Path to the input image file
 * @param {string} outputPath - Path where the optimized image will be saved
 * @param {Object} options - Optimization options
 * @returns {Promise<Object>} - Information about the optimized image
 */
async function optimizeImage(inputPath, outputPath, options = {}) {
  const {
    width = null,
    height = null,
    quality = 80,
    format = 'webp',
  } = options;

  try {
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get original file size
    const originalSize = fs.statSync(inputPath).size;

    // Process the image
    let sharpInstance = sharp(inputPath);

    // Resize if dimensions are provided
    if (width || height) {
      sharpInstance = sharpInstance.resize({
        width,
        height,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to specified format
    if (format === 'webp') {
      sharpInstance = sharpInstance.webp({ quality });
    } else if (format === 'jpeg' || format === 'jpg') {
      sharpInstance = sharpInstance.jpeg({ quality });
    } else if (format === 'png') {
      sharpInstance = sharpInstance.png({ quality });
    } else if (format === 'avif') {
      sharpInstance = sharpInstance.avif({ quality });
    }

    // Save the optimized image
    await sharpInstance.toFile(outputPath);

    // Get optimized file size
    const optimizedSize = fs.statSync(outputPath).size;
    const savings = originalSize - optimizedSize;
    const savingsPercentage = (savings / originalSize) * 100;

    return {
      success: true,
      originalPath: inputPath,
      optimizedPath: outputPath,
      originalSize,
      optimizedSize,
      savings,
      savingsPercentage: savingsPercentage.toFixed(2),
    };
  } catch (error) {
    console.error('Image optimization error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Batch optimize multiple images in a directory
 * @param {string} inputDir - Directory containing images to optimize
 * @param {string} outputDir - Directory where optimized images will be saved
 * @param {Object} options - Optimization options
 * @returns {Promise<Array>} - Results of optimization for each image
 */
async function batchOptimizeImages(inputDir, outputDir, options = {}) {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get all files in the input directory
    const files = fs.readdirSync(inputDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
    });

    const results = [];

    // Process each image
    for (const file of imageFiles) {
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(outputDir, `${path.parse(file).name}.${options.format || 'webp'}`);
      
      const result = await optimizeImage(inputPath, outputPath, options);
      results.push({
        file,
        ...result,
      });
    }

    return results;
  } catch (error) {
    console.error('Batch optimization error:', error);
    return [{
      success: false,
      error: error.message,
    }];
  }
}

module.exports = {
  optimizeImage,
  batchOptimizeImages,
};
