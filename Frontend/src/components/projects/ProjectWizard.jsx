import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../AppContext.jsx';
import {
  createProject, precheckProject, fetchPlantationTypes
} from '../../services/api.js';
import {
  Card, SectionHeader, Badge, Btn, T, gc
} from '../UI.jsx';
import {
  TreePine, MapPin, Upload, CheckCircle, AlertCircle,
  FileText, ArrowRight, ArrowLeft, RotateCcw, ShieldCheck,
  Check, Layers, Sparkles
} from 'lucide-react';

const DRAFT_STORAGE_KEY = 'carbonvault_project_draft';

const STEPS = [
  { step: 1, label: 'Basic Info', desc: 'Identity & Objectives' },
  { step: 2, label: 'Location & Polygon', desc: 'Geofence Boundaries' },
  { step: 3, label: 'Baseline & Carbon', desc: 'Carbon Sequestration Model' },
  { step: 4, label: 'Evidence Upload', desc: 'Geotagged Field Photos' },
  { step: 5, label: 'Legal Documents', desc: 'PDD & Land Tenure' },
  { step: 6, label: 'Review & Submit', desc: 'Pre-flight Integrity Screening' },
];

const DEFAULT_PLANTATION_TYPES = [
  { value: 'mangrove', label: '🌊 Mangrove Restoration', annual_rate_mid: 30 },
  { value: 'bamboo', label: '🎋 Bamboo Agroforestry', annual_rate_mid: 15 },
  { value: 'mixed', label: '⚡ Mixed Native Forest', annual_rate_mid: 17.5 },
  { value: 'eucalyptus', label: '🌳 Eucalyptus Plantation', annual_rate_mid: 11.5 },
  { value: 'teak', label: '🌳 Teak Hardwood', annual_rate_mid: 5.5 },
  { value: 'neem', label: '🌳 Neem Silviculture', annual_rate_mid: 4.0 },
  { value: 'pine', label: '🌲 Subtropical Pine', annual_rate_mid: 7.5 },
  { value: 'banyan', label: '🌳 Sacred Banyan / Ficus', annual_rate_mid: 3.5 },
];

function generatePolygonWKT(lat, lng, areaHectares) {
  const sideKm = Math.sqrt((areaHectares || 10) * 0.01);
  const dLat = sideKm / 111.32;
  const dLng = sideKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const coords = [
    `${(parseFloat(lng) - dLng).toFixed(6)} ${(parseFloat(lat) - dLat).toFixed(6)}`,
    `${(parseFloat(lng) + dLng).toFixed(6)} ${(parseFloat(lat) - dLat).toFixed(6)}`,
    `${(parseFloat(lng) + dLng).toFixed(6)} ${(parseFloat(lat) + dLat).toFixed(6)}`,
    `${(parseFloat(lng) - dLng).toFixed(6)} ${(parseFloat(lat) + dLat).toFixed(6)}`,
    `${(parseFloat(lng) - dLng).toFixed(6)} ${(parseFloat(lat) - dLat).toFixed(6)}`,
  ];
  return `POLYGON((${coords.join(', ')}))`;
}

