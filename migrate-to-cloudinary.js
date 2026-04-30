/**
 * migrate-to-cloudinary.js
 *
 * One-time script that:
 * 1. Scans all Products, Brands, Categories, and Users in MongoDB
 * 2. For every image that is still a LOCAL path (starts with /uploads/ or /Images/)
 *    it uploads the physical file to Cloudinary
 * 3. Replaces the local path in the DB with the Cloudinary HTTPS URL
 *
 * Run once from the project root:
 *   node migrate-to-cloudinary.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const fs = require("fs");

// ── Models ────────────────────────────────────────────────────────────────────
const Product  = require("./models/productSchema");
const Brand    = require("./models/brandSchema");
const Category = require("./models/categorySchema");
const User     = require("./models/userSchema");

// ── Cloudinary config ─────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the value looks like a local path (not a URL) */
const isLocalPath = (val) =>
  typeof val === "string" &&
  !val.startsWith("http://") &&
  !val.startsWith("https://") &&
  val.trim() !== "";

/** Resolve a stored relative path to an absolute filesystem path */
const resolveLocalPath = (storedPath) => {
  // storedPath is like:  /uploads/product-images/abc.jpg
  //                   or /Images/default-profile.jpg
  return path.join(__dirname, "public", storedPath);
};

/**
 * Upload a single local file to Cloudinary.
 * Returns the secure_url on success, or null if the file doesn't exist.
 */
const uploadToCloudinary = async (localFilePath, folder) => {
  if (!fs.existsSync(localFilePath)) {
    console.warn(`  ⚠️  File not found, skipping: ${localFilePath}`);
    return null;
  }
  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: `revivo/${folder}`,
      resource_type: "image",
    });
    return result.secure_url;
  } catch (err) {
    console.error(`  ❌  Cloudinary upload failed for ${localFilePath}:`, err.message);
    return null;
  }
};

// ── Migration functions ───────────────────────────────────────────────────────

const migrateProducts = async () => {
  console.log("\n📦  Migrating Products...");
  const products = await Product.find({});
  let updated = 0;

  for (const product of products) {
    let changed = false;
    const newImages = [];

    for (const imgPath of product.productImage) {
      if (isLocalPath(imgPath)) {
        const localFile = resolveLocalPath(imgPath);
        console.log(`  ⬆️  Uploading: ${imgPath}`);
        const url = await uploadToCloudinary(localFile, "product-images");
        newImages.push(url || imgPath); // keep old path if upload fails
        if (url) changed = true;
      } else {
        newImages.push(imgPath); // already a Cloudinary URL
      }
    }

    if (changed) {
      await Product.findByIdAndUpdate(product._id, { productImage: newImages });
      updated++;
      console.log(`  ✅  Product "${product.productName}" updated`);
    }
  }

  console.log(`  Done. ${updated}/${products.length} products updated.`);
};

const migrateBrands = async () => {
  console.log("\n🏷️   Migrating Brands...");
  const brands = await Brand.find({});
  let updated = 0;

  for (const brand of brands) {
    let changed = false;
    const newImages = [];

    for (const imgPath of brand.brandImage) {
      if (isLocalPath(imgPath)) {
        const localFile = resolveLocalPath(imgPath);
        console.log(`  ⬆️  Uploading: ${imgPath}`);
        const url = await uploadToCloudinary(localFile, "brand-images");
        newImages.push(url || imgPath);
        if (url) changed = true;
      } else {
        newImages.push(imgPath);
      }
    }

    if (changed) {
      await Brand.findByIdAndUpdate(brand._id, { brandImage: newImages });
      updated++;
      console.log(`  ✅  Brand "${brand.brandName}" updated`);
    }
  }

  console.log(`  Done. ${updated}/${brands.length} brands updated.`);
};

const migrateCategories = async () => {
  console.log("\n🗂️   Migrating Categories...");
  const categories = await Category.find({});
  let updated = 0;

  for (const cat of categories) {
    if (isLocalPath(cat.image)) {
      const localFile = resolveLocalPath(cat.image);
      console.log(`  ⬆️  Uploading: ${cat.image}`);
      const url = await uploadToCloudinary(localFile, "category-images");
      if (url) {
        await Category.findByIdAndUpdate(cat._id, { image: url });
        updated++;
        console.log(`  ✅  Category "${cat.name}" updated`);
      }
    }
  }

  console.log(`  Done. ${updated}/${categories.length} categories updated.`);
};

const migrateUserProfiles = async () => {
  console.log("\n👤  Migrating User Profile Images...");
  // Only migrate users who have a custom profile image (not the default)
  const users = await User.find({
    profileImage: { $exists: true, $ne: "/Images/default-profile.jpg" },
  });
  let updated = 0;

  for (const user of users) {
    if (isLocalPath(user.profileImage)) {
      const localFile = resolveLocalPath(user.profileImage);
      console.log(`  ⬆️  Uploading: ${user.profileImage} (${user.email})`);
      const url = await uploadToCloudinary(localFile, "profile-images");
      if (url) {
        await User.findByIdAndUpdate(user._id, { profileImage: url });
        updated++;
        console.log(`  ✅  User "${user.email}" profile updated`);
      }
    }
  }

  console.log(`  Done. ${updated}/${users.length} user profiles updated.`);
};

// ── Main ──────────────────────────────────────────────────────────────────────

const run = async () => {
  console.log("🚀  Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URL);
  console.log("✅  Connected!\n");
  console.log("☁️   Starting Cloudinary migration...");
  console.log("────────────────────────────────────────");

  await migrateProducts();
  await migrateBrands();
  await migrateCategories();
  await migrateUserProfiles();

  console.log("\n────────────────────────────────────────");
  console.log("🎉  Migration complete! All images are now on Cloudinary.");
  console.log("    You can safely deploy to Render/Railway now.");

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("💥  Migration failed:", err);
  process.exit(1);
});
