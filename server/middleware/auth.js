import jwt from "jsonwebtoken";
import { UserModel } from "../model/user.model.js";

const JWT_SECRET = process.env.JWT_SECRET ;

const auth = async (req, res, next) => {
 try {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
   token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
   token = req.cookies.token;
  }

  if (!token) {
   return res.status(401).json({
    success: false,
    message: "Access denied. No token provided.",
   });
  }

  // Verify token with matching secret
  const decoded = jwt.verify(token, JWT_SECRET);

  const user = await UserModel.findById(decoded.id).select("-password");

  if (!user) {
   return res.status(401).json({
    success: false,
    message: "User not found or session expired.",
   });
  }

  // Attach user document to request object
  req.user = user;
  next();
 } catch (error) {
  return res.status(403).json({
   success: false,
   message: "Invalid or expired token.",
  });
 }
};

export default auth;