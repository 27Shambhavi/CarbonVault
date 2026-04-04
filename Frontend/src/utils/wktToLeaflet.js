/**
 * Minimal WKT POLYGON → Leaflet-style rings [[[lat, lng], ...], ...]
 * Supports one outer ring; ignores holes. For preview/drawing validation only.
 */

export function wktPolygonToLeafletRings(wkt) {
  if (!wkt || typeof wkt !== 'string') return [];
  const t = wkt.trim();
  if (!/^POLYGON/i.test(t)) return [];

  const inner = t
    .replace(/^POLYGON\s*\(\s*\(/i, '')
    .replace(/\)\s*\)\s*$/i, '');

  const ringStrs = inner.split(/\)\s*,\s*\(/);
  const rings = [];
  for (const rs of ringStrs) {
    const pts = rs.split(',').map((pair) => {
      const parts = pair.trim().split(/\s+/).filter(Boolean);
      if (parts.length < 2) return null;
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
      return [lat, lon];
    }).filter(Boolean);
    if (pts.length >= 3) rings.push(pts);
  }
  return rings;
}
