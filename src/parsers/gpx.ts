import sax from "sax";

export default async function parseGpx(buffer: Buffer): Promise<Array<GeoJSON.Position[]>> {
  const result: Array<GeoJSON.Position[]> = [];

  const parser = sax.parser(true);
  let insideTrkseg = false;
  let segment: GeoJSON.Position[] = [];
  parser.onopentag = (node) => {
    if (node.name === "trkseg") {
      insideTrkseg = true;
    }
    if (insideTrkseg) {
      if (node.name === "trkpt") {
        if (node.attributes == null) {
          return;
        }
        if (node.attributes.lat == null || node.attributes.lon == null) {
          console.error("missing lat or lon", node);
          return;
        }
        segment.push([
          Number.parseFloat(node.attributes.lon.toString()),
          Number.parseFloat(node.attributes.lat.toString()),
        ]);
      }
    }
  };
  parser.onerror = (err) => {
    throw err;
  };
  parser.onclosetag = (tagName) => {
    if (tagName === "trkseg") {
      insideTrkseg = false;
      result.push(segment);
      segment = [];
    }
  };
  parser.write(buffer.toString()).close();
  return result;
}
