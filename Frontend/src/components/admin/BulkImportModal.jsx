import { useState, useRef } from 'react';
import { Modal, Btn, Badge, T, withAlpha } from '../UI.jsx';
import { importProjectsCSV } from '../../services/api.js';
import {
  Upload, FileText, Download, CheckCircle, AlertTriangle,
  X, RefreshCw, Sparkles, AlertCircle
} from 'lucide-react';

export default function BulkImportModal({ open, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  if (!open) return null;

  const handleDownloadSample = () => {
    const csvContent =
      "name,plantation_type,latitude,longitude,area_hectares,number_of_trees,start_date,ngo_name\n" +
      "Sundarbans Mangrove Expansion,mangrove,21.9497,89.1833,250.0,45000,2024-03-01,EcoGuard Brazil\n" +
      "Costa Rica Teak Sanctuary,teak,9.7489,-83.7534,180.5,22000,2024-02-15,Green Delta\n" +
      "Assam Bamboo Restoration,bamboo,26.2006,92.9376,95.0,15000,2024-04-10,EcoGuard Brazil\n" +
      "Nilgiri Mixed Agroforest,mixed,11.4102,76.6950,120.0,18500,2024-01-20,EcoGuard Brazil\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'carbonvault_project_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      if (selected.name.endsWith('.csv')) {
        setFile(selected);
        setErrorMsg('');
      } else {
        setErrorMsg('Please upload a valid .csv file');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.name.endsWith('.csv')) {
        setFile(selected);
        setErrorMsg('');
      } else {
        setErrorMsg('Please upload a valid .csv file');
      }
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setErrorMsg('Please select a CSV file to upload');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await importProjectsCSV(file);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setResult(res.data);
        if (res.data?.imported_count > 0 && onSuccess) {
          onSuccess();
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Modal open={open} onClose={onClose} title="Bulk Project Import (CSV)" width={680}>
      <div style={{ color: T.t2, fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
        Register multiple afforestation, mangrove, or conservation projects at once.
        Each valid row will be created as a registered project with automated boundary polygons and AI MRV telemetry checks.
      </div>

      {!result ? (
        <div>
          {/* Template Download Banner */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileText size={18} color={T.teal} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>Need the standard format?</div>
                <div style={{ fontSize: 11, color: T.t3 }}>Columns: name, plantation_type, latitude, longitude, area_hectares, number_of_trees, start_date</div>
              </div>
            </div>
            <button
              onClick={handleDownloadSample}
              style={{
                background: 'rgba(45,212,191,0.1)',
                border: '1px solid rgba(45,212,191,0.3)',
                color: T.teal,
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,191,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(45,212,191,0.1)'; }}
            >
              <Download size={13} /> Sample CSV
            </button>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? T.teal : file ? T.emeraldL : T.border}`,
              background: dragActive ? 'rgba(45,212,191,0.05)' : 'rgba(255,255,255,0.02)',
              borderRadius: 14,
              padding: '34px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: 16,
              transition: 'all 0.2s',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {file ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={32} color={T.emeraldL} />
                <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>{file.name}</div>
                <div style={{ fontSize: 12, color: T.t3 }}>{(file.size / 1024).toFixed(1)} KB — Ready to import</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(45,212,191,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: T.teal
                }}>
                  <Upload size={20} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>
                  Drag & drop your CSV file here, or <span style={{ color: T.teal }}>browse</span>
                </div>
                <div style={{ fontSize: 11, color: T.t4 }}>UTF-8 formatted CSV files only</div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: `1px solid rgba(239,68,68,0.3)`,
              borderRadius: 8,
              padding: '10px 14px',
              color: T.roseL,
              fontSize: 12,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            {file && (
              <Btn variant="secondary" onClick={handleReset} disabled={loading}>
                Clear
              </Btn>
            )}
            <Btn variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Btn>
            <Btn onClick={handleSubmit} disabled={!file || loading}>
              {loading ? (
                <>
                  <RefreshCw size={13} style={{ animation: 'spinSlow 0.8s linear infinite' }} />
                  Processing CSV…
                </>
              ) : (
                <>
                  <Upload size={13} /> Import Projects
                </>
              )}
            </Btn>
          </div>
        </div>
      ) : (
        /* Result Screen */
        <div>
          {/* Summary Badges */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            <div style={{
              flex: 1,
              background: 'rgba(16,185,129,0.08)',
              border: `1px solid rgba(16,185,129,0.25)`,
              borderRadius: 10,
              padding: '14px 16px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.emeraldL }}>{result.imported_count}</div>
              <div style={{ fontSize: 10, color: T.t3, textTransform: 'uppercase', fontWeight: 700, marginTop: 4 }}>Projects Imported</div>
            </div>
            {result.failed_count > 0 && (
              <div style={{
                flex: 1,
                background: 'rgba(239,68,68,0.08)',
                border: `1px solid rgba(239,68,68,0.25)`,
                borderRadius: 10,
                padding: '14px 16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: T.roseL }}>{result.failed_count}</div>
                <div style={{ fontSize: 10, color: T.t3, textTransform: 'uppercase', fontWeight: 700, marginTop: 4 }}>Failed Rows</div>
              </div>
            )}
          </div>

          {/* Errors list if any */}
          {result.errors && result.errors.length > 0 && (
            <div style={{
              background: 'rgba(239,68,68,0.05)',
              border: `1px solid rgba(239,68,68,0.2)`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
              maxHeight: 140,
              overflowY: 'auto',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.roseL, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Validation Issues ({result.errors.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.errors.map((err, i) => (
                  <div key={i} style={{ fontSize: 12, color: T.t2, display: 'flex', gap: 8 }}>
                    <span style={{ color: T.roseL, fontWeight: 700 }}>Row {err.row}:</span>
                    <span>{err.name} — {err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Imported projects table */}
          {result.imported_projects && result.imported_projects.length > 0 && (
            <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 18 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: `1px solid ${T.border}` }}>
                    <th style={{ padding: '8px 12px', color: T.t3, fontWeight: 700 }}>Project ID</th>
                    <th style={{ padding: '8px 12px', color: T.t3, fontWeight: 700 }}>Name</th>
                    <th style={{ padding: '8px 12px', color: T.t3, fontWeight: 700 }}>Type</th>
                    <th style={{ padding: '8px 12px', color: T.t3, fontWeight: 700 }}>Area (ha)</th>
                    <th style={{ padding: '8px 12px', color: T.t3, fontWeight: 700 }}>Trees</th>
                    <th style={{ padding: '8px 12px', color: T.t3, fontWeight: 700 }}>MRV Score</th>
                  </tr>
                </thead>
                <tbody>
                  {result.imported_projects.map((p) => (
                    <tr key={p.project_id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                      <td style={{ padding: '8px 12px', color: T.teal, fontWeight: 700, fontFamily: 'monospace' }}>{p.project_id}</td>
                      <td style={{ padding: '8px 12px', color: T.t1, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ textTransform: 'capitalize', color: T.t2 }}>{p.plantation_type}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: T.t2 }}>{p.area_hectares}</td>
                      <td style={{ padding: '8px 12px', color: T.t2 }}>{(p.number_of_trees || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', color: T.emeraldL, fontWeight: 700 }}>{p.mrv_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Done button */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={handleReset}>Import Another File</Btn>
            <Btn onClick={onClose}>Done</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
