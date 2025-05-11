/**
 * Performance optimization middleware for Express.js
 * This middleware adds various performance-related headers and optimizations
 */

module.exports = function() {
  return function(req, res, next) {
    // Add Cache-Control headers for static assets
    if (req.url.match(/\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      // Cache static assets for 1 week
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    } else {
      // For HTML and other dynamic content, use no-cache for authenticated users
      // and a short cache for non-authenticated users
      if (req.user) {
        res.setHeader('Cache-Control', 'no-cache, private');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=60'); // 1 minute cache for anonymous users
      }
    }

    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Enable DNS prefetching
    res.setHeader('X-DNS-Prefetch-Control', 'on');
    
    // Set Keep-Alive header to reduce connection overhead
    res.setHeader('Connection', 'keep-alive');
    
    // Continue to the next middleware
    next();
  };
};
