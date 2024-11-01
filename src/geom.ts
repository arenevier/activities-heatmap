export class Point {
  constructor(
    public x: number,
    public y: number,
  ) {}
  equals(other: Point) {
    return this.x === other.x && this.y === other.y;
  }
}

export class Vector {
  private _length: number | null = null;
  private _determinant: number | null = null;

  constructor(
    public x: number,
    public y: number,
  ) {}
  normalize() {
    const length = this.length();
    return new Vector(this.x / length, this.y / length);
  }
  length() {
    if (this._length === null) {
      this._length = Math.sqrt(this.x ** 2 + this.y ** 2);
    }
    return this._length;
  }
  add(v: Vector) {
    return new Vector(this.x + v.x, this.y + v.y);
  }
  multiply(scalar: number) {
    return new Vector(this.x * scalar, this.y * scalar);
  }
  dot(v: Vector) {
    return this.x * v.x + this.y * v.y;
  }
  determinant(v: Vector) {
    if (this._determinant === null) {
      this._determinant = this.x * v.y - this.y * v.x;
    }
    return this._determinant;
  }
}

export class Line {
  constructor(
    public pt1: Point,
    public pt2: Point,
  ) {}
  projectedPoint(point: Point) {
    const v1 = new Vector(this.pt2.x - this.pt1.x, this.pt2.y - this.pt1.y);
    const v2 = new Vector(point.x - this.pt1.x, point.y - this.pt1.y);
    const t = v1.dot(v2) / v1.dot(v1);
    return new Point(this.pt1.x + t * v1.x, this.pt1.y + t * v1.y);
  }
  symmetricPoint(point: Point) {
    const projected = this.projectedPoint(point);
    return new Point(2 * projected.x - point.x, 2 * projected.y - point.y);
  }
}

export class Polygon {
  private _bounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
  private _area: number | null = null;
  constructor(public corners: Array<Point>) {}

  bounds() {
    if (this._bounds === null) {
      this._bounds = {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      };
      for (const corner of this.corners) {
        this._bounds.minX = Math.min(this._bounds.minX, corner.x);
        this._bounds.maxX = Math.max(this._bounds.maxX, corner.x);
        this._bounds.minY = Math.min(this._bounds.minY, corner.y);
        this._bounds.maxY = Math.max(this._bounds.maxY, corner.y);
      }
    }
    return this._bounds;
  }

  clip(bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
    let result = this.corners;

    {
      // top
      const pointList = result;
      result = [];

      for (let i = 0; i < pointList.length; i++) {
        const point = pointList[i];
        const prevPoint = pointList[i === 0 ? pointList.length - 1 : i - 1];

        const inside = point.y > bounds.minY;
        const prevInside = prevPoint.y > bounds.minY;

        if (inside !== prevInside) {
          // intersection with horizontal
          const t = (bounds.minY - prevPoint.y) / (point.y - prevPoint.y);
          const x = prevPoint.x + t * (point.x - prevPoint.x);
          result.push(new Point(x, bounds.minY));
        }
        if (inside) {
          result.push(point);
        }
      }
    }

    {
      // right
      const pointList = result;
      result = [];

      for (let i = 0; i < pointList.length; i++) {
        const point = pointList[i];
        const prevPoint = pointList[i === 0 ? pointList.length - 1 : i - 1];

        const inside = point.x < bounds.maxX;
        const prevInside = prevPoint.x < bounds.maxX;

        if (inside !== prevInside) {
          // intersection with vertical
          const t = (bounds.maxX - prevPoint.x) / (point.x - prevPoint.x);
          const y = prevPoint.y + t * (point.y - prevPoint.y);
          result.push(new Point(bounds.maxX, y));
        }
        if (inside) {
          result.push(point);
        }
      }
    }

    {
      // bottom
      const pointList = result;
      result = [];

      for (let i = 0; i < pointList.length; i++) {
        const point = pointList[i];
        const prevPoint = pointList[i === 0 ? pointList.length - 1 : i - 1];

        const inside = point.y < bounds.maxY;
        const prevInside = prevPoint.y < bounds.maxY;

        if (inside !== prevInside) {
          // intersection with horizontal
          const t = (bounds.maxY - prevPoint.y) / (point.y - prevPoint.y);
          const x = prevPoint.x + t * (point.x - prevPoint.x);
          result.push(new Point(x, bounds.maxY));
        }
        if (inside) {
          result.push(point);
        }
      }
    }

    {
      // left
      const pointList = result;
      result = [];

      for (let i = 0; i < pointList.length; i++) {
        const point = pointList[i];
        const prevPoint = pointList[i === 0 ? pointList.length - 1 : i - 1];

        const inside = point.x > bounds.minX;
        const prevInside = prevPoint.x > bounds.minX;

        if (inside !== prevInside) {
          // intersection with vertical
          const t = (bounds.minX - prevPoint.x) / (point.x - prevPoint.x);
          const y = prevPoint.y + t * (point.y - prevPoint.y);
          result.push(new Point(bounds.minX, y));
        }
        if (inside) {
          result.push(point);
        }
      }
    }

    return new Polygon(result);
  }

  area() {
    if (this._area === null) {
      let total = 0;

      for (let i = 0; i < this.corners.length; i++) {
        const corner = this.corners[i];
        const prevCorner = this.corners[i === 0 ? this.corners.length - 1 : i - 1];

        total += corner.x * prevCorner.y;
        total -= prevCorner.x * corner.y;
      }

      this._area = Math.abs(0.5 * total);
    }
    return this._area;
  }
}
