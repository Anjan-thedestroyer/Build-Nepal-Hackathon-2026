import React from "react";

export default function LoadingOverlay({ loading, loadingMessage, loadingProgress }) {
  if (!loading) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-modal">
        <div className="loading-spinner-container">
          <div className="loading-spinner"></div>
        </div>
        <div className="loading-content">
          <h3 className="loading-title">Processing Blockchain Transaction</h3>
          <p className="loading-message">{loadingMessage}</p>
          <div className="loading-progress-container">
            <div className="loading-progress-bar">
              <div 
                className="loading-progress-fill" 
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <span className="loading-progress-text">{loadingProgress}%</span>
          </div>
          <p className="loading-hint">
            ⏳ Blockchain transactions may take 30-60 seconds
          </p>
        </div>
      </div>
    </div>
  );
}