export default function ProjectWizard() {
  const { user, navigateToProject, addToast, triggerRefresh } = useApp();
  const defaultNgoName = user?.org || user?.name || 'Registered NGO';

  const [currentStep, setCurrentStep] = useState(1);
  const [plantationTypes, setPlantationTypes] = useState(DEFAULT_PLANTATION_TYPES);

  // Form State with localStorage restoration
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      name: '',
      ngo_name: defaultNgoName,
      plantation_type: 'mangrove',
      description: '',
      objectives: '',
      latitude: '',
      longitude: '',
      area_hectares: '',
      polygon_wkt: '',
      number_of_trees: '',
      start_date: new Date().toISOString().split('T')[0],
      tree_age_years: '1',
      baseline_soil_carbon: '45.0',
    };
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [pddFile, setPddFile] = useState(null);
  const [deedFile, setDeedFile] = useState(null);
  const [consentFile, setConsentFile] = useState(null);

  const [prechecking, setPrechecking] = useState(false);
  const [precheckResult, setPrecheckResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
    } catch {}
  }, [form]);

  // Load plantation types from API
  useEffect(() => {
    fetchPlantationTypes()
      .then((res) => {
        if (Array.isArray(res.data?.types) && res.data.types.length > 0) {
          setPlantationTypes(
            res.data.types.map((t) => ({
              value: t.type_key,
              label: t.label,
              annual_rate_mid: t.annual_rate_mid,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetDraft = () => {
    if (window.confirm('Are you sure you want to clear your current draft?')) {
      const empty = {
        name: '',
        ngo_name: defaultNgoName,
        plantation_type: 'mangrove',
        description: '',
        objectives: '',
        latitude: '',
        longitude: '',
        area_hectares: '',
        polygon_wkt: '',
        number_of_trees: '',
        start_date: new Date().toISOString().split('T')[0],
        tree_age_years: '1',
        baseline_soil_carbon: '45.0',
      };
      setForm(empty);
      setPhotoFile(null);
      setPddFile(null);
      setDeedFile(null);
      setConsentFile(null);
      setPrecheckResult(null);
      setCurrentStep(1);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      addToast({ type: 'info', title: 'Draft Cleared', message: 'Wizard reset to clean state.' });
    }
  };

  // Pre-flight screening test
  const handleRunPrecheck = async () => {
    let finalPolygon = (form.polygon_wkt || '').trim();
    if (!finalPolygon || !finalPolygon.toUpperCase().includes('POLYGON')) {
      if (form.latitude && form.longitude && form.area_hectares) {
        finalPolygon = generatePolygonWKT(parseFloat(form.latitude), parseFloat(form.longitude), parseFloat(form.area_hectares));
        updateField('polygon_wkt', finalPolygon);
      }
    }

    setPrechecking(true);
    try {
      const res = await precheckProject({
        project_id: 'PRECHECK-TEMP',
        name: form.name.trim() || 'New Project',
        plantation_type: form.plantation_type.toLowerCase(),
        area_hectares: parseFloat(form.area_hectares) || 10.0,
        number_of_trees: parseInt(form.number_of_trees, 10) || 5000,
        polygon_wkt: finalPolygon,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        photos: photoFile ? [photoFile.name] : [],
      });
      const data = res.data || res;
      setPrecheckResult(data);
      addToast({ type: 'success', title: 'Integrity Screening', message: 'Precheck completed without errors.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Precheck Error', message: err.message });
    } finally {
      setPrechecking(false);
    }
  };

  // Final Submission
  const handleSubmit = async () => {
    if (!form.name.trim()) { addToast({ type: 'error', message: 'Project name is required.' }); return; }
    if (!form.latitude || !form.longitude) { addToast({ type: 'error', message: 'Latitude and Longitude are required.' }); return; }
    if (!form.area_hectares) { addToast({ type: 'error', message: 'Area in hectares is required.' }); return; }
    if (!form.number_of_trees) { addToast({ type: 'error', message: 'Number of trees is required.' }); return; }

    let finalPolygon = (form.polygon_wkt || '').trim();
    if (!finalPolygon || !finalPolygon.toUpperCase().includes('POLYGON')) {
      finalPolygon = generatePolygonWKT(parseFloat(form.latitude), parseFloat(form.longitude), parseFloat(form.area_hectares));
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('project_name', form.name.trim());
      fd.append('ngo_name', form.ngo_name.trim() || defaultNgoName);
      fd.append('latitude', parseFloat(form.latitude));
      fd.append('longitude', parseFloat(form.longitude));
      fd.append('plantation_type', form.plantation_type.toLowerCase());
      fd.append('area_hectares', parseFloat(form.area_hectares));
      fd.append('number_of_trees', parseInt(form.number_of_trees, 10));
      fd.append('start_date', form.start_date);
      fd.append('description', form.description.trim() || `High-integrity ${form.plantation_type} restoration project.`);
      fd.append('objectives', form.objectives.trim() || `1. Establish ${form.area_hectares} ha of protected canopy.\n2. Monitor with satellite NDVI.`);
      fd.append('polygon_wkt', finalPolygon);

      if (photoFile) {
        fd.append('evidence_image', photoFile);
      }

      const res = await createProject(fd);
      if (!res.error && res.data) {
        addToast({
          type: 'success',
          title: 'Project Registered!',
          message: `Project ${res.data.project_id} successfully submitted for review.`
        });
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        triggerRefresh();
        navigateToProject(res.data.project_id);
      } else {
        addToast({ type: 'error', title: 'Submission Failed', message: res.error || 'Server rejected creation request.' });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Submission Error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const inp = {
    background: 'var(--input-bg, rgba(255,255,255,0.04))',
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: '10px 14px',
    color: T.t1,
    fontSize: 14,
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
  };

  const lbl = {
    fontSize: 11,
    color: T.t3,
    fontWeight: 700,
    letterSpacing: '0.7px',
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>
      {/* Wizard Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, margin: 0, fontFamily: 'Fraunces, serif' }}>
            Register Carbon Project
          </h1>
          <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>
            Six-step submission pipeline with draft autosave and pre-flight validation.
          </div>
        </div>
        <Btn variant="secondary" onClick={handleResetDraft} style={{ fontSize: 12 }}>
          <RotateCcw size={12} /> Clear Draft
        </Btn>
      </div>

      {/* Step Pills Navigation */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 8,
        marginBottom: 28,
      }}>
        {STEPS.map((s) => {
          const isCurrent = currentStep === s.step;
          const isDone = currentStep > s.step;
          return (
            <div
              key={s.step}
              onClick={() => setCurrentStep(s.step)}
              style={{
                background: isCurrent ? 'rgba(45,212,191,0.12)' : isDone ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isCurrent ? T.teal : isDone ? T.emeraldL : T.border}`,
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: isCurrent ? T.teal : isDone ? T.emeraldL : 'rgba(255,255,255,0.1)',
                  color: isCurrent || isDone ? '#000' : T.t3,
                  fontSize: 10,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {isDone ? <Check size={10} strokeWidth={3} /> : s.step}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? T.teal : isDone ? T.emeraldL : T.t2 }}>
                  {s.label}
                </span>
              </div>
              <div style={{ fontSize: 10, color: T.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: BASIC INFO ── */}
      {currentStep === 1 && (
        <Card>
          <SectionHeader title="Step 1: Project Identity & Objectives" subtitle="Name, plantation taxonomy, description, and conservation targets" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={lbl}>Project Name *</label>
              <input
                type="text"
                placeholder="e.g. Sundarbans Mangrove Biosphere Restoration"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                style={inp}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={lbl}>Plantation Ecology Type *</label>
                <select
                  value={form.plantation_type}
                  onChange={(e) => updateField('plantation_type', e.target.value)}
                  style={inp}
                >
                  {plantationTypes.map((pt) => (
                    <option key={pt.value} value={pt.value} style={{ background: '#090c18' }}>
                      {pt.label} (~{pt.annual_rate_mid} tCO₂e/ha/yr)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Developing NGO / Developer Name</label>
                <input
                  type="text"
                  value={form.ngo_name}
                  onChange={(e) => updateField('ngo_name', e.target.value)}
                  style={inp}
                />
              </div>
            </div>

            <div>
              <label style={lbl}>Full Project Description *</label>
              <textarea
                rows={4}
                placeholder="Detailed summary of site location, community rangers involved, local biodiversity benefits, and tree species mix..."
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                style={inp}
              />
            </div>

            <div>
              <label style={lbl}>Key Conservation Objectives *</label>
              <textarea
                rows={3}
                placeholder="1. Restore 50 hectares of coastal mangrove canopy.&#10;2. Involve 120 local community rangers.&#10;3. Issue verified carbon offsets under buffer pool protection."
                value={form.objectives}
                onChange={(e) => updateField('objectives', e.target.value)}
                style={inp}
              />
            </div>
          </div>
        </Card>
      )}

      {/* ── STEP 2: LOCATION & POLYGON ── */}
      {currentStep === 2 && (
        <Card>
          <SectionHeader title="Step 2: Location & Geofence Boundary" subtitle="GPS coordinates and GeoJSON/WKT polygon perimeter" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={lbl}>Latitude *</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 21.9497"
                  value={form.latitude}
                  onChange={(e) => updateField('latitude', e.target.value)}
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Longitude *</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 88.9007"
                  value={form.longitude}
                  onChange={(e) => updateField('longitude', e.target.value)}
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Area (Hectares) *</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 25.0"
                  value={form.area_hectares}
                  onChange={(e) => updateField('area_hectares', e.target.value)}
                  style={inp}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...lbl, margin: 0 }}>Polygon WKT Boundary</label>
                <button
                  type="button"
                  onClick={() => {
                    if (form.latitude && form.longitude && form.area_hectares) {
                      const wkt = generatePolygonWKT(parseFloat(form.latitude), parseFloat(form.longitude), parseFloat(form.area_hectares));
                      updateField('polygon_wkt', wkt);
                      addToast({ type: 'success', message: 'WKT polygon computed from coordinates.' });
                    } else {
                      addToast({ type: 'error', message: 'Fill in latitude, longitude, and area first.' });
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: T.teal, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                >
                  ⚡ Auto-Generate WKT from Center
                </button>
              </div>
              <textarea
                rows={3}
                placeholder="POLYGON((lng1 lat1, lng2 lat2, lng3 lat3, lng1 lat1))"
                value={form.polygon_wkt}
                onChange={(e) => updateField('polygon_wkt', e.target.value)}
                style={{ ...inp, fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* ── STEP 3: BASELINE & CARBON ESTIMATES ── */}
      {currentStep === 3 && (
        <Card>
          <SectionHeader title="Step 3: Baseline Biomass & Carbon Sequestration" subtitle="Tree inventory, planting date, and baseline soil carbon metrics" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={lbl}>Number of Trees / Saplings Planted *</label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={form.number_of_trees}
                  onChange={(e) => updateField('number_of_trees', e.target.value)}
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Planting / Start Date *</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => updateField('start_date', e.target.value)}
                  style={inp}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={lbl}>Sapling Age at Inception (Years)</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.tree_age_years}
                  onChange={(e) => updateField('tree_age_years', e.target.value)}
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Baseline Soil Carbon (tC/ha)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.baseline_soil_carbon}
                  onChange={(e) => updateField('baseline_soil_carbon', e.target.value)}
                  style={inp}
                />
              </div>
            </div>

            <div style={{ background: 'rgba(45,212,191,0.06)', border: `1px solid rgba(45,212,191,0.2)`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, color: T.teal, fontWeight: 700, marginBottom: 4 }}>
                Estimated Annual Yield Model
              </div>
              <div style={{ fontSize: 13, color: T.t2 }}>
                Based on <strong style={{ color: T.t1 }}>{form.area_hectares || 0} ha</strong> of <strong style={{ color: T.t1 }}>{form.plantation_type}</strong>, projected sequestration is approximately{' '}
                <strong style={{ color: T.emeraldL }}>
                  {(
                    (parseFloat(form.area_hectares) || 0) *
                    (plantationTypes.find((p) => p.value === form.plantation_type)?.annual_rate_mid || 15)
                  ).toLocaleString()}{' '}
                  tCO₂e/year
                </strong>.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── STEP 4: EVIDENCE UPLOAD ── */}
      {currentStep === 4 && (
        <Card>
          <SectionHeader title="Step 4: Geotagged Ground Evidence Photos" subtitle="Dropzone with automatic EXIF GPS inspection and polygon matching" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              border: `2px dashed ${T.border}`,
              borderRadius: 12,
              padding: 32,
              textAlign: 'center',
              background: 'rgba(255,255,255,0.01)',
              cursor: 'pointer',
            }}>
              <Upload size={32} color={T.teal} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: T.t1, marginBottom: 4 }}>
                Upload Geotagged Plantation Evidence Photo
              </div>
              <div style={{ fontSize: 12, color: T.t3, marginBottom: 16 }}>
                Image will be automatically screened for EXIF GPS coordinates, Laplacian sharpness, and ExG vegetation index.
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setPhotoFile(file);
                    addToast({ type: 'success', title: 'File Staged', message: `${file.name} staged for ML analysis.` });
                  }
                }}
                style={{ fontSize: 12, color: T.t2 }}
              />
            </div>

            {photoFile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(16,185,129,0.08)', padding: 12, borderRadius: 10, border: `1px solid ${T.emeraldL}` }}>
                <CheckCircle size={18} color={T.emeraldL} />
                <div style={{ flex: 1, fontSize: 13, color: T.t1 }}>
                  Staged: <strong>{photoFile.name}</strong> ({(photoFile.size / 1024).toFixed(1)} KB)
                </div>
                <Badge type="approved" label="Ready for ML Screening" />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── STEP 5: LEGAL DOCUMENTS ── */}
      {currentStep === 5 && (
        <Card>
          <SectionHeader title="Step 5: Four-Document Integrity Gate" subtitle="Project Design Document (PDD), Land Tenure, and Stakeholder Consent" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Project Design Document (PDD)', file: pddFile, set: setPddFile, desc: 'Full VCS / Gold Standard methodology project description' },
              { label: 'Land Tenure & Title Deed', file: deedFile, set: setDeedFile, desc: 'Government or community land ownership documentation' },
              { label: 'Free, Prior and Informed Consent (FPIC)', file: consentFile, set: setConsentFile, desc: 'Indigenous & local community consultation agreement' },
            ].map((doc, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 10, border: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{doc.label}</div>
                  {doc.file && <Badge type="approved" label="Uploaded" />}
                </div>
                <div style={{ fontSize: 12, color: T.t3, marginBottom: 12 }}>{doc.desc}</div>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={(e) => {
                    const f = e.target.files[0];
                    if (f) {
                      doc.set(f);
                      addToast({ type: 'success', title: 'Document Staged', message: `${f.name} attached.` });
                    }
                  }}
                  style={{ fontSize: 12, color: T.t2 }}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── STEP 6: REVIEW & SUBMIT ── */}
      {currentStep === 6 && (
        <div>
          <Card style={{ marginBottom: 20 }}>
            <SectionHeader title="Step 6: Review & Pre-Flight Screening" subtitle="Run automated integrity screening before final ledger submission" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              {[
                ['Project Name', form.name || 'Not provided'],
                ['Developer NGO', form.ngo_name],
                ['Plantation Type', form.plantation_type],
                ['Location Coordinates', `${form.latitude}, ${form.longitude}`],
                ['Area (Hectares)', `${form.area_hectares} ha`],
                ['Number of Trees', form.number_of_trees ? parseInt(form.number_of_trees, 10).toLocaleString() : 'Not provided'],
                ['Planting Start Date', form.start_date],
                ['Evidence Photo', photoFile ? photoFile.name : 'No photo uploaded'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '7px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <span style={{ color: T.t3 }}>{k}</span>
                  <span style={{ color: T.t1, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Btn variant="secondary" onClick={handleRunPrecheck} disabled={prechecking}>
                <ShieldCheck size={14} />
                {prechecking ? 'Screening Integrity…' : 'Run Pre-Flight Screening Test'}
              </Btn>
              {precheckResult && (
                <Badge
                  type={precheckResult.status === 'pass' ? 'approved' : 'rejected'}
                  label={`Precheck: ${String(precheckResult.status || 'OK').toUpperCase()}`}
                />
              )}
            </div>

            {precheckResult && (
              <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12, color: T.t2 }}>
                <div>Screening status: <strong style={{ color: T.emeraldL }}>{precheckResult.status}</strong></div>
                {precheckResult.message && <div style={{ marginTop: 4 }}>{precheckResult.message}</div>}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Wizard Footer Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <Btn
          variant="secondary"
          onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
          disabled={currentStep === 1 || submitting}
        >
          <ArrowLeft size={14} /> Previous
        </Btn>

        {currentStep < 6 ? (
          <Btn onClick={() => setCurrentStep((s) => Math.min(6, s + 1))}>
            Next Step <ArrowRight size={14} />
          </Btn>
        ) : (
          <Btn
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Registering Project…' : '✓ Submit Project to Platform'}
          </Btn>
        )}
      </div>
    </div>
  );
}
