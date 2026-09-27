import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, CircleMarker, useMap } from 'react-leaflet';
import { latLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { T } from '../UI.jsx';
import { useApp } from '../../AppContext.jsx';
import { wktPolygonToLeafletRings } from '../../utils/wktToLeaflet.js';
import { geojsonToLeafletPolygonPositions } from './geojsonLeaflet.js';

/** react-leaflet expects [lat, lng]; bounds.getCenter() returns a LatLng instance. */
function toTuple(c) {
  if (!c) return [10, 20];
  if (Array.isArray(c) && c.length >= 2) return [Number(c[0]), Number(c[1])];
  const lat = c.lat ?? c[0];
  const lng = c.lng ?? c[1];
  if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat + lng)) {
    return [lat, lng];
  }
  return [10, 20];
}

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function statusStyle(status, selected, adminMode) {
  const s = (status || 'pending').toLowerCase();
  const base = { fillOpacity: 0.38, weight: 2 };
  if (s === 'approved') {
    return {
      ...base,
      color: selected ? '#34d399' : '#16a34a',
      fillColor: '#22c55e',
      weight: selected ? 4 : 2,
    };
  }
  if (s === 'rejected') {
    return {
      ...base,
      color: selected ? '#fb7185' : '#e11d48',
      fillColor: '#f43f5e',
      weight: selected ? 4 : 2,
    };
  }
  /* pending */
  return {
    ...base,
    color: selected ? '#facc15' : adminMode ? '#ca8a04' : '#eab308',
    fillColor: '#eab308',
    weight: adminMode ? (selected ? 5 : 4) : selected ? 4 : 3,
  };
}

function extendBoundsFromPolygonSpecs(bounds, polygonSpecs) {
  for (const rings of polygonSpecs) {
    for (const ring of rings) {
      for (const [lat, lng] of ring) {
        bounds.extend([lat, lng]);
      }
    }
  }
}

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14, animate: false });
    }
  }, [map, bounds]);
  return null;
}

/**
 * Interactive Leaflet map for plantation polygons.
 *
 * @param {Array} features - API items: { id, name, ngo_name, polygon, status, area }
 * @param {Array} projects - Legacy point markers: { id, lat, lng, status, name }
 * @param {string} previewWkt - WKT POLYGON drawn in NGO form (preview layer)
 * @param {string} selectedId - Highlight + open popup for this project id
 * @param {function} onFeatureSelect - (id) => void when polygon clicked
 * @param {boolean} adminMode - Thicker pending borders (yellow)
 * @param {number} height
 */
