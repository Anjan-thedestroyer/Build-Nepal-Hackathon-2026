import fs from "fs";
import crypto from "crypto";

export const generateFileHash = (filePath) => {
 if (!filePath || !fs.existsSync(filePath)) {
  throw new Error(`File Hash Error: File not found at path "${filePath}"`);
 }
 

 const fileBuffer = fs.readFileSync(filePath);

 const hash = crypto
  .createHash("sha256")
  .update(fileBuffer)
  .digest("hex");

 return hash;
};


export const generateTextHash = (text) => {
 if (!text) return null;
 return crypto
  .createHash("sha256")
  .update(text.toString().trim())
  .digest("hex");
};