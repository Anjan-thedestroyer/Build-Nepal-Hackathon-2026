import React, { useState } from "react";
import { transferLalpurja } from "../../../api/lalpurja.api";

export default function TransferTab({ loading, setLoading, setLoadingMessage, setLoadingProgress, notify }) {
  const [transferForm, setTransferForm] = useState({
    landId: "",
    citizenshipNo: "",
    price: "",
  });

  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoadingMessage("Initiating ownership transfer on blockchain...");
    setLoadingProgress(10);

    try {
      let progress = 10;
      const interval = setInterval(() => {
        progress += 12;
        if (progress <= 90) {
          setLoadingProgress(progress);
          if (progress === 30) setLoadingMessage("Validating transfer conditions...");
          else if (progress === 50) setLoadingMessage("Creating smart contract transaction...");
          else if (progress === 70) setLoadingMessage("Broadcasting to blockchain network...");
          else if (progress === 85) setLoadingMessage("Waiting for block confirmation...");
        }
      }, 1000);

      await transferLalpurja({
        landId: Number(transferForm.landId),
        newCitizenshipNos: [transferForm.citizenshipNo],
        price: Number(transferForm.price),
      });
      clearInterval(interval);
      setLoadingProgress(100);
      setLoadingMessage("✅ Ownership transfer confirmed on blockchain!");
      
      notify("Ownership transfer confirmed on blockchain!");
      setTransferForm({ landId: "", citizenshipNo: "", price: "" });
    } catch (err) {
      notify(err.response?.data?.message || "Transfer failed", "error");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingMessage("");
        setLoadingProgress(0);
      }, 2000);
    }
  };

  return (
    <form onSubmit={handleTransfer} className="form-group">
      <h2 className="form-title">Transfer Title Ownership</h2>
      <div className="form-mb">
        <label className="form-label">Land ID</label>
        <input
          type="number"
          required
          disabled={loading}
          className="form-input"
          value={transferForm.landId}
          onChange={(e) => setTransferForm({ ...transferForm, landId: e.target.value })}
        />
      </div>
      <div className="form-mb">
        <label className="form-label">New Owner Citizenship No</label>
        <input
          type="text"
          required
          disabled={loading}
          className="form-input"
          value={transferForm.citizenshipNo}
          onChange={(e) => setTransferForm({ ...transferForm, citizenshipNo: e.target.value })}
        />
      </div>
      <div className="form-mb-lg">
        <label className="form-label">Transfer Price (NPR)</label>
        <input
          type="number"
          required
          disabled={loading}
          className="form-input"
          value={transferForm.price}
          onChange={(e) => setTransferForm({ ...transferForm, price: e.target.value })}
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
          "Execute Transfer"
        )}
      </button>
    </form>
  );
}