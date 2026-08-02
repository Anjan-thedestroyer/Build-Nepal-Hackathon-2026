import API from "./axios";

// Public / Search: Get land details by Ward Number via GET path parameter
export const getLandByWard = (wardNo, district = "", municipality = "") => {
  return API.get(`/lalpurja/ward/${wardNo}`, {
    params: { district, municipality },
  });
};

// Search Lalpurja by Land ID
export const getLalpurjaByLandId = (landId) => {
  return API.get(`/lalpurja/get`, { params: { landId } });
};

// Register new Lalpurja (Officer only - file + citizenshipNo)
export const registerLalpurja = (data) => {
  const formData = new FormData();
  if (data.citizenshipNo) formData.append("citizenshipNo", data.citizenshipNo);
  if (data.lalpurjaDocument) formData.append("lalpurjaDocument", data.lalpurjaDocument);

  return API.post("/lalpurja/register", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

// Transfer Lalpurja Title (Officer only)
export const transferLalpurja = (transferDetails) => {
  return API.post("/lalpurja/transfer", transferDetails);
};

// Toggle Freeze / Unfreeze status (Officer only)
export const toggleLandFreeze = (landId, isFrozen) => {
  return API.patch("/lalpurja/freeze", { landId, isFrozen });
};

// Update Government Book Valuation (Officer only)
export const updateBookValue = (landId, currentBookValue, taxRate) => {
  return API.patch("/lalpurja/book-value", { landId, currentBookValue, taxRate });
};

// Update Land Classification Type (Officer only)
export const updateLandType = (id, newLandType, reason) => {
  return API.patch("/lalpurja/land-type", { id, newLandType, reason });
};