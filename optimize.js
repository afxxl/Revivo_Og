const { minifyAssets } = require("./utils/assetMinifier");
const path = require("path");
const fs = require("fs");

async function runOptimizations() {
  console.log("🚀 Starting project optimization...");

  console.log("\n📦 Minifying JS and CSS assets...");
  const publicDir = path.join(__dirname, "public");
  const assetResults = await minifyAssets(publicDir);

  console.log(`\n✅ Minified ${assetResults.js.count} JavaScript files`);
  console.log(
    `   Saved ${(assetResults.js.totalSavings / 1024).toFixed(2)} KB`,
  );

  console.log(`\n✅ Minified ${assetResults.css.count} CSS files`);
  console.log(
    `   Saved ${(assetResults.css.totalSavings / 1024).toFixed(2)} KB`,
  );

  console.log("\n📝 Updating EJS templates to use minified assets...");
  await updateEjsTemplates();

  console.log("\n🖼️  Optimizing images...");
  const optimizeScript = require("./utils/optimizeExistingImages");

  console.log("\n🎉 All optimization tasks completed!");
  console.log("\nNext steps:");
  console.log("1. Restart your application");
  console.log("2. Test your website to ensure everything works correctly");
  console.log("3. Deploy your optimized application");
}

async function updateEjsTemplates() {
  try {
    const viewsDir = path.join(__dirname, "views");
    updateTemplatesInDirectory(viewsDir);
    console.log("✅ EJS templates updated successfully");
  } catch (error) {
    console.error("Error updating EJS templates:", error);
  }
}

function updateTemplatesInDirectory(directory) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      updateTemplatesInDirectory(filePath);
    } else if (file.endsWith(".ejs")) {
      updateEjsFile(filePath);
    }
  }
}

function updateEjsFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    let modified = false;

    const cssRegex =
      /href=["\'](\/?(?:public\/)?css\/[^"\']+\.css)["\']\s*\/?>/gi;
    content = content.replace(cssRegex, (match, cssPath) => {
      if (cssPath.includes(".min.css")) return match;

      const newPath = cssPath.replace(/\.css$/, ".min.css");
      modified = true;
      return match.replace(cssPath, newPath);
    });

    const jsRegex = /src=["\'](\/?(?:public\/)?js\/[^"\']+\.js)["\']\s*>/gi;
    content = content.replace(jsRegex, (match, jsPath) => {
      if (jsPath.includes(".min.js")) return match;

      const newPath = jsPath.replace(/\.js$/, ".min.js");
      modified = true;
      return match.replace(jsPath, newPath);
    });

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`  Updated: ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`Error updating EJS file ${filePath}:`, error);
  }
}

runOptimizations();
