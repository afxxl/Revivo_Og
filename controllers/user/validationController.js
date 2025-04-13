const validateProfileUpdate = (req, res, next) => {
  const { name, email, phone } = req.body;
  const errors = [];

  if (!name || name.length < 2 || name.length > 50) {
    errors.push("Name must be between 2-50 characters");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Please provide a valid email");
  }

  if (!phone) {
    errors.push("Phone number is required");
  } else if (!/^[0-9]{10,15}$/.test(phone)) {
    errors.push("Please provide a valid phone number (10-15 digits)");
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(", ") });
  }

  next();
};

const validateAddress = (req, res, next) => {
  if (req.body.updateType === "setDefault") {
    return next();
  }

  const { name, address, city, state, pincode, phone } = req.body;
  const errors = [];

  if (!name || name.length < 2 || name.length > 50) {
    errors.push("Name must be between 2-50 characters");
  }

  if (!address || address.length < 10) {
    errors.push("Address must be at least 10 characters");
  }

  if (!city) {
    errors.push("City is required");
  }

  if (!state) {
    errors.push("State is required");
  }

  if (!pincode || !/^\d{6}$/.test(pincode)) {
    errors.push("Pincode must be 6 digits");
  }

  if (!phone || !/^[0-9]{10}$/.test(phone)) {
    errors.push("Phone must be 10 digits");
  }

  if (req.body.altPhone && !/^[0-9]{10}$/.test(req.body.altPhone)) {
    errors.push("Alternate phone must be 10 digits if provided");
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(", ") });
  }

  next();
};

const validatePasswordChange = (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const errors = [];

  if (!currentPassword) {
    errors.push("Current password is required");
  }

  if (!newPassword) {
    errors.push("New password is required");
  } else if (newPassword.length < 8) {
    errors.push("Password must be at least 8 characters");
  } else if (!/(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9])/.test(newPassword)) {
    errors.push("Password must contain letters, numbers and symbols");
  }

  if (newPassword !== confirmPassword) {
    errors.push("Passwords do not match");
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(", ") });
  }

  next();
};

module.exports = {
  validateProfileUpdate,
  validateAddress,
  validatePasswordChange,
};
