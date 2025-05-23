/**
 * Middleware to set appropriate cache control headers
 * based on content type and request path
 */
function cacheControl() {
  return (req, res, next) => {
    // Skip for admin routes - we don't want to cache admin pages
    if (req.path.startsWith('/admin')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      return next();
    }

    // Set cache headers based on file type
    res.on('header', () => {
      const url = req.url.toLowerCase();
      
      // Handle static assets with long cache times
      if (
        url.match(/\.(jpg|jpeg|png|gif|webp|ico|svg|woff|woff2|ttf|eot)$/i) ||
        url.includes('/images/') ||
        url.includes('/uploads/')
      ) {
        // Cache images and fonts for 7 days
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      } 
      else if (url.match(/\.(css|js|min\.css|min\.js)$/i)) {
        // Cache CSS and JS for 1 day
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
      else if (url.match(/\.(html|htm)$/i)) {
        // Cache HTML for a short time
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
      else if (
        // API and dynamic content
        url.includes('/api/') ||
        url.includes('/cart') ||
        url.includes('/checkout') ||
        url.includes('/account')
      ) {
        // Don't cache API responses and dynamic content
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      }
      else {
        // Default for other content - moderate caching
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }

      // Add ETag support for all responses
      if (!res.getHeader('ETag')) {
        res.setHeader('ETag', `W/"${Date.now().toString(36)}"`);
      }
    });

    next();
  };
}

module.exports = cacheControl;
