import { Point } from "./geom";

const MAX_LATITUDE = 85.0511287798;
export function mercatorToWGS84(latlon: GeoJSON.Position, zoom: number): Point {
  const lon = latlon[0];
  const lat = latlon[1];
  if (lat > MAX_LATITUDE || lat < -MAX_LATITUDE) {
    throw new Error(`Latitude must be between -${MAX_LATITUDE} and ${MAX_LATITUDE}`);
  }

  const scale = 256 * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);

  return new Point(
    scale * (0.5 * (lon / 180) + 0.5),
    scale * ((-0.5 / Math.PI) * (Math.log((1 + sin) / (1 - sin)) / 2) + 0.5),
  );
}

function normalizedXToLongitude(nx: number) {
  return 360 * nx - 180;
}

function normalizedYToLatitude(ny: number) {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * ny))) * 180) / Math.PI;
}

export function bboxForTile(x: number, y: number, z: number, padding: number): GeoJSON.BBox {
  const totalNumPixelsY = 256 * 2 ** z;
  const totalNumPixelsX = 256 * 2 ** z;

  const boxNormalizedPosition = [
    (x * 256 - padding) / totalNumPixelsX,
    (y * 256 - padding) / totalNumPixelsY,
    ((x + 1) * 256 + padding) / totalNumPixelsX,
    ((y + 1) * 256 + padding) / totalNumPixelsY,
  ];

  return [
    normalizedXToLongitude(boxNormalizedPosition[0]),
    normalizedYToLatitude(boxNormalizedPosition[3]),
    normalizedXToLongitude(boxNormalizedPosition[2]),
    normalizedYToLatitude(boxNormalizedPosition[1]),
  ];
}
