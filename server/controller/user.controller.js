import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserModel } from "../model/user.model.js";
import { CitizenshipModel } from "../model/citizenship.model.js";
import { LalpurjaModel } from "../model/lalpurja.model.js";

const JWT_SECRET = process.env.JWT_SECRET;

export const registerUser = async (req, res) => {
    let createdUserId = null;
    if (!req.body) {
    return res.status(400).json({
        success: false,
        message: "Request body is missing.",
    });
    }

    const { fullName, email, password, citizenshipNo, issueDistrict } = req.body;
  try {

    const existingUser = await UserModel.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A user with this email address already exists.",
      });
    }

    const existingCitizenship = await CitizenshipModel.findOne({
      citizenshipNo,
    });

    if (existingCitizenship) {
      return res.status(400).json({
        success: false,
        message: "This citizenship number is already registered.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new UserModel({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "CITIZEN",
    });

    createdUserId = newUser._id;

    const newCitizenship = new CitizenshipModel({
      citizenshipNo,
      issueDistrict,
      user: newUser._id,
    });

    newUser.citizenship = newCitizenship._id;

    await newCitizenship.save();
    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      token,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    if (createdUserId) {
      await UserModel.findByIdAndDelete(createdUserId);
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
* Login User
*/
export const loginUser = async (req, res) => {
 try {
  const { email, password } = req.body;

  if (!email || !password) {
   return res.status(400).json({
    success: false,
    message: "Email and password are required.",
   });
  }

  // Find user by email
  const user = await UserModel.findOne({ email: email.toLowerCase() }).populate(
   "citizenship",
   "citizenshipNo citizenshipHash"
  );

  if (!user) {
   return res
    .status(401)
    .json({ success: false, message: "Invalid email or password." });
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
   return res
    .status(401)
    .json({ success: false, message: "Invalid email or password." });
  }

  // Generate JWT Token
  const token = jwt.sign(
   { id: user._id, role: user.role },
   JWT_SECRET,
   { expiresIn: "7d" }
  );

  // Set cookie for browser sessions
  res.cookie("token", token, {
   httpOnly: true,
   secure: process.env.NODE_ENV === "production",
   sameSite: "strict",
   maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(200).json({
   success: true,
   message: "Login successful.",
   token,
   user: {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    citizenship: user.citizenship || null,
   },
  });
 } catch (error) {
  return res.status(500).json({ success: false, message: error.message });
 }
};


export const logoutUser = (req, res) => {
 try {
  res.clearCookie("token", {
   httpOnly: true,
   secure: process.env.NODE_ENV === "production",
   sameSite: "strict",
  });

  return res.status(200).json({
   success: true,
   message: "Logged out successfully.",
  });
 } catch (error) {
  return res.status(500).json({ success: false, message: error.message });
 }
};


export const getUserProfile = async (req, res) => {
 try {
  const userId = req.user._id || req.user.id;

  const user = await UserModel.findById(userId)
   .select("-password")
   .populate("citizenship")
   .populate({
    path: "lalpurjas",
    populate: {
     path: "owners",
     select: "fullName email",
    },
   });

  if (!user) {
   return res
    .status(404)
    .json({ success: false, message: "User not found." });
  }

  return res.status(200).json({
   success: true,
   user,
  });
 } catch (error) {
  return res.status(500).json({ success: false, message: error.message });
 }
};


export const getAllUsers = async (req, res) => {
 try {
  const users = await UserModel.find()
   .select("-password")
   .populate("citizenship");

  return res.status(200).json({
   success: true,
   count: users.length,
   users,
  });
 } catch (error) {
  return res.status(500).json({ success: false, message: error.message });
 }
};