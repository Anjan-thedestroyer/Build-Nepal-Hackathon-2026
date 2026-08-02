import React, { useState } from "react";
import { getLandByWard } from "../../../api/lalpurja.api";

export default function WardTab({ loading, setLoading, setLoadingMessage, setLoadingProgress, notify }) {
  const [wardSearch, setWardSearch] = useState({ wardNo: "", district: "", municipality: "" });
  const [wardLands, setWardLands] = useState([]);
  const [wardStats, setWardStats] = useState(null);

  const formatArea = (sqm) => {
    if (!sqm) return "0 m²";
    const ropani = sqm / 508.72;
    if (ropani < 1) return `${sqm.toFixed(2)} m²`;
    return `${ropani.toFixed(2)} Ropani (${sqm.toFixed(2)} m²)`;
  };

  const handleSearchByWard = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoadingMessage("Searching land records in ward...");
    setLoadingProgress(20);
    setWardStats(null);

    try {
      let progress = 20;
      const interval = setInterval(() => {
        progress += 20;
        if (progress <= 80) {
          setLoadingProgress(progress);
          if (progress === 40) setLoadingMessage("Filtering records by location...");
          else if (progress === 60) setLoadingMessage("Verifying ownership data...");
        }
      }, 600);

      const res = await getLandByWard(wardSearch.wardNo, wardSearch.district, wardSearch.municipality);
      const lands = res.data?.lands || res.data || [];
      
      clearInterval(interval);
      setLoadingProgress(100);
      setLoadingMessage("✅ Ward records retrieved!");
      
      setWardLands(lands);
      
      if (lands.length > 0) {
        const totalArea = lands.reduce((sum, land) => sum + (land.areaInSqMeters || 0), 0);
        const categories = {};
        lands.forEach(land => {
          const cat = land.category || "Uncategorized";
          categories[cat] = (categories[cat] || 0) + 1;
        });
        
        setWardStats({
          totalLands: lands.length,
          totalArea: totalArea,
          categories: categories,
        });
      }
      
      notify(`Found ${lands.length} land records in ward ${wardSearch.wardNo}.`);
    } catch (err) {
      setWardLands([]);
      setWardStats(null);
      notify(err.response?.data?.message || "Failed to fetch ward records", "error");
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
      <form onSubmit={handleSearchByWard}>
        <div className="form-mb">
          <label className="form-label">Ward No.*</label>
          <input
            type="number"
            required
            disabled={loading}
            className="form-input"
            value={wardSearch.wardNo}
            onChange={(e) => setWardSearch({ ...wardSearch, wardNo: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div>
            <label className="form-label">District (Optional)</label>
            <input
              type="text"
              disabled={loading}
              className="form-input"
              value={wardSearch.district}
              onChange={(e) => setWardSearch({ ...wardSearch, district: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Municipality (Optional)</label>
            <input
              type="text"
              disabled={loading}
              className="form-input"
              value={wardSearch.municipality}
              onChange={(e) => setWardSearch({ ...wardSearch, municipality: e.target.value })}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary form-mt"
        >
          {loading ? "Fetching..." : "Search Ward Records"}
        </button>
      </form>

      {wardStats && (
        <div className="ward-stats">
          <h3 className="ward-stats-title">📊 Ward {wardSearch.wardNo} Statistics</h3>
          <div className="ward-stats-grid">
            <div className="ward-stat-card">
              <div className="ward-stat-label">Total Records</div>
              <div className="ward-stat-value">{wardStats.totalLands}</div>
            </div>
            <div className="ward-stat-card">
              <div className="ward-stat-label">Total Area</div>
              <div className="ward-stat-value">{formatArea(wardStats.totalArea)}</div>
            </div>
          </div>
          
          {Object.keys(wardStats.categories).length > 0 && (
            <div className="ward-categories">
              <h4 className="ward-categories-title">Land Categories</h4>
              <div className="ward-categories-list">
                {Object.entries(wardStats.categories).map(([category, count]) => (
                  <div key={category} className="ward-category-item">
                    <span className="ward-category-name">{category}</span>
                    <span className="ward-category-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {wardLands.length > 0 && (
        <div className="ward-results">
          <h3 className="ward-results-title">Land Records in Ward {wardSearch.wardNo} ({wardLands.length})</h3>
          <div className="ward-results-list">
            {wardLands.map((land, idx) => (
              <div key={land._id || idx} className="ward-result-item-expanded">
                <div className="ward-result-header">
                  <span className="ward-result-id">Land ID: <strong>{land.landId}</strong></span>
                  <span className={`status-badge ${land.isFrozen ? "status-frozen" : "status-active"}`}>
                    {land.isFrozen ? "Frozen" : "Active"}
                  </span>
                </div>
                <div className="ward-result-details">
                  <div className="ward-result-row">
                    <span><strong>Lalpurja No:</strong> {land.lalpurjaNo || "N/A"}</span>
                    <span><strong>Kitta No:</strong> {land.kittaNo || "N/A"}</span>
                  </div>
                  <div className="ward-result-row">
                    <span><strong>Area:</strong> {formatArea(land.areaInSqMeters)}</span>
                    <span><strong>Category:</strong> {land.category || "N/A"}</span>
                  </div>
                  <div className="ward-result-row">
                    <span><strong>Municipality:</strong> {land.municipality || "N/A"}</span>
                    <span><strong>District:</strong> {land.district || "N/A"}</span>
                  </div>
                  {land.owners && land.owners.length > 0 && (
                    <div className="ward-result-row">
                      <span><strong>Owner:</strong> {land.owners.map(o => o.fullName || o.name).join(", ")}</span>
                    </div>
                  )}
                  {land.onChainTxHash && (
                    <div className="ward-result-row">
                      <span className="tx-hash"><strong>Tx Hash:</strong> {land.onChainTxHash.slice(0, 20)}...</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}