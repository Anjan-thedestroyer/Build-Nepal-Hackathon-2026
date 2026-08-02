import React, { useState } from "react";
import { getLalpurjaByLandId, toggleLandFreeze } from "../../../api/lalpurja.api";

export default function SearchTab({ loading, setLoading, setLoadingMessage, setLoadingProgress, notify }) {
  const [searchLandId, setSearchLandId] = useState("");
  const [landDetails, setLandDetails] = useState(null);

  const handleSearchByLandId = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoadingMessage("Fetching land record from blockchain...");
    setLoadingProgress(20);

    try {
      let progress = 20;
      const interval = setInterval(() => {
        progress += 15;
        if (progress <= 80) {
          setLoadingProgress(progress);
          if (progress === 50) setLoadingMessage("Querying blockchain network...");
          else if (progress === 70) setLoadingMessage("Retrieving on-chain data...");
        }
      }, 700);

      const res = await getLalpurjaByLandId(searchLandId);
      
      clearInterval(interval);
      setLoadingProgress(100);
      setLoadingMessage("✅ Record retrieved successfully!");
      
      setLandDetails(res.data?.land || null);
      notify("Land record fetched successfully.");
    } catch (err) {
      setLandDetails(null);
      notify(err.response?.data?.message || "Land record not found", "error");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingMessage("");
        setLoadingProgress(0);
      }, 1000);
    }
  };

  const handleToggleFreeze = async () => {
    if (!landDetails?.landId) return;
    const nextFreezeState = !landDetails.isFrozen;
    setLoading(true);
    setLoadingMessage(`Preparing to ${nextFreezeState ? "freeze" : "unfreeze"} land on blockchain...`);
    setLoadingProgress(15);

    try {
      let progress = 15;
      const interval = setInterval(() => {
        progress += 15;
        if (progress <= 85) {
          setLoadingProgress(progress);
          if (progress === 30) setLoadingMessage("Creating blockchain transaction...");
          else if (progress === 50) setLoadingMessage("Broadcasting to blockchain network...");
          else if (progress === 70) setLoadingMessage("Waiting for consensus...");
        }
      }, 900);

      await toggleLandFreeze(landDetails.landId, nextFreezeState);
      
      clearInterval(interval);
      setLoadingProgress(100);
      setLoadingMessage(`✅ Land ${nextFreezeState ? "frozen" : "unfrozen"} on blockchain!`);
      
      notify(`Land status updated to ${nextFreezeState ? "Frozen" : "Unfrozen"} on-chain!`);
      setLandDetails((prev) => ({ ...prev, isFrozen: nextFreezeState }));
    } catch (err) {
      notify(err.response?.data?.message || "Failed to update freeze status", "error");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingMessage("");
        setLoadingProgress(0);
      }, 1500);
    }
  };

  return (
    <div>
      <form onSubmit={handleSearchByLandId} className="search-form">
        <input
          type="text"
          placeholder="Enter Numeric Land ID..."
          required
          disabled={loading}
          className="search-input"
          value={searchLandId}
          onChange={(e) => setSearchLandId(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-primary btn-primary-auto"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {landDetails && (
        <div className="land-details">
          <h3 className="land-details-title">Land Record Details</h3>
          <div>
            <p className="land-details-text">
              <strong>Land ID:</strong> {landDetails.landId}
            </p>
            <p className="land-details-text">
              <strong>Lalpurja No:</strong> {landDetails.lalpurjaNo}
            </p>
            <p className="land-details-text">
              <strong>Kitta No:</strong> {landDetails.kittaNo || "N/A"}
            </p>
            <p className="land-details-text">
              <strong>Ward No:</strong> {landDetails.wardNo || "N/A"}
            </p>
            <p className="land-details-text">
              <strong>Area (Sq. M):</strong> {landDetails.areaInSqMeters}
            </p>
            <p className="land-details-text">
              <strong>Status:</strong>{" "}
              <span className={`status-badge ${landDetails.isFrozen ? "status-frozen" : "status-active"}`}>
                {landDetails.isFrozen ? "Frozen" : "Active"}
              </span>
            </p>
          </div>
          <button
            onClick={handleToggleFreeze}
            disabled={loading}
            className={landDetails.isFrozen ? "btn-success" : "btn-danger"}
            style={{ marginTop: "1rem" }}
          >
            {loading
              ? "Processing..."
              : landDetails.isFrozen
              ? "Unfreeze Land Record"
              : "Freeze Land Record"}
          </button>
        </div>
      )}
    </div>
  );
}