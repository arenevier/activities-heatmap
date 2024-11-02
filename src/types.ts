/**
 * This is the interface of the object providing the activities data. The
 * data source must have the knowledge of activities, and be able to return the
 * a list of paths in a given bounding box.
 */
export type ActivitiesFilter = Readonly<{
  startDate?: Date;
  endDate?: Date;
}>;
export interface ActivitiesSource {
  /**
   * Get all paths in a given bounding box.
   * @param boundingBox - The bounding box to search for paths.
   * @param filter - An optional filter object to filter the paths.  The filters
   * are datasource specific. Typically, filtering by date will be implemented.
   * Other types of filters can be added, such as sport type.
   * @returns Promise<Array<Array<GeoJSON.Position>>> - A list of paths.
   */
  getAllPathsInBounds: (boundingBox: GeoJSON.BBox, filter?: any) => Promise<Array<Array<GeoJSON.Position>>>;
}

/**
 * RGBA color type.
 */
export type Color = Readonly<[number, number, number, number]>;
export type RenderingOptions = Readonly<{
  /**
   * number of times a path must have been taken, to use the max color.
   * @default 25
   */
  valueForMaxColor?: number;
  /**
   * width of each path in pixels.
   * @default 2
   */
  lineWidth?: number;
  /**
   * gradient colors to use for the heatmap.
   */
  gradientColors?: Color[];
}>;
