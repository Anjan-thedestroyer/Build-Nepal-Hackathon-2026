import React, { useState } from "react";
import "./AdminDashboard.css";

// Import all tab components
import RegisterTab from "./components/RegisterTab";
import SearchTab from "./components/SearchTab";
import WardTab from "./components/WardTab";
import CitizenshipTab from "./components/CitizenshipTab";
import TransferTab from "./components/TransferTab";
import UpdateTab from "./components/UpdateTab";

// Import loading overlay
import LoadingOverlay from "./components/LoadingOverlay";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("register");
  const [message, setMessage] = useState({ type: "", text: "" });
  
  // Loading state with progress for blockchain operations
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);

  const notify = (text, type = "success") => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 6000);
  };

  // Get alert className based on type
  const getAlertClass = () => {
    if (message.type === "error") return "alert-error";
    if (message.type === "info") return "alert-info";
    return "alert-success";
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        {/* Header */}
        <div className="header">
          <h1 className="header-title">Lalpurja Officer Dashboard</h1>
          <p className="header-subtitle">Land Registry & Blockchain Settlement System</p>
        </div>

        {/* Feedback Alert */}
        {message.text && (
          <div className={`alert ${getAlertClass()}`}>
            <span>{message.text}</span>
          </div>
        )}

        {/* Loading Overlay */}
        <LoadingOverlay 
          loading={loading}
          loadingMessage={loadingMessage}
          loadingProgress={loadingProgress}
        />

        {/* Tab Selection */}
        <div className="tab-nav">
          {[
            { id: "register", label: "Register Land" },
            { id: "search", label: "Search & Freeze" },
            { id: "ward", label: "Search by Ward" },
            { id: "citizenship", label: "Search by Citizenship" },
            { id: "transfer", label: "Transfer Title" },
            { id: "update", label: "Book Value & Category" },
          ].map((tab) => (
            <button
              key={tab.id}
              disabled={loading}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-button ${activeTab === tab.id ? "tab-button-active" : ""} ${loading ? "tab-button-disabled" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="content-area">
          {/* Render active tab */}
          {activeTab === "register" && (
            <RegisterTab 
              loading={loading}
              setLoading={setLoading}
              setLoadingMessage={setLoadingMessage}
              setLoadingProgress={setLoadingProgress}
              notify={notify}
            />
          )}

          {activeTab === "search" && (
            <SearchTab 
              loading={loading}
              setLoading={setLoading}
              setLoadingMessage={setLoadingMessage}
              setLoadingProgress={setLoadingProgress}
              notify={notify}
            />
          )}

          {activeTab === "ward" && (
            <WardTab 
              loading={loading}
              setLoading={setLoading}
              setLoadingMessage={setLoadingMessage}
              setLoadingProgress={setLoadingProgress}
              notify={notify}
            />
          )}

          {activeTab === "citizenship" && (
            <CitizenshipTab 
              loading={loading}
              setLoading={setLoading}
              setLoadingMessage={setLoadingMessage}
              setLoadingProgress={setLoadingProgress}
              notify={notify}
            />
          )}

          {activeTab === "transfer" && (
            <TransferTab 
              loading={loading}
              setLoading={setLoading}
              setLoadingMessage={setLoadingMessage}
              setLoadingProgress={setLoadingProgress}
              notify={notify}
            />
          )}

          {activeTab === "update" && (
            <UpdateTab 
              loading={loading}
              setLoading={setLoading}
              setLoadingMessage={setLoadingMessage}
              setLoadingProgress={setLoadingProgress}
              notify={notify}
            />
          )}
        </div>
      </div>
    </div>
  );
}