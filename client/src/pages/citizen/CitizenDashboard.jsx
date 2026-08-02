import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Import API functions
import {
  getMyLands,
  verifyLalpurjaPdf,
  getLandByCitizenshipNo,
} from '../../api/citizen.api';

// Import CSS Module
import styles from './CitizenDashboard.module.css';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Sqm to Ropani conversion helper
const sqmToRopani = (sqm) => {
  if (!sqm || sqm <= 0) return '0 Ropani';
  const ropaniInSqm = 508.72;
  const aanaInSqm = 31.80;
  const paisaInSqm = 7.95;
  const daamInSqm = 1.99;

  let remaining = sqm;
  const ropani = Math.floor(remaining / ropaniInSqm);
  remaining %= ropaniInSqm;

  const aana = Math.floor(remaining / aanaInSqm);
  remaining %= aanaInSqm;

  const paisa = Math.floor(remaining / paisaInSqm);
  remaining %= paisaInSqm;

  const daam = (remaining / daamInSqm).toFixed(1);

  const parts = [];
  if (ropani > 0) parts.push(`${ropani} Ropani`);
  if (aana > 0) parts.push(`${aana} Aana`);
  if (paisa > 0) parts.push(`${paisa} Paisa`);
  if (daam > 0) parts.push(`${daam} Daam`);

  return parts.join(', ') || `${sqm} m²`;
};

// Tax calculation helper based on land category
const getTaxInfo = (category) => {
  const taxRates = {
    'Agricultural': { rate: 10, label: 'Agricultural Land Tax', color: '#0b6e4f' },
    'Residential': { rate: 5, label: 'Residential Land Tax', color: '#2563eb' },
    'Commercial': { rate: 15, label: 'Commercial Land Tax', color: '#dc2626' },
    'Industrial': { rate: 12, label: 'Industrial Land Tax', color: '#d97706' },
    'Forest/Conservation': { rate: 2, label: 'Conservation Land Tax', color: '#059669' },
    'Public/Government': { rate: 0, label: 'Government Land (Exempt)', color: '#64748b' },
    'Mixed': { rate: 8, label: 'Mixed Use Land Tax', color: '#7c3aed' },
  };
  return taxRates[category] || { rate: 5, label: 'Standard Land Tax', color: '#2563eb' };
};

// Calculate tax amount
const calculateTax = (category, bookValue) => {
  const taxInfo = getTaxInfo(category);
  return (bookValue * taxInfo.rate) / 100;
};