export function ProjectMap({
  features = [],
  projects = [],
  previewWkt = '',
  selectedId = null,
  onFeatureSelect,
  adminMode = false,
  height = 380,
  showLegend = true,
}) {
  const { bounds, center, zoom } = useMemo(() => {
    const b = latLngBounds([]);
    let has = false;

    for (const f of features) {
      if (!f.polygon) continue;
      const specs = geojsonToLeafletPolygonPositions(f.polygon);
      if (specs.length) {
        extendBoundsFromPolygonSpecs(b, specs);
        has = true;
      }
    }

    const previewRings = wktPolygonToLeafletRings(previewWkt);
    if (previewRings.length) {
      for (const ring of previewRings) {
        for (const [lat, lng] of ring) {
          b.extend([lat, lng]);
        }
      }
      has = true;
    }

    for (const p of projects) {
      const lat = parseFloat(p.lat);
      const lng = parseFloat(p.lng);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        b.extend([lat, lng]);
        has = true;
      }
    }

    if (has) {
      if (b.isValid()) {
        return { bounds: b, center: toTuple(b.getCenter()), zoom: 2 };
      }
      const c = b.getCenter();
      if (c && !Number.isNaN(c.lat)) {
        return { bounds: null, center: toTuple(c), zoom: 11 };
      }
    }
    return { bounds: null, center: [10, 20], zoom: 2 };
  }, [features, projects, previewWkt]);

  const onEachClick = useCallback(
    (id) => {
      if (typeof onFeatureSelect === 'function') onFeatureSelect(id);
    },
    [onFeatureSelect]
  );

  // Leaflet + React 18 Strict Mode: initialize only after mount so the map is not torn down mid-init.
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    setMapReady(true);
  }, []);

  const appContext = useApp();
  const theme = appContext?.theme || 'dark';

  const centerTuple = toTuple(center);

  const shellStyle = {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    background: 'var(--bg2, #0d1120)',
    border: `1px solid ${T.border}`,
    height,
  };

  if (!mapReady) {
    return (
      <div
        style={{
          ...shellStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: T.t3,
          fontSize: 12,
        }}
      >
        Loading map…
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <MapContainer
        center={centerTuple}
        zoom={zoom ?? 2}
        style={{ height: '100%', width: '100%', background: 'var(--bg2, #0d1120)' }}
        scrollWheelZoom
        worldCopyJump
      >
        <TileLayer attribution={TILE_ATTRIB} url={TILE_URL} maxZoom={19} />
        {bounds && <FitBounds bounds={bounds} />}

        {features.flatMap((f) => {
          const specs = geojsonToLeafletPolygonPositions(f.polygon);
          if (!specs.length) return [];
          const sel = f.id === selectedId;
          const st = statusStyle(f.status, sel, adminMode);
          return specs.map((positions, idx) => (
            <Polygon
              key={`${f.id}-${idx}`}
              positions={positions}
              pathOptions={st}
              eventHandlers={{
                click: () => onEachClick(f.id),
              }}
            >
              <Popup>
                <div style={{ minWidth: 200, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{f.name}</div>
                  <div style={{ color: '#444', marginBottom: 4 }}>
                    <strong>NGO:</strong> {f.ngo_name || '—'}
                  </div>
                  <div style={{ color: '#444', marginBottom: 4 }}>
                    <strong>Status:</strong> {(f.status || '—').toString()}
                  </div>
                  {f.area?.hectares != null && (
                    <div style={{ color: '#444', marginBottom: 4 }}>
                      <strong>Area:</strong> {Number(f.area.hectares).toFixed(3)} ha
                      {f.area.sq_meters != null && (
                        <span style={{ fontSize: 11, display: 'block', color: '#666' }}>
                          ({Math.round(f.area.sq_meters).toLocaleString()} m²)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Popup>
            </Polygon>
          ));
        })}

        {wktPolygonToLeafletRings(previewWkt).map((ring, i) => (
          <Polygon
            key={`preview-${i}`}
            positions={ring}
            pathOptions={{
              color: '#2dd4bf',
              fillColor: '#14b8a6',
              weight: 2,
              dashArray: '6 8',
              fillOpacity: 0.25,
            }}
          />
        ))}

        {projects.map((p) => {
          const lat = parseFloat(p.lat);
          const lng = parseFloat(p.lng);
          if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
          const color =
            p.status === 'approved' ? '#34d399' : p.status === 'rejected' ? '#fb7185' : '#facc15';
          return (
            <CircleMarker
              key={p.id || `${lat}-${lng}`}
              center={[lat, lng]}
              radius={8}
              pathOptions={{ color: '#0c1020', weight: 2, fillColor: color, fillOpacity: 0.9 }}
            >
              {p.name && (
                <Popup>
                  <strong>{p.name}</strong>
                  <div style={{ fontSize: 12 }}>{p.status}</div>
                </Popup>
              )}
            </CircleMarker>
          );
        })}
      </MapContainer>

      {showLegend && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            display: 'flex',
            gap: 14,
            background: theme === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(8,11,18,0.92)',
            borderRadius: 8,
            padding: '7px 12px',
            border: `1px solid ${T.border}`,
            zIndex: 1000,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {[
            ['Approved', T.emeraldL],
            ['Pending', T.goldL],
            ['Rejected', T.roseL],
          ].map(([label, c]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: c,
                  boxShadow: `0 0 5px ${c}`,
                }}
              />
              <span style={{ fontSize: 10, color: T.t3, fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
