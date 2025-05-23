const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

/**
 * Minifies JavaScript files
 * @param {string} inputPath - Path to input JS file
 * @param {string} outputPath - Path to output minified JS file
 * @returns {Promise<Object>} - Result of minification
 */
async function minifyJs(inputPath, outputPath) {
  try {
    const code = fs.readFileSync(inputPath, 'utf8');
    const originalSize = Buffer.byteLength(code, 'utf8');
    
    const result = await minify(code, {
      compress: {
        drop_console: false,
        drop_debugger: true
      },
      mangle: true
    });
    
    if (!result.code) {
      throw new Error('Minification failed');
    }
    
    fs.writeFileSync(outputPath, result.code);
    const minifiedSize = Buffer.byteLength(result.code, 'utf8');
    const savings = originalSize - minifiedSize;
    
    return {
      success: true,
      originalSize,
      minifiedSize,
      savings,
      savingsPercentage: ((savings / originalSize) * 100).toFixed(2)
    };
  } catch (error) {
    console.error(`Error minifying JS file ${inputPath}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Minifies CSS files
 * @param {string} inputPath - Path to input CSS file
 * @param {string} outputPath - Path to output minified CSS file
 * @returns {Object} - Result of minification
 */
function minifyCss(inputPath, outputPath) {
  try {
    const code = fs.readFileSync(inputPath, 'utf8');
    const originalSize = Buffer.byteLength(code, 'utf8');
    
    const result = new CleanCSS({
      level: 2,
      compatibility: '*'
    }).minify(code);
    
    if (result.errors.length > 0) {
      throw new Error(result.errors.join(', '));
    }
    
    fs.writeFileSync(outputPath, result.styles);
    const minifiedSize = Buffer.byteLength(result.styles, 'utf8');
    const savings = originalSize - minifiedSize;
    
    return {
      success: true,
      originalSize,
      minifiedSize,
      savings,
      savingsPercentage: ((savings / originalSize) * 100).toFixed(2)
    };
  } catch (error) {
    console.error(`Error minifying CSS file ${inputPath}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Processes all JS and CSS files in a directory
 * @param {string} directory - Directory to process
 * @param {boolean} recursive - Whether to process subdirectories
 * @returns {Object} - Results of minification
 */
async function minifyAssets(directory, recursive = true) {
  try {
    const stats = {
      js: { count: 0, totalSavings: 0 },
      css: { count: 0, totalSavings: 0 }
    };
    
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && recursive) {
        // Skip node_modules and minified directories
        if (file !== 'node_modules' && !file.includes('min')) {
          const subResults = await minifyAssets(filePath, recursive);
          stats.js.count += subResults.js.count;
          stats.js.totalSavings += subResults.js.totalSavings;
          stats.css.count += subResults.css.count;
          stats.css.totalSavings += subResults.css.totalSavings;
        }
      } else {
        const ext = path.extname(file).toLowerCase();
        
        // Skip already minified files
        if (file.includes('.min.')) continue;
        
        if (ext === '.js') {
          const outputPath = path.join(
            path.dirname(filePath),
            `${path.basename(filePath, '.js')}.min.js`
          );
          
          const result = await minifyJs(filePath, outputPath);
          if (result.success) {
            stats.js.count++;
            stats.js.totalSavings += result.savings;
            console.log(`✓ Minified JS: ${file} - Saved ${(result.savings / 1024).toFixed(2)} KB (${result.savingsPercentage}%)`);
          }
        } else if (ext === '.css') {
          const outputPath = path.join(
            path.dirname(filePath),
            `${path.basename(filePath, '.css')}.min.css`
          );
          
          const result = minifyCss(filePath, outputPath);
          if (result.success) {
            stats.css.count++;
            stats.css.totalSavings += result.savings;
            console.log(`✓ Minified CSS: ${file} - Saved ${(result.savings / 1024).toFixed(2)} KB (${result.savingsPercentage}%)`);
          }
        }
      }
    }
    
    return stats;
  } catch (error) {
    console.error('Error minifying assets:', error);
    return {
      js: { count: 0, totalSavings: 0 },
      css: { count: 0, totalSavings: 0 }
    };
  }
}

module.exports = {
  minifyJs,
  minifyCss,
  minifyAssets
};
