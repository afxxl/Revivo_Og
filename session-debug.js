// Add this code at the top of your app.js file, right after your imports
// This will help debug session issues

const originalSessionMiddleware = session({
  name: "user.sid",
  secret: process.env.SESSION_SECRET + "_user",
  resave: true,
  saveUninitialized: true,
  store: userSessionStore,
  cookie: {
    // Force cookies to work in production by making them less strict
    secure: false, // Change to false to make cookies work without HTTPS
    httpOnly: true,
    maxAge: 72 * 60 * 60 * 1000,
    path: "/",
    sameSite: "lax", // Change to lax to make cookies work across domains
  },
});

// Wrap the session middleware to add debugging
const debugSessionMiddleware = (req, res, next) => {
  console.log('\n[SESSION DEBUG] Request URL:', req.url);
  console.log('[SESSION DEBUG] Cookies received:', req.headers.cookie);
  
  // Call the original session middleware
  originalSessionMiddleware(req, res, () => {
    console.log('[SESSION DEBUG] Session after middleware:', req.session.id, req.session.user ? 'User authenticated' : 'No user');
    
    // Add a hook to track when the session is saved
    const originalSave = req.session.save;
    req.session.save = function(cb) {
      console.log('[SESSION DEBUG] Session being saved:', req.session.id);
      return originalSave.call(this, function(err) {
        console.log('[SESSION DEBUG] Session save result:', err ? 'Error: ' + err.message : 'Success');
        if (cb) cb(err);
      });
    };
    
    next();
  });
};

// Replace your session middleware with this one
app.use(/^(?!\/admin).*/, debugSessionMiddleware);

// Add this middleware to debug response cookies
app.use((req, res, next) => {
  const originalEnd = res.end;
  res.end = function() {
    console.log('[SESSION DEBUG] Response cookies:', res.getHeader('set-cookie'));
    return originalEnd.apply(this, arguments);
  };
  next();
});
