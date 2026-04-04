/**
 * GeoJSON Polygon / MultiPolygon → list of Leaflet `positions` args
 * (each entry: one polygon as [outerRing, ...holeRings] in lat/lng).
 */
export function geojsonToLeafletPolygonPositions(geometry) {
  if (!geometry || !geometry.type) return [];
  const flipRing = (ring) =>
    (ring || [])
      .map(([lng, lat]) => [Number(lat), Number(lng)])
      .filter(([la, ln]) => !Number.isNaN(la) && !Number.isNaN(ln));
  if (geometry.type === 'Polygon') {
    const rings = (geometry.coordinates || []).map(flipRing);
    return rings.length ? [rings] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates || []).map((poly) => (poly || []).map(flipRing)).filter((r) => r.length);
  }
  return [];
}
