import zlib from "node:zlib";

import { bboxClip } from "@turf/bbox-clip";

import type { ActivitiesSource } from "../types";

import AdmZip from "adm-zip";
import Papa from "papaparse";
import parseFit from "../parsers/fit";
import parseGpx from "../parsers/gpx";

function gunzip(buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.gunzip(buffer, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

type Activity = {
  name: string;
  sport_type: string;
  date: Date;
  linestrings: Array<GeoJSON.Feature<GeoJSON.LineString>>;
};

/**
 * An ActivitiesSource that reads activities from a Strava bulk export file.
 * A bulk export can be downloaded from the Strava website.
 * See https://support.strava.com/hc/en-us/articles/216918437-Exporting-your-Data-and-Bulk-Export#h_01GG58HC4F1BGQ9PQZZVANN6WF
 */
export class StravaLocalZip implements ActivitiesSource {
  #activities: Array<Activity> = [];
  #zipfile: string;
  /**
   * @param zipfile - The path to the zip file containing the export.
   */
  constructor(zipfile: string) {
    this.#zipfile = zipfile;
  }
  async init(): Promise<void> {
    const zip = new AdmZip(this.#zipfile);
    console.info(`loading ${this.#zipfile}`);

    const activitiesContent = zip.readAsText("activities.csv");
    if (activitiesContent.length === 0) {
      throw new Error("invalid activities.csv");
    }

    const data = Papa.parse<{
      Filename: string;
      "Activity Name": string;
      "Activity Date": string;
      "Activity Type": string;
    }>(activitiesContent, { header: true });
    const start = performance.now();
    for (const row of data.data) {
      const filename = row.Filename;
      const name = row["Activity Name"];
      const date = new Date(row["Activity Date"]);
      const sport_type = row["Activity Type"];

      //console.log('filename', filename);
      if (filename == null || filename === "") {
        continue;
      }

      let segments: Array<GeoJSON.Position[]>;

      const content = zip.readFile(filename);
      if (content == null) {
        throw new Error(`failed to read ${filename}`);
      }

      if (filename.endsWith(".gpx.gz")) {
        const unzippedContent = await gunzip(content);
        try {
          segments = await parseGpx(unzippedContent);
        } catch (e) {
          throw new Error(`failed to parse ${filename}: ${e}`);
        }
      } else if (filename.endsWith(".gpx")) {
        try {
          segments = await parseGpx(content);
        } catch (e) {
          throw new Error(`failed to parse ${filename}: ${e}`);
        }
      } else if (filename.endsWith(".fit.gz")) {
        const unzippedContent = await gunzip(content);
        try {
          segments = await parseFit(unzippedContent);
        } catch (e) {
          throw new Error(`failed to parse ${filename}: ${e}`);
        }
      } else {
        console.error("unhandled file", filename, name);
        continue;
      }

      const linestrings = segments.map((seg) => {
        return {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: seg,
          },
        };
      });

      this.#activities.push({
        name,
        linestrings,
        date,
        sport_type,
      });
    }
    console.log("loading time", performance.now() - start);
  }

  async getAllPathsInBounds(
    boundingBox: GeoJSON.BBox,
    filter?: Readonly<{
      startDate?: Date;
      endDate?: Date;
      sportTypes?: Array<string>;
    }>,
  ): Promise<Array<Array<GeoJSON.Position>>> {
    const startDate = filter?.startDate;
    const endDate = filter?.endDate;
    const sportTypes = filter?.sportTypes;

    const result: Array<Array<GeoJSON.Position>> = [];
    for (const activity of this.#activities) {
      if (startDate != null && activity.date < startDate) {
        continue;
      }
      if (endDate != null && activity.date > endDate) {
        continue;
      }
      if (sportTypes != null && !sportTypes.includes(activity.sport_type)) {
        continue;
      }
      for (const lineString of activity.linestrings) {
        const clipped = bboxClip(lineString, boundingBox);
        if (clipped.geometry.coordinates.length === 0) {
          continue;
        }
        let coords = clipped.geometry.coordinates;
        if (clipped.geometry.type === "LineString") {
          coords = [coords as GeoJSON.Position[]];
        }
        for (const linestring of coords as GeoJSON.Position[][]) {
          result.push(linestring);
        }
      }
    }
    return result;
  }
}
