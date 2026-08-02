import React, { useState } from "react";
import { updateBookValue, updateLandType } from "../../../api/lalpurja.api";

export default function UpdateTab({ loading, setLoading, setLoadingMessage, setLoadingProgress, notify }) {
  const [valuationForm, setValuationForm] = useState({
    landId: "",
    currentBookValue: "",
    taxRate: "",
  });

  const [categoryForm, setCategoryForm] = useState({
    landId: "",
    newLandType: "Residential",
    reason: "",
  });

  const handleValuationUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoadingMessage("Updating valuation on blockchain...");
    setLoadingProgress(20);

    try {
      let progress = 20;
      const interval = setInterval(() => {
        progress += 15;
        if (progress <= 85) {
          setLoadingProgress(progress);
          if (progress === 40) setLoadingMessage("Verifying valuation data...");
          else if (progress === 60) setLoadingMessage("Submitting to blockchain...");
        }
      }, 800);

      await updateBookValue(
        Number(valuationForm.landId),
        valuationForm.currentBookValue ? Number(valuationForm.currentBookValue) : undefined,
        valuationForm.taxRate ? Number(valuationForm.taxRate) : undefined
      );
      
      clearInterval(interval);
      setLoadingProgress(100);
      setLoadingMessage("✅ Valuation updated on blockchain!");
      
      notify("Valuation updated successfully!");
      setValuationForm({ landId: "", currentBookValue: "", taxRate: "" });
    } catch (err) {
      notify(err.response?.data?.message || "Valuation update failed", "error");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingMessage("");
        setLoadingProgress(0);
      }, 1500);
    }
  };

  const handleCategoryUpdate = async (e) => {
    e.preventDefault();
    
    if (!categoryForm.landId.trim()) {
      notify("Please enter a valid Land ID", "error");
      return;
    }

    setLoading(true);
    setLoadingMessage("Updating land classification on blockchain...");
    setLoadingProgress(20);

    try {
      let progress = 20;
      const interval = setInterval(() => {
        progress += 15;
        if (progress <= 85) {
          setLoadingProgress(progress);
          if (progress === 40) setLoadingMessage("Validating classification change...");
          else if (progress === 60) setLoadingMessage("Recording on blockchain...");
        }
      }, 800);

      await updateLandType(
        Number(categoryForm.landId),
        categoryForm.newLandType,
        categoryForm.reason
      );
      
      clearInterval(interval);
      setLoadingProgress(100);
      setLoadingMessage("✅ Land classification updated on blockchain!");
      
      notify("Land classification updated successfully!");
      setCategoryForm({ landId: "", newLandType: "Residential", reason: "" });
    } catch (err) {
      notify(err.response?.data?.message || "Category update failed", "error");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingMessage("");
        setLoadingProgress(0);
      }, 1500);
    }
  };

  return (
    <div className="update-section">
      <form onSubmit={handleValuationUpdate}>
        <h2 className="update-subtitle">Update Valuation & Tax</h2>
        <div className="form-mb">
          <label className="form-label">Land ID</label>
          <input
            type="number"
            required
            disabled={loading}
            className="form-input"
            value={valuationForm.landId}
            onChange={(e) => setValuationForm({ ...valuationForm, landId: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div>
            <label className="form-label">New Book Value</label>
            <input
              type="number"
              disabled={loading}
              className="form-input"
              value={valuationForm.currentBookValue}
              onChange={(e) => setValuationForm({ ...valuationForm, currentBookValue: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Tax Rate</label>
            <input
              type="number"
              step="0.001"
              disabled={loading}
              className="form-input"
              value={valuationForm.taxRate}
              onChange={(e) => setValuationForm({ ...valuationForm, taxRate: e.target.value })}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary form-mt"
        >
          {loading ? "Updating..." : "Update Book Value"}
        </button>
      </form>

      <hr className="update-divider" />

      <form onSubmit={handleCategoryUpdate}>
        <h2 className="update-subtitle">Update Land Classification</h2>
        <div className="form-mb">
          <label className="form-label">Land ID *</label>
          <input
            type="number"
            required
            disabled={loading}
            placeholder="Enter Land ID"
            className="form-input"
            value={categoryForm.landId}
            onChange={(e) => setCategoryForm({ ...categoryForm, landId: e.target.value })}
          />
          <small className="form-hint">
            Enter the numeric Land ID to update its classification
          </small>
        </div>
        <div className="form-mb">
          <label className="form-label">New Land Classification *</label>
          <select
            required
            disabled={loading}
            className="form-select"
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
        <div className="form-mb-lg">
          <label className="form-label">Reason for Reclassification</label>
          <input
            type="text"
            disabled={loading}
            placeholder="Enter reason for classification change"
            className="form-input"
            value={categoryForm.reason}
            onChange={(e) => setCategoryForm({ ...categoryForm, reason: e.target.value })}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
        >
          {loading ? (
            <>
              <span className="btn-spinner"></span>
              <span>Processing...</span>
            </>
          ) : (
            "Update Classification"
          )}
        </button>
      </form>
    </div>
  );
}