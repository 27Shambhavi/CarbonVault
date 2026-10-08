// src/components/CertificateModal.jsx
import React, { useState, useEffect } from 'react';
import { verifyCertificate, fetchCertificateDetail, getCertificateDownloadUrl, getCertificateImageUrl } from '../services/api.js';
import { Modal, Btn, Badge, T } from './UI.jsx';
import { Award, Download, ExternalLink, ShieldCheck, Copy, Check, FileText, Image as ImageIcon, X } from 'lucide-react';

export default function CertificateModal({ certId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!certId) return;
    setLoading(true);
    setError(null);
    setImageLoaded(false);

    verifyCertificate(certId)
      .then((res) => {
        if (res.data) {
          setData(res.data);
        } else {
          setError(res.error || `Certificate ${certId} not found in registry`);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to verify certificate');
      })
      .finally(() => setLoading(false));
  }, [certId]);

  const handleCopyHash = () => {
    const hashVal = data?.hash || data?.proof_hash;
    if (hashVal) {
      navigator.clipboard.writeText(hashVal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = (format) => {
    const url = getCertificateDownloadUrl(certId, format);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Certificate_${certId}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal open={Boolean(certId)} onClose={onClose} width={820}>
      <div style={{ padding: '6px 4px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(45, 212, 191, 0.15)',
              border: '1px solid rgba(45, 212, 191, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Award size={20} color={T.teal || '#2dd4bf'} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: T.t1, margin: 0 }}>
                {data?.title || 'Impact Certificate Verification'}
              </h2>
              <span style={{ fontSize: 12, color: T.t2, fontFamily: 'monospace' }}>
                Registry ID: {certId}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {data?.status && (
              <Badge color="emerald">
                <ShieldCheck size={12} style={{ marginRight: 4 }} /> {data.status}
              </Badge>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none', color: T.t2,
                cursor: 'pointer', padding: 6, borderRadius: 6
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{
              width: 40, height: 40, border: '3px solid rgba(45,212,191,0.15)',
              borderTop: `3px solid ${T.teal}`, borderRadius: '50%',
              margin: '0 auto 16px', animation: 'spinSlow 0.8s linear infinite'
            }} />
            <div style={{ fontSize: 14, color: T.t2 }}>Rendering dynamic cryptographic certificate…</div>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: T.roseL || '#f43f5e' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <X size={22} color="#f43f5e" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#f43f5e' }}>
              Certificate Not Found
            </div>
            <div style={{ fontSize: 13, color: T.t2, maxWidth: 460, margin: '0 auto', fontFamily: 'monospace' }}>
              {error}
            </div>
          </div>
        ) : (
          <div>
            {/* Certificate Preview Image */}
            <div style={{
              borderRadius: 12,
              overflow: 'hidden',
              border: `1px solid ${T.border2}`,
              background: '#070b14',
              marginBottom: 20,
              position: 'relative',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
            }}>
              {!imageLoaded && (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.t3, fontSize: 13 }}>
                  Loading certificate image…
                </div>
              )}
              <img
                src={getCertificateImageUrl(certId)}
                alt={`Certificate ${certId}`}
                onLoad={() => setImageLoaded(true)}
                style={{
                  width: '100%',
                  display: imageLoaded ? 'block' : 'none',
                  maxHeight: 440,
                  objectFit: 'contain'
                }}
              />
            </div>

            {/* Key Metadata Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              marginBottom: 20,
              padding: 16,
              background: T.bg1,
              borderRadius: 10,
              border: `1px solid ${T.border}`
            }}>
              <div>
                <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 600 }}>Beneficiary</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.t1, marginTop: 2 }}>
                  {data?.beneficiary || data?.buyer_name || data?.ngo_name || data?.ngo || 'Verified Partner'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 600 }}>Project</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.teal, marginTop: 2 }}>{data?.project_name}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 600 }}>Volume Offset</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.emeraldL, marginTop: 2 }}>
                  {(data?.tonnes ?? data?.credits ?? 0).toLocaleString()} tCO₂e
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 600 }}>Issuance Date</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.t1, marginTop: 2 }}>
                  {data?.date || data?.issuance_date || '—'}
                </div>
              </div>
            </div>

            {/* Cryptographic Proof Hash */}
            {(data?.hash || data?.proof_hash) && (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: T.skyL, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ShieldCheck size={13} /> SHA-256 Cryptographic Ledger Proof
                  </div>
                  <div style={{ fontSize: 12, color: T.t2, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {data?.hash || data?.proof_hash}
                  </div>
                </div>
                <button
                  onClick={handleCopyHash}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${T.border}`,
                    borderRadius: 6,
                    padding: '6px 10px',
                    color: copied ? T.emeraldL : T.t1,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy Hash'}
                </button>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Btn variant="outline" onClick={() => handleDownload('pdf')}>
                <FileText size={15} style={{ marginRight: 6 }} /> Download PDF
              </Btn>
              <Btn variant="primary" onClick={() => handleDownload('png')}>
                <Download size={15} style={{ marginRight: 6 }} /> Download High-Res PNG
              </Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
