import type pg from "pg";
import type { ActivitiesSource } from "../types";

type PGPoolOrClient = Pick<pg.Client, "query"> | Pick<pg.PoolClient, "query">;

/**
 * An ActivitiesSource that reads activities from a PostgreSQL database with
 * PostGIS enabled. The database must contain a table with the following
 * columns:
 * - a column named geom, containing a geometry
 *   - a column named start_date, containing a timestamp with timezone
 *   - a column named sport_type, containing a string
 */
export class PostgisDB implements ActivitiesSource {
  #client: PGPoolOrClient;
  #tableName: string;
  #inited = false;

  /**
   * @param client - A pg.Pool, or a pg.Client connected to the database.
   *  Passing a pg.Pool is more performant and is recommended.
   * @param tableName - The name of the table containing the activities.
   */
  constructor(client: PGPoolOrClient, tableName: string) {
    this.#client = client;
    this.#tableName = tableName;
  }

  async #assertColumnType(columnName: string, expectedType: string): Promise<void> {
    const columnQuery = "SELECT udt_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2";
    const columnResult = await this.#client.query(columnQuery, [this.#tableName, columnName]);
    if (columnResult.rows.length === 0) {
      throw new Error(
        `${this.constructor.name} expects table ${this.#tableName} to contain a column named ${columnName}`,
      );
    }
    if (columnResult.rows[0].udt_name !== expectedType) {
      throw new Error(
        `column "${columnName}" of type "${columnResult.rows[0].udt_name}". Expected to be of type "${expectedType}"`,
      );
    }
  }

  async init(): Promise<void> {
    if (this.#inited) {
      return;
    }
    const existsQuery = "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name   = $1)";
    const existsResult = await this.#client.query(existsQuery, [this.#tableName]);
    if (!existsResult.rows[0].exists) {
      throw new Error(`${this.constructor.name} expects a table containing a table named ${this.#tableName}`);
    }
    this.#assertColumnType("geom", "geometry");
    this.#assertColumnType("start_date", "timestamptz");
    this.#assertColumnType("sport_type", "text");
    this.#inited = true;
  }

  #buildWhereClauses(
    paramsIndexStart: number,
    filter?: Readonly<{
      startDate?: Date;
      endDate?: Date;
      sportTypes?: Array<string>;
    }>,
  ) {
    let index = paramsIndexStart;

    const clauses: Array<string> = [];
    const values = Array<any>();

    if (filter == null) {
      return { clauses, values };
    }
    const startDate = filter.startDate;
    const endDate = filter.endDate;
    if (startDate != null) {
      clauses.push(`start_date >= $${index}`);
      values.push(startDate);
      index += 1;
    }
    if (endDate != null) {
      clauses.push(`start_date <= $${index}`);
      values.push(endDate);
      index += 1;
    }

    if (filter.sportTypes != null) {
      clauses.push(` sport_type IN (${filter.sportTypes.map((_, i) => `$${index + i}`).join(", ")})`);
      values.push(...filter.sportTypes);
      index += filter.sportTypes.length;
    }
    return { clauses, values };
  }

  #buildQuery(
    boundingBox: GeoJSON.BBox,
    filter?: Readonly<{
      startDate?: Date;
      endDate?: Date;
      sportTypes?: Array<string>;
    }>,
  ) {
    const query = `SELECT ST_ASGeoJson(ST_Intersection(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))) AS geom from ${this.#tableName}`;
    const { clauses, values } = this.#buildWhereClauses(5, filter);
    if (clauses.length === 0) {
      return {
        name: "query-get-paths-in-bounds",
        text: query,
        values: boundingBox,
      };
    }

    return {
      text: `${query} WHERE ${clauses.join(" AND ")}`,
      values: [...boundingBox, ...values],
    };
  }

  async getAllPathsInBounds(
    boundingBox: GeoJSON.BBox,
    filter?: Readonly<{
      startDate?: Date;
      endDate?: Date;
      sportTypes?: Array<string>;
    }>,
  ): Promise<Array<Array<GeoJSON.Position>>> {
    const query = this.#buildQuery(boundingBox, filter);
    const result = await this.#client.query(query);
    const res: Array<GeoJSON.Position[]> = [];
    for (const row of result.rows) {
      const geom = JSON.parse(row.geom);
      if (geom.coordinates.length === 0) {
        continue;
      }

      if (geom.type === "LineString") {
        res.push(geom.coordinates);
      } else if (geom.type === "MultiLineString") {
        res.push(...geom.coordinates);
      } else {
        throw new Error(`unexpected geometry type ${geom.type}`);
      }
    }
    return res;
  }
}
