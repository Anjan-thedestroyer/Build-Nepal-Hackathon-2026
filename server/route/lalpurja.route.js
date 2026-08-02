import { Router } from "express";
import multer from "multer";
import path from "path";
import {
    registerLalpurja,
    getLalpurjaByLandId,
    transferLalpurja,
    toggleLandFreeze,
    getLandByWard,
    updateBookValue,
    updateLandType,
} from "../controller/lalpurja.controller.js";
import auth from "../middleware/auth.js";
import officer from "../middleware/officer.js";



const lalpurjaRouter = Router();
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/lalpurjas/");
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `lalpurja-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});



const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf" || file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF and image files are allowed."), false);
        }
    },
});

lalpurjaRouter.get("/ward/:wardNo", getLandByWard);
lalpurjaRouter.get("/get", getLalpurjaByLandId);

lalpurjaRouter.post(
    "/register",
    auth,
    officer,
    upload.single("lalpurjaDocument"),
    registerLalpurja
);
lalpurjaRouter.post(
    "/transfer",
    auth,
    officer,
    transferLalpurja
);
lalpurjaRouter.patch(
    "/freeze",
    auth,
    officer,
    toggleLandFreeze
);
lalpurjaRouter.patch("/book-value", auth, officer, updateBookValue);
lalpurjaRouter.patch("/land-type", auth, officer, updateLandType);

export default lalpurjaRouter;

