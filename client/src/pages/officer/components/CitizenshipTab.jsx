import React, { useState } from "react";
import { getLandByCitizenshipNo } from "../../../api/citizen.api";

export default function CitizenshipTab({ loading, setLoading, setLoadingMessage, setLoadingProgress, notify }) {
  const [citizenshipSearch, setCitizenshipSearch] = useState("");
  const [citizenLands, setCitizenLands] = useState([]);
  const [citizenDetails, setCitizenDetails] = useState(null);

  const handleSearchByCitizenship = async (e) => {
    e.preventDefault();
    if (!citizenshipSearch.trim()) {
      notify("Please enter a citizenship number", "error");
      return;
    }
    
    setLoading(true);
    setLoadingMessage("Searching for citizen lands...");
    setLoadingProgress(20);
    setCitizenLands([]);
    setCitizenDetails(null);

    try {
      let progress = 20;
      const interval = setInterval(() => {
        progress += 20;
        if (progress <= 80) {
          setLoadingProgress(progress);
          if (progress === 40) setLoadingMessage("Verifying citizenship records...");
          else if (progress === 60) setLoadingMessage("Retrieving land ownership data...");
        }
      }, 700);

      const res = await getLandByCitizenshipNo(citizenshipSearch);
      const data = res.data || res;
      
      clearInterval(interval);
      setLoadingProgress(100);
      setLoadingMessage("✅ Citizen records retrieved!");
      
      if (data.lands && data.lands.length > 0) {
        setCitizenLands(data.lands);
        setCitizenDetails({
          name: data.ownerName || data.name || "N/A",
          citizenshipNo: citizenshipSearch,
          totalLands: data.lands.length,
        });
        notify(`Found ${data.lands.length} land record(s) for citizenship number.`);
      } else if (data.land) {
        setCitizenLands([data.land]);
        setCitizenDetails({
          name: data.land.owners?.[0]?.fullName || data.land.ownerName || "N/A",
          citizenshipNo: citizenshipSearch,
          totalLands: 1,
        });
        notify("Land record found for this citizenship number.");
      } else {
        setCitizenLands([]);
        setCitizenDetails(null);
        notify("No land records found for this citizenship number.", "error");
      }
    } catch (err) {
      setCitizenLands([]);
      setCitizenDetails(null);
      notify(err.response?.data?.message || "Failed to fetch citizen land records", "error");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingMessage("");
        setLoadingProgress(0);
      }, 1000);
    }
  };

  return (
    <div className="form-group">
      <form onSubmit={handleSearchByCitizenship}>
        <div className="form-mb">
          <label className="form-label">Citizenship Number *</label>
          <input
            type="text"
            required
            disabled={loading}
            placeholder="Enter Citizenship Number"
            className="form-input"
            value={citizenshipSearch}
            onChange={(e) => setCitizenshipSearch(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "Searching..." : "Search Citizen Lands"}
        </button>
      </form>

      {citizenDetails && (
        <div className="citizen-details">
          <h3 className="citizen-details-title">Citizen Information</h3>
          <div className="citizen-info-grid">
            <div className="citizen-info-item">
              <span className="citizen-info-label">Name:</span>
              <span className="citizen-info-value">{citizenDetails.name}</span>
            </div>
            <div className="citizen-info-item">
              <span className="citizen-info-label">Citizenship No:</span>
              <span className="citizen-info-value">{citizenDetails.citizenshipNo}</span>
            </div>
            <div className="citizen-info-item">
              <span className="citizen-info-label">Total Lands:</span>
              <span className="citizen-info-value">{citizenDetails.totalLands}</span>
            </div>
          </div>
        </div>
      )}

      {citizenLands.length > 0 && (
        <div className="citizen-lands-results">
          <h3 className="citizen-lands-title">Land Records ({citizenLands.length})</h3>
          <div className="citizen-lands-list">
            {citizenLands.map((land, idx) => (
              <div key={land._id || idx} className="citizen-land-item">
                <div className="citizen-land-header">
                  <span className="citizen-land-id">Land ID: {land.landId}</span>
                  <span className={`status-badge ${land.isFrozen ? "status-frozen" : "status-active"}`}>
                    {land.isFrozen ? "Frozen" : "Active"}
                  </span>
                </div>
                <div className="citizen-land-details">
                  <p><strong>Lalpurja No:</strong> {land.lalpurjaNo || "N/A"}</p>
                  <p><strong>Kitta No:</strong> {land.kittaNo || "N/A"}</p>
                  <p><strong>Area:</strong> {land.areaInSqMeters} sq m</p>
                  <p><strong>Ward:</strong> {land.wardNo || "N/A"}</p>
                  <p><strong>Municipality:</strong> {land.municipality || "N/A"}</p>
                  <p><strong>District:</strong> {land.district || "N/A"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}