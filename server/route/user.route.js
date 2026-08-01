import { Router } from "express";
import multer from "multer";
import path from "path";
import {
    registerUser,
    loginUser,
    logoutUser,
    getUserProfile,
    getAllUsers,
} from "../controller/user.controller.js";
import auth from "../middleware/auth.js";
import officer from "../middleware/officer.js";

const userRouter = Router();
userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/logout", logoutUser);
userRouter.get("/user-data", auth, getUserProfile);
userRouter.get("/all-users", auth, officer, getAllUsers);



export default userRouter;

