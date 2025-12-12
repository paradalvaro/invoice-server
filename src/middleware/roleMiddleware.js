const roleMiddleware = (req, res, next) => {
  if (
    req.user &&
    (req.user.type === "Admin" || req.user.type === "SuperAdmin")
  ) {
    next();
  } else {
    res
      .status(403)
      .json({ message: "Access denied: Insufficient permissions" });
  }
};

module.exports = roleMiddleware;
