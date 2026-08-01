const officer = (req, res, next) => {
 if (!req.user) {
  return res.status(401).json({
   success: false,
   message: "Unauthorized. Authentication required ",
  });
 }

 // Check for Malpot Admin role
 if (req.user.role === "MALPOT" ||req.user.role === "ADMIN" ) {
  return next();
 }

 return res.status(403).json({
  success: false,
  message: "Forbidden: Only Officials can perform this action.",
 });
};

export default officer;