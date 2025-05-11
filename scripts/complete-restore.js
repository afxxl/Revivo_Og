/**
 * Complete Restoration Script
 * 
 * This script completely reverts all optimizations and restores the website to its original state.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const rename = promisify(fs.rename);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const copyFile = promisify(fs.copyFile);
const exists = promisify(fs.exists);

// Directories to restore
const directories = [
  path.join(__dirname, '..'),
  path.join(__dirname, '../public'),
  path.join(__dirname, '../public/js'),
  path.join(__dirname, '../public/css'),
  path.join(__dirname, '../public/Images'),
  path.join(__dirname, '../views'),
  path.join(__dirname, '../middleware')
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
            await copyFile(file, originalFile);
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

// Function to restore header.js with cart functionality
async function restoreHeaderJS() {
  const headerJsPath = path.join(__dirname, '../public/js/header.js');
  
  // Create the directory if it doesn't exist
  const headerJsDir = path.dirname(headerJsPath);
  if (!fs.existsSync(headerJsDir)) {
    fs.mkdirSync(headerJsDir, { recursive: true });
  }
  
  try {
    // Check if we have a backup
    const backupPath = `${headerJsPath}.backup`;
    if (await exists(backupPath)) {
      await copyFile(backupPath, headerJsPath);
      console.log(`✓ Successfully restored header.js from backup`);
      return;
    }
    
    // If no backup, check for header-scripts.js
    const headerScriptsPath = path.join(__dirname, '../public/js/header-scripts.js');
    if (await exists(headerScriptsPath)) {
      await copyFile(headerScriptsPath, headerJsPath);
      console.log(`✓ Successfully restored header.js from header-scripts.js`);
      return;
    }
    
    // If neither exists, create a new header.js with cart functionality
    console.log('Creating new header.js with cart functionality...');
    
    // Read current content if it exists
    let currentContent = '';
    if (await exists(headerJsPath)) {
      currentContent = await readFile(headerJsPath, 'utf8');
    }
    
    // Check if cart functionality is missing
    if (!currentContent.includes('mobile-cart-count')) {
      // Add cart functionality
      const cartFunctionality = `
// Update cart count in both desktop and mobile views
function updateCartCount(count) {
  document.querySelectorAll('#cart-count, .mobile-cart-count').forEach(element => {
    element.textContent = count;
  });
}

// Add to cart functionality
async function addToCart(productId, quantity = 1) {
  try {
    const response = await fetch('/api/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId, quantity }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      updateCartCount(data.cartCount);
      showToast('Product added to cart!', 'success');
    } else {
      showToast(data.message || 'Failed to add product to cart', 'error');
    }
    
    return data;
  } catch (error) {
    console.error('Error adding to cart:', error);
    showToast('Failed to add product to cart', 'error');
    return { success: false };
  }
}

// Remove from cart functionality
async function removeFromCart(productId) {
  try {
    const response = await fetch('/api/cart/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      updateCartCount(data.cartCount);
      showToast('Product removed from cart', 'success');
    } else {
      showToast(data.message || 'Failed to remove product from cart', 'error');
    }
    
    return data;
  } catch (error) {
    console.error('Error removing from cart:', error);
    showToast('Failed to remove product from cart', 'error');
    return { success: false };
  }
}

// Update cart quantity
async function updateCartQuantity(productId, quantity) {
  try {
    const response = await fetch('/api/cart/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId, quantity }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      updateCartCount(data.cartCount);
    } else {
      showToast(data.message || 'Failed to update cart', 'error');
    }
    
    return data;
  } catch (error) {
    console.error('Error updating cart:', error);
    showToast('Failed to update cart', 'error');
    return { success: false };
  }
}`;
      
      // Append cart functionality to the end of the file, before the closing brackets
      if (currentContent.trim().endsWith('});')) {
        // Insert before the closing brackets
        const newContent = currentContent.replace(/}\);$/, `${cartFunctionality}\n});`);
        await writeFile(headerJsPath, newContent);
      } else {
        // Append to the end
        await writeFile(headerJsPath, currentContent + '\n' + cartFunctionality);
      }
      
      console.log(`✓ Successfully added cart functionality to header.js`);
    } else {
      console.log('Cart functionality already exists in header.js');
    }
  } catch (error) {
    console.error(`Error restoring header.js:`, error);
  }
}

// Function to remove performance middleware
async function removePerformanceMiddleware() {
  console.log('Removing performance middleware...');
  
  const appJsPath = path.join(__dirname, '../app.js');
  
  try {
    if (await exists(appJsPath)) {
      let content = await readFile(appJsPath, 'utf8');
      
      // Remove the import
      content = content.replace(/const performanceMiddleware = require\(['"]\.\/middleware\/performanceMiddleware['"]\);?\n?/g, '');
      
      // Remove the middleware usage
      content = content.replace(/app\.use\(performanceMiddleware\(\)\);?\n?/g, '');
      
      // Remove compression middleware
      content = content.replace(/app\.use\(compression\(\{[^}]*\}\)\);?\n?/g, '');
      
      // Update static files middleware to remove cache settings
      content = content.replace(/app\.use\(express\.static\(path\.join\(__dirname, "public"\), \{[^}]*\}\)\);/g, 
        'app.use(express.static(path.join(__dirname, "public")));');
      
      await writeFile(appJsPath, content);
      console.log(`✓ Successfully removed performance middleware from app.js`);
    }
  } catch (error) {
    console.error(`Error removing performance middleware:`, error);
  }
  
  // Try to remove the performance middleware file
  const middlewarePath = path.join(__dirname, '../middleware/performanceMiddleware.js');
  try {
    if (await exists(middlewarePath)) {
      await unlink(middlewarePath);
      console.log(`✓ Successfully removed performanceMiddleware.js file`);
    }
  } catch (error) {
    console.error(`Error removing performanceMiddleware.js:`, error);
  }
}

// Function to update header.ejs references
async function updateHeaderEjs() {
  console.log('Updating header.ejs references...');
  
  const headerEjsPath = path.join(__dirname, '../views/partials/user/header.ejs');
  
  try {
    if (await exists(headerEjsPath)) {
      let content = await readFile(headerEjsPath, 'utf8');
      
      // Replace minified CSS/JS references with original ones
      content = content.replace(/<link rel="preload" href="\/css\/header-styles\.min\.css" as="style">/g, 
        '<link rel="stylesheet" href="/css/styles.css">');
      
      content = content.replace(/<link rel="preload" href="\/js\/header-scripts\.min\.js" as="script">/g, 
        '<script src="/js/header.js" defer></script>');
      
      // Replace any other minified references
      content = content.replace(/\.min\.(js|css)/g, '.$1');
      
      await writeFile(headerEjsPath, content);
      console.log(`✓ Successfully updated header.ejs references`);
    }
  } catch (error) {
    console.error(`Error updating header.ejs:`, error);
  }
}

// Main function
async function completeRestore() {
  console.log('Starting complete restoration process...');
  
  await removePerformanceMiddleware();
  await restoreBackups();
  await removeMinifiedFiles();
  await restoreHeaderJS();
  await updateHeaderEjs();
  
  console.log('Complete restoration process finished!');
  console.log('Please restart your application to apply the changes.');
}

// Run the restoration
completeRestore().catch(console.error);
