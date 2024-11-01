import { rasterizePaths } from "./rasterize";
import { bboxForTile } from "./tile-utils";

import type { ActivitiesFilter, ActivitiesSource, RenderingOptions } from "./types";

const defaultOptions: Required<RenderingOptions> = {
  valueForMaxColor: 25,
  lineWidth: 2,
  gradientColors: [
    // #4B0082: 0%
    [0x4b, 0x00, 0x82, 130] as const,
    // #B22222: 20%
    [0xb2, 0x22, 0x22, 155] as const,
    // #FF0000: 40%
    [0xff, 0x00, 0x00, 180] as const,
    // #FF4500: 60%
    [0xff, 0x45, 0x00, 205] as const,
    // #FF6900: 80%
    [0xff, 0x69, 0x00, 230] as const,
    // #FFFFE0: 100%
    [0xff, 0xff, 0xe0, 255] as const,
  ],
};

/**
 * class in charge of producing heatmaps.
 */
export class HeatmapProducer {
  #datasource: ActivitiesSource;
  /**
   * Create a new Heatmap object.
   * @param datasource - An object that implements the ActivitiesSource interface.
   */
  constructor(datasource: ActivitiesSource) {
    this.#datasource = datasource;
  }

  /**
   * Generate heatmap for a tile.
   *
   * @param x - The x coordinate of the tile.
   * @param y - The y coordinate of the tile.
   * @param z - The zoom level of the tile.
   * Coordinates respect XYZ standard implemented in OpenLayers, Leaflet, Mapbox, etc.
   *
   * @param datasource - An object that implements the ActivitiesSource interface.
   * @param renderingOptions
   *
   * @returns Promise<Uint8Array> - A 256x256 RGBA bitmap representing the heatmap.
   */
  async BitmapForTile(args: {
    x: number;
    y: number;
    z: number;
    renderingOptions?: RenderingOptions;
    activitiesFilter?: ActivitiesFilter;
  }): Promise<Uint8Array> {
    const { x, y, z, renderingOptions, activitiesFilter } = args;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
      throw new Error("x, y, and z must be integers");
    }
    if (x < 0 || y < 0 || z < 0) {
      throw new Error("x, y, and z must be positive integers");
    }
    const options = Object.assign({}, defaultOptions, renderingOptions);
    const padding = Math.ceil(options.lineWidth / 2);
    const bounds = bboxForTile(x, y, z, padding);
    const paths = await this.#datasource.getAllPathsInBounds(bounds, activitiesFilter);
    const bitmap = rasterizePaths(paths, x, y, z, options);
    return bitmap;
  }
}
