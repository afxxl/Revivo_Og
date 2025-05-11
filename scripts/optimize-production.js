/**
 * Production Optimization Script
 * 
 * This script runs all optimization tasks to prepare the site for production deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create directories if they don't exist
const scriptsDir = path.join(__dirname);
const logsDir = path.join(__dirname, '../logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

console.log('========================================');
console.log('🚀 STARTING PRODUCTION OPTIMIZATION');
console.log('========================================');

// Helper function to run a script and log output
function runScript(scriptName, description) {
  console.log(`\n📋 ${description}...`);
  
  try {
    const scriptPath = path.join(scriptsDir, scriptName);
    const logFile = path.join(logsDir, `${scriptName.replace('.js', '')}.log`);
    
    console.log(`Running ${scriptPath}`);
    console.log(`Logging to ${logFile}`);
    
    // Run the script and capture output
    const output = execSync(`node "${scriptPath}" | tee "${logFile}"`, { 
      stdio: 'inherit',
      encoding: 'utf-8'
    });
    
    console.log(`✅ ${description} completed successfully!`);
    return true;
  } catch (error) {
    console.error(`❌ Error running ${description}:`, error.message);
    return false;
  }
}

// Install required dependencies
console.log('\n📦 Installing required dependencies...');
try {
  execSync('npm install compression sharp terser clean-css --save', { 
    stdio: 'inherit' 
  });
  console.log('✅ Dependencies installed successfully!');
} catch (error) {
  console.error('❌ Error installing dependencies:', error.message);
}

// Run optimization scripts
const optimizations = [
  { script: 'optimize-images.js', description: 'Optimizing images' },
  { script: 'optimize-assets.js', description: 'Optimizing CSS and JavaScript assets' }
];

let successCount = 0;
for (const opt of optimizations) {
  const success = runScript(opt.script, opt.description);
  if (success) successCount++;
}

// Final report
console.log('\n========================================');
console.log(`🏁 OPTIMIZATION COMPLETE: ${successCount}/${optimizations.length} tasks successful`);
console.log('========================================');

// Provide deployment instructions
console.log('\n📝 NEXT STEPS:');
console.log('1. Restart your application to apply the changes:');
console.log('   pm2 restart all');
console.log('2. Verify your site performance using tools like:');
console.log('   - Google PageSpeed Insights (https://pagespeed.web.dev/)');
console.log('   - GTmetrix (https://gtmetrix.com/)');
console.log('3. Consider using a CDN for even better performance');
console.log('\nOptimization logs are available in the logs directory');
