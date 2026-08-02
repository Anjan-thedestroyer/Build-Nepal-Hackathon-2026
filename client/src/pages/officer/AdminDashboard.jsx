import React, { useState } from "react";
import {
  getLalpurjaByLandId,
  getLandByWard,
  registerLalpurja,
  transferLalpurja,
  toggleLandFreeze,
  updateBookValue,
  updateLandType,
} from "../../api/lalpurja.api";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("register");
  const [message, setMessage] = useState({ type: "", text: "" });
  
  // Loading state to manage slow blockchain/OCR responses
  const [loading, setLoading] = useState(false);

  // Form States
  const [registerForm, setRegisterForm] = useState({
    citizenshipNo: "",
    lalpurjaDocument: null,
  });

  const [searchLandId, setSearchLandId] = useState("");
  const [landDetails, setLandDetails] = useState(null);

  const [wardSearch, setWardSearch] = useState({ wardNo: "", district: "", municipality: "" });
  const [wardLands, setWardLands] = useState([]);

  const [transferForm, setTransferForm] = useState({
    landId: "",
    newOwnerId: "",
    price: "",
  });

  const [valuationForm, setValuationForm] = useState({
    landId: "",
    currentBookValue: "",
    taxRate: "",
  });

  const [categoryForm, setCategoryForm] = useState({
    id: "",
    newLandType: "Residential",
    reason: "",
  });

  const notify = (text, type = "success") => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  // Register Handler
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "info", text: "Processing document and interacting with blockchain... Please wait." });

    try {
      const res = await registerLalpurja(registerForm);
      notify(res.data?.message || "Lalpurja registered and recorded on-chain successfully!");
      setRegisterForm({
        citizenshipNo: "",
        lalpurjaDocument: null,
      });
      e.target.reset();
    } catch (err) {
      notify(err.response?.data?.message || "Registration failed. Check server logs.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Search Land ID Handler
  const handleSearchByLandId = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await getLalpurjaByLandId(searchLandId);
      setLandDetails(res.data?.land || null);
      notify("Land record fetched successfully.");
    } catch (err) {
      setLandDetails(null);
      notify(err.response?.data?.message || "Land record not found", "error");
    } finally {
      setLoading(false);
    }
  };

  // Search Ward Handler
  const handleSearchByWard = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await getLandByWard(wardSearch.wardNo, wardSearch.district, wardSearch.municipality);
      setWardLands(res.data?.lands || res.data || []);
      notify("Ward land records fetched successfully.");
    } catch (err) {
      setWardLands([]);
      notify(err.response?.data?.message || "Failed to fetch ward records", "error");
    } finally {
      setLoading(false);
    }
  };

  // Toggle Freeze Handler
  const handleToggleFreeze = async () => {
    if (!landDetails?.landId) return;
    const nextFreezeState = !landDetails.isFrozen;
    setLoading(true);
    setMessage({ type: "info", text: "Updating freeze state on blockchain..." });

    try {
      await toggleLandFreeze(landDetails.landId, nextFreezeState);
      notify(`Land status updated to ${nextFreezeState ? "Frozen" : "Unfrozen"} on-chain!`);
      setLandDetails((prev) => ({ ...prev, isFrozen: nextFreezeState }));
    } catch (err) {
      notify(err.response?.data?.message || "Failed to update freeze status", "error");
    } finally {
      setLoading(false);
    }
  };

  // Transfer Handler
  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "info", text: "Executing ownership transfer transaction..." });

    try {
      await transferLalpurja({
        landId: Number(transferForm.landId),
        newOwnerIds: [transferForm.newOwnerId],
        price: Number(transferForm.price),
      });
      notify("Ownership transfer confirmed on blockchain!");
      setTransferForm({ landId: "", newOwnerId: "", price: "" });
    } catch (err) {
      notify(err.response?.data?.message || "Transfer failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // Update Valuation Handler
  const handleValuationUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateBookValue(
        Number(valuationForm.landId),
        valuationForm.currentBookValue ? Number(valuationForm.currentBookValue) : undefined,
        valuationForm.taxRate ? Number(valuationForm.taxRate) : undefined
      );
      notify("Valuation updated successfully!");
      setValuationForm({ landId: "", currentBookValue: "", taxRate: "" });
    } catch (err) {
      notify(err.response?.data?.message || "Valuation update failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // Update Land Type Handler
  const handleCategoryUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateLandType(
        categoryForm.id,
        categoryForm.newLandType,
        categoryForm.reason
      );
      notify("Land classification updated successfully!");
      setCategoryForm({ id: "", newLandType: "Residential", reason: "" });
    } catch (err) {
      notify(err.response?.data?.message || "Category update failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-blue-900 text-white p-6">
          <h1 className="text-2xl font-bold">Lalpurja Officer Dashboard</h1>
          <p className="text-blue-200 text-sm">Land Registry & Blockchain Settlement System</p>
        </div>

        {/* Feedback Alert */}
        {message.text && (
          <div
            className={`p-4 text-sm font-semibold flex items-center justify-between ${
              message.type === "error"
                ? "bg-red-100 text-red-700 border-l-4 border-red-500"
                : message.type === "info"
                ? "bg-blue-100 text-blue-800 border-l-4 border-blue-500"
                : "bg-green-100 text-green-700 border-l-4 border-green-500"
            }`}
          >
            <span>{message.text}</span>
            {loading && (
              <svg className="animate-spin h-5 w-5 text-current ml-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b bg-gray-50 overflow-x-auto">
          {[
            { id: "register", label: "Register Land" },
            { id: "search", label: "Search & Freeze" },
            { id: "ward", label: "Search by Ward" },
            { id: "transfer", label: "Transfer Title" },
            { id: "update", label: "Book Value & Category" },
          ].map((tab) => (
            <button
              key={tab.id}
              disabled={loading}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-600 bg-white"
                  : "text-gray-600 hover:text-blue-600"
              } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* SIMPLIFIED REGISTER */}
          {activeTab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4 max-w-lg">
              <h2 className="text-xl font-semibold mb-2">Register New Lalpurja</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Citizenship No. *</label>
                <input
                  type="text"
                  required
                  disabled={loading}
                  placeholder="Enter Citizenship Number"
                  className="w-full mt-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                  value={registerForm.citizenshipNo}
                  onChange={(e) => setRegisterForm({ ...registerForm, citizenshipNo: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Lalpurja Document (PDF / Image) *</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  required
                  disabled={loading}
                  className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, lalpurjaDocument: e.target.files[0] })
                  }
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-2 disabled:bg-blue-400"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Executing Blockchain Transaction...</span>
                  </>
                ) : (
                  <span>Upload & Register</span>
                )}
              </button>
            </form>
          )}

          {/* SEARCH & FREEZE */}
          {activeTab === "search" && (
            <div className="space-y-6">
              <form onSubmit={handleSearchByLandId} className="flex gap-4 max-w-lg">
                <input
                  type="text"
                  placeholder="Enter Numeric Land ID..."
                  required
                  disabled={loading}
                  className="flex-1 p-2 border rounded-md disabled:bg-gray-100"
                  value={searchLandId}
                  onChange={(e) => setSearchLandId(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {loading ? "Searching..." : "Search"}
                </button>
              </form>

              {landDetails && (
                <div className="border rounded-md p-4 bg-gray-50 max-w-lg space-y-3">
                  <h3 className="font-bold text-lg text-gray-800">Land Record Details</h3>
                  <div className="text-sm space-y-1">
                    <p><span className="font-semibold">Land ID:</span> {landDetails.landId}</p>
                    <p><span className="font-semibold">Lalpurja No:</span> {landDetails.lalpurjaNo}</p>
                    <p><span className="font-semibold">Kitta No:</span> {landDetails.kittaNo || "N/A"}</p>
                    <p><span className="font-semibold">Ward No:</span> {landDetails.wardNo || "N/A"}</p>
                    <p><span className="font-semibold">Area (Sq. M):</span> {landDetails.areaInSqMeters}</p>
                    <p>
                      <span className="font-semibold">Status:</span>{" "}
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${landDetails.isFrozen ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800"}`}>
                        {landDetails.isFrozen ? "Frozen" : "Active"}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={handleToggleFreeze}
                    disabled={loading}
                    className={`mt-4 w-full py-2 text-white font-medium rounded-md transition-colors disabled:opacity-50 ${
                      landDetails.isFrozen ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {loading
                      ? "Updating On-Chain..."
                      : landDetails.isFrozen
                      ? "Unfreeze Land Record"
                      : "Freeze Land Record"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SEARCH BY WARD */}
          {activeTab === "ward" && (
            <div className="space-y-6 max-w-lg">
              <form onSubmit={handleSearchByWard} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ward No.*</label>
                  <input
                    type="number"
                    required
                    disabled={loading}
                    className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                    value={wardSearch.wardNo}
                    onChange={(e) => setWardSearch({ ...wardSearch, wardNo: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">District (Optional)</label>
                    <input
                      type="text"
                      disabled={loading}
                      className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                      value={wardSearch.district}
                      onChange={(e) => setWardSearch({ ...wardSearch, district: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Municipality (Optional)</label>
                    <input
                      type="text"
                      disabled={loading}
                      className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                      value={wardSearch.municipality}
                      onChange={(e) => setWardSearch({ ...wardSearch, municipality: e.target.value })}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium disabled:bg-blue-400"
                >
                  {loading ? "Fetching..." : "Search Ward Records"}
                </button>
              </form>

              {wardLands.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-800">Results ({wardLands.length})</h3>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {wardLands.map((land, idx) => (
                      <div key={land._id || idx} className="p-3 border rounded-md bg-gray-50 text-sm">
                        <p><span className="font-semibold">Land ID:</span> {land.landId}</p>
                        <p><span className="font-semibold">Kitta No:</span> {land.kittaNo}</p>
                        <p><span className="font-semibold">Area:</span> {land.areaInSqMeters} sq m</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TRANSFER */}
          {activeTab === "transfer" && (
            <form onSubmit={handleTransfer} className="space-y-4 max-w-lg">
              <h2 className="text-xl font-semibold mb-2">Transfer Title Ownership</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700">Land ID</label>
                <input
                  type="number"
                  required
                  disabled={loading}
                  className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                  value={transferForm.landId}
                  onChange={(e) => setTransferForm({ ...transferForm, landId: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">New Owner User ID (MongoDB Object ID)</label>
                <input
                  type="text"
                  required
                  disabled={loading}
                  placeholder="e.g. 60d5ec49f1b2c81128d4e5f1"
                  className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                  value={transferForm.newOwnerId}
                  onChange={(e) => setTransferForm({ ...transferForm, newOwnerId: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Transfer Price (NPR)</label>
                <input
                  type="number"
                  required
                  disabled={loading}
                  className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                  value={transferForm.price}
                  onChange={(e) => setTransferForm({ ...transferForm, price: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium disabled:bg-blue-400 flex items-center justify-center gap-2"
              >
                {loading ? "Broadcasting Transfer to Chain..." : "Execute Transfer"}
              </button>
            </form>
          )}

          {/* UPDATE VALUATION & CATEGORY */}
          {activeTab === "update" && (
            <div className="space-y-8 max-w-lg">
              <form onSubmit={handleValuationUpdate} className="space-y-4 border-b pb-6">
                <h2 className="text-lg font-semibold text-gray-800">Update Valuation & Tax</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Land ID</label>
                  <input
                    type="number"
                    required
                    disabled={loading}
                    className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                    value={valuationForm.landId}
                    onChange={(e) => setValuationForm({ ...valuationForm, landId: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">New Book Value</label>
                    <input
                      type="number"
                      disabled={loading}
                      className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                      value={valuationForm.currentBookValue}
                      onChange={(e) => setValuationForm({ ...valuationForm, currentBookValue: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tax Rate</label>
                    <input
                      type="number"
                      step="0.001"
                      disabled={loading}
                      className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                      value={valuationForm.taxRate}
                      onChange={(e) => setValuationForm({ ...valuationForm, taxRate: e.target.value })}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium disabled:bg-blue-400"
                >
                  {loading ? "Updating..." : "Update Book Value"}
                </button>
              </form>

              <form onSubmit={handleCategoryUpdate} className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Update Land Classification</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lalpurja Record Mongo ID (_id)</label>
                  <input
                    type="text"
                    required
                    disabled={loading}
                    placeholder="e.g. 60d5ec49f1b2c81128d4e5f1"
                    className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                    value={categoryForm.id}
                    onChange={(e) => setCategoryForm({ ...categoryForm, id: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">New Land Classification</label>
                  <select
                    disabled={loading}
                    className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                    value={categoryForm.newLandType}
                    onChange={(e) => setCategoryForm({ ...categoryForm, newLandType: e.target.value })}
                  >
                    <option value="Residential">Residential</option>
                    <option value="Agricultural">Agricultural</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Forest/Conservation">Forest/Conservation</option>
                    <option value="Public/Government">Public/Government</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Reason for Reclassification</label>
                  <input
                    type="text"
                    disabled={loading}
                    className="w-full mt-1 p-2 border rounded-md disabled:bg-gray-100"
                    value={categoryForm.reason}
                    onChange={(e) => setCategoryForm({ ...categoryForm, reason: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium disabled:bg-blue-400"
                >
                  {loading ? "Updating..." : "Update Classification"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}