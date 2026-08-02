import API from "./axios";

// Get logged-in citizen's owned lands (Auth required)
export const getMyLands = () => {
  return API.get("/citizen/my-lands");
};

// Verify Lalpurja PDF scanner (Auth required, Multipart Form Data)
export const verifyLalpurjaPdf = (pdfFile) => {
  const formData = new FormData();
  formData.append("pdf", pdfFile);

  return API.post("/citizen/verify-pdf", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

// Search land by Citizenship Number (Public or Citizen lookup)
export const getLandByCitizenshipNo = (citizenshipNo) => {
  return API.post("/citizen/land/citizenship", { citizenshipNo });
};