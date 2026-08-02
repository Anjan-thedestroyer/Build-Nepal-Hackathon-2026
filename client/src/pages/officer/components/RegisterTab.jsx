import React, { useState } from "react";
import { registerLalpurja } from "../../../api/lalpurja.api";

export default function RegisterTab({ loading, setLoading, setLoadingMessage, setLoadingProgress, notify }) {
  const [registerForm, setRegisterForm] = useState({
    citizenshipNo: "",
    lalpurjaDocument: null,
  });

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoadingMessage("Preparing document for blockchain submission...");
    setLoadingProgress(10);

    try {
      let progress = 10;
      const interval = setInterval(() => {
        progress += 10;
        if (progress <= 90) {
          setLoadingProgress(progress);
          if (progress === 30) setLoadingMessage("Uploading document to IPFS...");
          else if (progress === 50) setLoadingMessage("Verifying document authenticity...");
          else if (progress === 70) setLoadingMessage("Submitting to blockchain network...");
          else if (progress === 90) setLoadingMessage("Waiting for blockchain confirmation...");
        }
      }, 1000);

      const res = await registerLalpurja(registerForm);
      
      clearInterval(interval);
      setLoadingProgress(100);
      setLoadingMessage("✅ Transaction confirmed on blockchain!");
      
      notify(res.data?.message || "Lalpurja registered and recorded on-chain successfully!");
      setRegisterForm({
        citizenshipNo: "",
        lalpurjaDocument: null,
      });
      e.target.reset();
    } catch (err) {
      setLoadingProgress(0);
      notify(err.response?.data?.message || "Registration failed. Check server logs.", "error");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingMessage("");
        setLoadingProgress(0);
      }, 1500);
    }
  };

  return (
    <form onSubmit={handleRegister} className="form-group">
      <h2 className="form-title">Register New Lalpurja</h2>
      
      <div className="form-mb">
        <label className="form-label">Citizenship No. *</label>
        <input
          type="text"
          required
          disabled={loading}
          placeholder="Enter Citizenship Number"
          className="form-input"
          value={registerForm.citizenshipNo}
          onChange={(e) => setRegisterForm({ ...registerForm, citizenshipNo: e.target.value })}
        />
      </div>

      <div className="form-mb-lg">
        <label className="form-label">Lalpurja Document (PDF / Image) *</label>
        <input
          type="file"
          accept="application/pdf,image/*"
          required
          disabled={loading}
          className="form-input-file"
          onChange={(e) =>
            setRegisterForm({ ...registerForm, lalpurjaDocument: e.target.files[0] })
          }
        />
        <small className="form-hint">
          Supported formats: PDF, JPEG, PNG (Max 10MB)
        </small>
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
          <span>Upload & Register</span>
        )}
      </button>
    </form>
  );
}