export default function CitizenDashboard() {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [selectedParcel, setSelectedParcel] = useState(null);

  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [verificationResult, setVerificationResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCitizenLands();
  }, []);

  const fetchCitizenLands = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getMyLands();

      const payload = response?.data || response;
      const landsArray = payload?.lands || (Array.isArray(payload) ? payload : []);

      console.log('[DEBUG] Extracted lands array:', landsArray);

      if (!landsArray.length) {
        console.warn('[DEBUG] No lands returned from backend.');
        setParcels([]);
        return;
      }

      const normalized = landsArray.map((land, idx) => {
        let parsedCoords = [];
        if (land.boundaryLocation?.coordinates?.[0]?.length > 0) {
          parsedCoords = land.boundaryLocation.coordinates[0].map(([lng, lat]) => [lat, lng]);
        } else {
          parsedCoords = [
            [27.7650, 85.3020],
            [27.7655, 85.3028],
            [27.7658, 85.3035],
            [27.7642, 85.3025],
          ];
        }

        const category = land.category || 'Agricultural';
        const taxInfo = getTaxInfo(category);
        const taxAmount = calculateTax(category, land.CurrentBookValue || 0);

        return {
          id: land._id || `land-${land.landId || idx}`,
          landId: String(land.landId || ''),
          plotNumber: String(land.landId || 'N/A'),
          kittaNumber: String(land.kittaNo || 'N/A'),
          lalpurjaNo: String(land.lalpurjaNo || 'N/A'),
          ownerName: land.owners?.map((o) => o.fullName || o.name).join(', ') || 'Registered Citizen',
          citizenshipNo: land.documentHash ? `${land.documentHash.slice(0, 8)}...` : 'N/A',
          district: land.district || 'Tarakeshwar',
          municipality: land.municipality || 'Tarakeshwar Municipality',
          wardNo: land.wardNo || 5,
          category: category,
          categoryLabel: taxInfo.label,
          taxRate: taxInfo.rate,
          taxAmount: taxAmount,
          taxColor: taxInfo.color,
          areaSqm: land.areaInSqMeters || 0,
          currentBookValue: land.CurrentBookValue || 0,
          buyingPrice: land.buyngPrice || 0,
          status: land.isFrozenOnChain || land.isFrozen
            ? 'Restricted'
            : land.onChainVerified
            ? 'Verified'
            : 'Verified (Off-Chain)',
          blockchainTxHash: land.onChainTxHash || land.documentHash || '0x0',
          coordinates: parsedCoords,
        };
      });

      setParcels(normalized);
      if (normalized.length > 0) {
        setSelectedParcel(normalized[0]);
      }

      console.log('[DEBUG] Normalized Parcels ready for UI:', normalized);
    } catch (err) {
      console.error('[ERROR] Failed to process land records:', err);
      setError(err.message || 'Failed to fetch land records.');
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingPdf(true);
    setUploadProgress(0);
    setVerificationResult(null);

    try {
      const response = await verifyLalpurjaPdf(file, {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        },
      });

      const result = response.data || response;
      setVerificationResult({
        success: true,
        message: result.message || 'Lalpurja PDF verified on chain!',
      });

      fetchCitizenLands();
    } catch (err) {
      setVerificationResult({
        success: false,
        message: err.message || 'PDF Verification failed.',
      });
    } finally {
      setIsUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Get unique categories for filter
  const uniqueCategories = useMemo(() => {
    const cats = new Set(parcels.map(p => p.category));
    return ['ALL', ...Array.from(cats)];
  }, [parcels]);

  // Deep Search across all plot attributes
  const filteredParcels = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return parcels.filter((p) => {
      const matchesSearch =
        !query ||
        p.plotNumber.toLowerCase().includes(query) ||
        p.kittaNumber.toLowerCase().includes(query) ||
        p.landId.toLowerCase().includes(query) ||
        p.lalpurjaNo.toLowerCase().includes(query) ||
        p.municipality.toLowerCase().includes(query) ||
        p.district.toLowerCase().includes(query) ||
        p.ownerName.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.status.toLowerCase().includes(query);

      const matchesStatus =
        filterStatus === 'ALL' || p.status.toUpperCase().includes(filterStatus.toUpperCase());

      const matchesCategory =
        filterCategory === 'ALL' || p.category === filterCategory;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [parcels, searchTerm, filterStatus, filterCategory]);

  // Sync selected parcel when searching
  useEffect(() => {
    if (filteredParcels.length > 0) {
      if (!selectedParcel || !filteredParcels.some((p) => p.id === selectedParcel.id)) {
        setSelectedParcel(filteredParcels[0]);
      }
    } else {
      setSelectedParcel(null);
    }
  }, [filteredParcels]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterStatus('ALL');
    setFilterCategory('ALL');
    fetchCitizenLands();
  };

  const totalAreaSqm = parcels.reduce((sum, p) => sum + (p.areaSqm || 0), 0);
  const totalTaxAmount = parcels.reduce((sum, p) => sum + (p.taxAmount || 0), 0);

  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>Citizen Land Portal</h1>
          <p className={styles.headerSubtitle}>
            Inspect owned lands, perform citizenship lookups, and verify Lalpurja records.
          </p>
        </div>

        <div>
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            onChange={handlePdfUpload}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPdf}
            className={styles.scanBtn}
          >
            {isUploadingPdf ? `Uploading (${uploadProgress}%)` : 'Scan & Verify Lalpurja PDF'}
          </button>
        </div>
      </header>

      {/* Alert Notifications */}
      {verificationResult && (
        <div className={`${styles.alert} ${verificationResult.success ? styles.alertSuccess : styles.alertError}`}>
          <strong>{verificationResult.success ? 'Success: ' : 'Notice: '}</strong>
          {verificationResult.message}
        </div>
      )}

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`}>
          {error}
        </div>
      )}

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Owned Titles</div>
          <div className={styles.statValue}>{parcels.length} Parcels</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Land Area</div>
          <div className={`${styles.statValue} ${styles.statValueSuccess}`}>
            {sqmToRopani(totalAreaSqm)}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Annual Tax Liability</div>
          <div className={`${styles.statValue} ${styles.statValueWarning}`}>
            NPR {totalTaxAmount.toLocaleString()}
          </div>
        </div>
      </div>
      
      <div className={styles.controlsBar}>
        <input
          type="text"
          placeholder="Search by Plot, Kitta, Lalpurja, Location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={styles.statusSelect}
        >
          <option value="ALL">All Status</option>
          <option value="Verified">Verified</option>
          <option value="Restricted">Restricted</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className={styles.categorySelect}
        >
          {uniqueCategories.map(cat => (
            <option key={cat} value={cat}>{cat === 'ALL' ? 'All Categories' : cat}</option>
          ))}
        </select>
        <button onClick={handleResetFilters} className={styles.secondaryBtn}>
          Reset
        </button>
      </div>

      {/* Main Layout: Map & Sidebar */}
      <div className={styles.mainLayout}>
        <div className={styles.mapWrapper}>
          {loading ? (
            <div className={styles.mapLoader}>Loading boundaries...</div>
          ) : (
            <MapContainer
              center={selectedParcel?.coordinates?.[0] || [27.7650, 85.3020]}
              zoom={16}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {filteredParcels.map((parcel) => {
                const isSelected = selectedParcel?.id === parcel.id;
                const taxInfo = getTaxInfo(parcel.category);
                return (
                  <Polygon
                    key={parcel.id}
                    positions={parcel.coordinates}
                    pathOptions={{
                      color: isSelected ? '#ef5461' : taxInfo.color,
                      fillColor: isSelected ? '#ef5461' : taxInfo.color,
                      fillOpacity: isSelected ? 0.5 : 0.25,
                      weight: isSelected ? 3 : 2,
                    }}
                    eventHandlers={{ click: () => setSelectedParcel(parcel) }}
                  >
                    <Popup>
                      <div>
                        <strong>Plot #{parcel.plotNumber}</strong> (Kitta #{parcel.kittaNumber})
                        <br />
                        Lalpurja: {parcel.lalpurjaNo}
                        <br />
                        Owner: {parcel.ownerName}
                        <br />
                        Area: {sqmToRopani(parcel.areaSqm)}
                        <br />
                        <span style={{ color: taxInfo.color, fontWeight: 600 }}>
                          Tax: {taxInfo.rate}% (NPR {parcel.taxAmount.toLocaleString()})
                        </span>
                      </div>
                    </Popup>
                  </Polygon>
                );
              })}
            </MapContainer>
          )}
        </div>

        {/* Sidebar Details Panel */}
        <div className={styles.sidebarPanel}>
          {selectedParcel ? (
            <div className={styles.detailCard}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Plot #{selectedParcel.plotNumber}</h3>
                <span className={styles.statusBadge}>{selectedParcel.status}</span>
              </div>
              <div className={styles.kittaText}>
                Kitta No: <strong>{selectedParcel.kittaNumber}</strong> | Lalpurja No: <strong>{selectedParcel.lalpurjaNo}</strong>
              </div>

              <div className={styles.infoGrid}>
                <div><strong>Owner:</strong> {selectedParcel.ownerName}</div>
                <div><strong>Category:</strong> {selectedParcel.category}</div>
                <div><strong>Location:</strong> {selectedParcel.municipality}, Ward {selectedParcel.wardNo}, {selectedParcel.district}</div>
                <div><strong>Area:</strong> {sqmToRopani(selectedParcel.areaSqm)} ({selectedParcel.areaSqm} m²)</div>
                <div><strong>Book Value:</strong> NPR {selectedParcel.currentBookValue.toLocaleString()}</div>
                
                {/* Tax Information Section */}
                <div className={styles.taxSection}>
                  <div className={styles.taxHeader}>
                    <strong>Tax Information</strong>
                  </div>
                  <div className={styles.taxDetails}>
                    <div>
                      <span className={styles.taxLabel}>Tax Rate:</span>
                      <span className={styles.taxRate} style={{ color: selectedParcel.taxColor }}>
                        {selectedParcel.taxRate}%
                      </span>
                    </div>
                    <div>
                      <span className={styles.taxLabel}>Annual Tax:</span>
                      <span className={styles.taxAmount}>
                        NPR {selectedParcel.taxAmount.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className={styles.taxLabel}>Category:</span>
                      <span className={styles.taxCategory}>
                        {selectedParcel.categoryLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.txHash}>Tx: {selectedParcel.blockchainTxHash}</div>
              </div>
            </div>
          ) : (
            <div className={`${styles.detailCard} ${styles.emptySelection}`}>
              {searchTerm
                ? `No plots matching "${searchTerm}". Try resetting search.`
                : 'Select a parcel on the map or list to inspect details.'}
            </div>
          )}

          {/* Directory List */}
          <div className={styles.listCard}>
            <h4 className={styles.listTitle}>
              Matching Records ({filteredParcels.length} of {parcels.length})
            </h4>
            <div className={styles.landItemsGroup}>
              {filteredParcels.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                  No land records found.
                </div>
              ) : (
                filteredParcels.map((parcel) => {
                  const isSelected = selectedParcel?.id === parcel.id;
                  return (
                    <div
                      key={parcel.id}
                      onClick={() => setSelectedParcel(parcel)}
                      className={`${styles.landItem} ${isSelected ? styles.activeLandItem : ''}`}
                    >
                      <div className={styles.landItemHeader}>
                        <span>Plot #{parcel.plotNumber}</span>
                        <span className={styles.landItemTax} style={{ color: parcel.taxColor }}>
                          {parcel.taxRate}%
                        </span>
                      </div>
                      <div className={styles.landItemSub}>
                        {parcel.municipality} • {parcel.areaSqm} m² ({sqmToRopani(parcel.areaSqm)})
                      </div>
                      <div className={styles.landItemCategory}>
                        {parcel.category} • Tax: NPR {parcel.taxAmount.toLocaleString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}