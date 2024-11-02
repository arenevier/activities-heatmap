import { drawPathAntialiased } from "./draw-path";

import { simplifyDP } from "./douglas-peucker";
import { Point } from "./geom";
import { mercatorToWGS84 } from "./tile-utils";
import type { Color, RenderingOptions } from "./types";

function simplifyPath(points: Array<Point>): Array<Point> {
  if (points.length === 0) {
    return points;
  }

  // first, remove repeated points
  const simplified = [points[0]];
  for (let i = 1; i < points.length; i++) {
    // we assume points coordinates are integers
    if (points[i].equals(simplified[simplified.length - 1])) {
      continue;
    }
    simplified.push(points[i]);
  }

  return simplifyDP(simplified, 1);
}

function normalize(value: number, options: Required<RenderingOptions>): Color {
  const numColors = options.gradientColors.length;
  const ratio = Math.min(value / options.valueForMaxColor, 1) * (numColors - 1);
  const lowerIndex = Math.floor(ratio);
  const upperIndex = Math.ceil(ratio);
  const lowerColor = options.gradientColors[lowerIndex];
  const upperColor = options.gradientColors[upperIndex];

  const blendRatio = ratio - lowerIndex;

  return [
    Math.round(lowerColor[0] + (upperColor[0] - lowerColor[0]) * blendRatio),
    Math.round(lowerColor[1] + (upperColor[1] - lowerColor[1]) * blendRatio),
    Math.round(lowerColor[2] + (upperColor[2] - lowerColor[2]) * blendRatio),
    Math.round(lowerColor[3] + (upperColor[3] - lowerColor[3]) * blendRatio),
  ];
}

export function rasterizePaths(
  paths: GeoJSON.Position[][],
  x: number,
  y: number,
  z: number,
  options: Required<RenderingOptions>,
) {
  const bitmap = new Uint8Array(256 * 256 * 4);
  const padding = Math.ceil(options.lineWidth / 2);
  const width = 256 + padding * 2;
  const height = 256 + padding * 2;
  const grid = new Float32Array(width * height);

  for (const path of paths) {
    if (path.length === 0) {
      continue;
    }
    if (path.length === 1) {
      throw new Error("path length should be greater than 1");
    }
    const drawnPath: Point[] = [];
    for (const coord of path) {
      const point = mercatorToWGS84(coord, z);
      const xpos = Math.round(point.x) - x * 256 + padding;
      const ypos = Math.round(point.y) - y * 256 + padding;

      if (xpos < 0 || xpos > 256 + 2 * padding || ypos < 0 || ypos > 256 + 2 * padding) {
        throw new Error("out of bounds");
      }
      drawnPath.push(new Point(xpos, ypos));
    }

    const simplifiedPath = simplifyPath(drawnPath);
    drawPathAntialiased(simplifiedPath, options.lineWidth, grid, width, height);
  }

  for (let i = 0; i < 256; i++) {
    for (let j = 0; j < 256; j++) {
      const stride = 256 + 2 * padding;
      const value = grid[(i + padding) * stride + (j + padding)];
      if (value === 0) {
      } else {
        const color = normalize(value, options);
        bitmap[(i * 256 + j) * 4 + 0] = color[0];
        bitmap[(i * 256 + j) * 4 + 1] = color[1];
        bitmap[(i * 256 + j) * 4 + 2] = color[2];
        bitmap[(i * 256 + j) * 4 + 3] = color[3];
      }
    }
  }

  return bitmap;
}
