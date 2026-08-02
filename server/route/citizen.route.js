
import { Router } from "express";
import multer from "multer";
import path from "path";
import {
  getMyLands,
  verifyLalpurjaPdf,
  getLandByCitizenshipNo,
} from "../controller/citizen.controller.js";
import  auth  from "../middleware/auth.js";
import officer from "../middleware/officer.js";
const citizenRouter = Router()
const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    cb(null, "uploads/temp/");

  },

  filename: (req, file, cb) => {

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, `scan-${uniqueSuffix}${path.extname(file.originalname)}`);

  },

});



const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed for document scanning."), false);
    }
  },
});




citizenRouter.get("/my-lands", auth, getMyLands);
citizenRouter.post("/verify-pdf", auth, upload.single("pdf"), verifyLalpurjaPdf);
citizenRouter.post("/land/citizenship",auth,officer, getLandByCitizenshipNo);



export default citizenRouter;