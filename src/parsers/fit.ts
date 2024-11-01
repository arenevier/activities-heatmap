/// <reference path="../overrides/custom-types.d.ts" />

import { Decoder, Stream } from "@garmin/fitsdk";

function semicirclesToDegrees(semicircles: number) {
  return semicircles * (180 / 2 ** 31);
}

export default async function parseFit(buffer: Buffer): Promise<Array<GeoJSON.Position[]>> {
  const stream = Stream.fromBuffer(buffer);
  const decoder = new Decoder(stream);

  if (!decoder.isFIT()) {
    throw new Error("not a FIT file");
  }
  const { messages, errors } = decoder.read();
  if (errors.length > 0) {
    throw new Error(`Error reading FIT file: ${errors}`);
  }
  const positions: GeoJSON.Position[] = [];
  for (const record of messages.recordMesgs) {
    const { positionLat, positionLong } = record;
    if (positionLat != null && positionLong != null) {
      positions.push([semicirclesToDegrees(positionLong), semicirclesToDegrees(positionLat)]);
    }
  }
  if (positions.length === 0) {
    return [];
  }
  // TODO: handle files with multiple sessions
  return [positions];
}
