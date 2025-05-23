const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { optimizeImage } = require('../utils/imageOptimizer');

/**
 * Creates an optimized image upload middleware
 * @param {Object} options - Configuration options
 * @returns {Function} - Express middleware
 */
function createOptimizedUploader(options = {}) {
  const {
    destination = 'public/uploads',
    fileSize = 5 * 1024 * 1024, // 5MB default
    quality = 80,
    format = 'webp',
    width = null,
    height = null,
  } = options;
  
  // Create destination directory if it doesn't exist
  const destPath = path.resolve(process.cwd(), destination);
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true });
  }
  
  // Configure storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destination);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  });
  
  // Configure file filter
  const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'), false);
    }
  };
  
  // Create multer uploader
  const upload = multer({
    storage,
    limits: { fileSize },
    fileFilter,
  });
  
  // Return middleware that processes the upload and then optimizes the image
  return function(fieldName) {
    return [
      upload.single(fieldName),
      async (req, res, next) => {
        try {
          // If no file was uploaded, continue
          if (!req.file) {
            return next();
          }
          
          const inputPath = req.file.path;
          const fileInfo = path.parse(inputPath);
          const outputPath = path.join(
            fileInfo.dir,
            `${fileInfo.name}.${format}`
          );
          
          // Optimize the uploaded image
          const result = await optimizeImage(inputPath, outputPath, {
            quality,
            format,
            width,
            height,
          });
          
          if (result.success) {
            // Remove original file if format is different
            if (inputPath !== outputPath) {
              fs.unlinkSync(inputPath);
            }
            
            // Update req.file with optimized file info
            req.file.path = outputPath;
            req.file.filename = path.basename(outputPath);
            req.file.mimetype = `image/${format}`;
            req.file.size = result.optimizedSize;
            req.file.optimizationResult = result;
          }
          
          next();
        } catch (error) {
          next(error);
        }
      }
    ];
  };
}

module.exports = createOptimizedUploader;
