declare module 'geojson-world-map' {
  const data: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      properties: Record<string, unknown>;
      geometry: GeoJSON.Geometry;
    }>;
  };

  export default data;
}
