import { Line, Point, Polygon, Vector } from "./geom";

// This transform a path into a polygon with a given width. We want each
// segment to attach to the next segment. So we have to take the angle
// between two segments, and take the bisector of this angle. This will
// allow us to find the position of the polygon edge.
//
//  -----------------,   x
//                  . \
//  -------------x    /
//              /    /
//             /    /
//            /    /
function createPolygonsForPath(path: Point[], width: number) {
  if (path.length < 2) {
    throw new Error("path must contain at least two points");
  }

  const polygons: Polygon[] = [];

  let previousLeftCorner: Point | null = null;
  let previousRightCorner: Point | null = null;
  for (let i = 0; i < path.length; i++) {
    const previousPoint = path[i - 1];
    const currentPoint = path[i];
    const nextPoint = path[i + 1];

    let v1;
    let v2;
    if (previousPoint == null) {
      v1 = new Vector(nextPoint.x - currentPoint.x, nextPoint.y - currentPoint.y);
    } else {
      v1 = new Vector(previousPoint.x - currentPoint.x, previousPoint.y - currentPoint.y);
    }

    if (nextPoint == null) {
      v2 = new Vector(currentPoint.x - previousPoint.x, currentPoint.y - previousPoint.y);
    } else {
      v2 = new Vector(nextPoint.x - currentPoint.x, nextPoint.y - currentPoint.y);
    }

    const v1Norm = v1.normalize();
    const v2Norm = v2.normalize();
    const line1 = new Line(currentPoint, previousPoint);
    const line2 = new Line(currentPoint, nextPoint);
    const determinant = v1.determinant(v2);

    if (determinant === 0 || Number.isNaN(determinant)) {
      // parallel segments
      const orthogonal = new Vector(v2Norm.y, -v2Norm.x); // 90 rotation counter clockwise

      const leftCorner = new Point(
        currentPoint.x + (orthogonal.x * width) / 2,
        currentPoint.y + (orthogonal.y * width) / 2,
      );
      const rightCorner = new Point(
        currentPoint.x - (orthogonal.x * width) / 2,
        currentPoint.y - (orthogonal.y * width) / 2,
      );
      if (previousLeftCorner != null && previousRightCorner != null) {
        // segment in edges are oriented clockwise
        polygons.push(new Polygon([previousRightCorner, previousLeftCorner, leftCorner, rightCorner]));
      }
      previousLeftCorner = leftCorner;
      previousRightCorner = rightCorner;
    } else {
      const bisector = v1Norm.add(v2Norm).normalize();

      const cosT = v1Norm.dot(bisector);
      const sinT = Math.sqrt(1 - cosT ** 2);

      // if the angle is too small, corner can be pretty far. Need to make sure it's not farther than neighbor points.
      const d = Math.min(v1.length(), v2.length(), width / 2 / sinT);
      // segment1 and segment2 intersect
      const insideCorner = new Point(currentPoint.x + bisector.x * d, currentPoint.y + bisector.y * d);

      // segment1 and segment2 do not intersect
      const outsideCorner1 = line1.symmetricPoint(insideCorner);
      const outsideCorner2 = line2.symmetricPoint(insideCorner);

      if (determinant < 0) {
        // v2 to the right of v1
        if (previousLeftCorner != null && previousRightCorner != null) {
          // oriented clockwise
          polygons.push(new Polygon([previousRightCorner, previousLeftCorner, outsideCorner1, insideCorner]));
          // bevel join
          polygons.push(new Polygon([currentPoint, outsideCorner1, outsideCorner2]));
        }
        previousRightCorner = insideCorner;
        previousLeftCorner = outsideCorner2;
      } else if (determinant > 0) {
        // v2 to the left of v1
        if (previousLeftCorner != null && previousRightCorner != null) {
          // oriented clockwise
          polygons.push(new Polygon([previousRightCorner, previousLeftCorner, insideCorner, outsideCorner1]));
          // bevel join
          polygons.push(new Polygon([currentPoint, outsideCorner2, outsideCorner1]));
        }
        previousRightCorner = outsideCorner2;
        previousLeftCorner = insideCorner;
      }
    }
  }

  return polygons;
}

function getCoverageForCoord(polygon: Polygon, x: number, y: number) {
  const miniBounds = { minX: x - 0.5, maxX: x + 0.5, minY: y - 0.5, maxY: y + 0.5 };
  const clipped = polygon.clip(miniBounds);
  return clipped.area();
}

export function drawPathAntialiased(
  path: Point[],
  lineWidth: number,
  grid: Float32Array,
  width: number,
  height: number,
) {
  const putPixel = (x: number, y: number, alpha: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }
    grid[x + y * width] += alpha;
  };

  if (path.length === 0) {
    return;
  }

  if (path.length === 1) {
    putPixel(path[0].x, path[0].y, 1);
    return;
  }

  const polygons = createPolygonsForPath(path, lineWidth);
  for (const polygon of polygons) {
    const bounds = polygon.bounds();

    const steep = bounds.maxY - bounds.minY > bounds.maxX - bounds.minX;

    if (steep) {
      for (let x = Math.floor(bounds.minX); x < Math.ceil(bounds.maxX) + 1; x++) {
        for (let y1 = Math.floor(bounds.minY); y1 < Math.ceil(bounds.maxY) + 1; y1++) {
          const area = getCoverageForCoord(polygon, x, y1);
          putPixel(x, y1, area);
          // The polygons are convex quadrilaters. So there are two edges per line. If
          // one pixel is fully covered, it's on edge. So we look for the other edge starting
          // from the other side. If we find it, we don't need to compute coverage for pixels
          // in between
          if (area === 1) {
            for (let y2 = Math.ceil(bounds.maxY); y2 > y1; y2--) {
              const area = getCoverageForCoord(polygon, x, y2);
              putPixel(x, y2, area);
              if (area === 1) {
                for (let y = y1 + 1; y < y2; y++) {
                  putPixel(x, y, 1);
                }
                break;
              }
            }
            break;
          }
        }
      }
    } else {
      for (let y = Math.floor(bounds.minY); y < Math.ceil(bounds.maxY) + 1; y++) {
        for (let x1 = Math.floor(bounds.minX); x1 < Math.ceil(bounds.maxX) + 1; x1++) {
          const area = getCoverageForCoord(polygon, x1, y);
          putPixel(x1, y, area);
          // The polygons are convex quadrilaters. So there are two edges per line. If
          // one pixel is fully covered, it's on edge. So we look for the other edge starting
          // from the other side. If we find it, we don't need to compute coverage for pixels
          // in between
          if (area === 1) {
            for (let x2 = Math.ceil(bounds.maxX); x2 > x1; x2--) {
              const area = getCoverageForCoord(polygon, x2, y);
              putPixel(x2, y, area);
              if (area === 1) {
                for (let x = x1 + 1; x < x2; x++) {
                  putPixel(x, y, 1);
                }
                break;
              }
            }
            break;
          }
        }
      }
    }
  }
}
