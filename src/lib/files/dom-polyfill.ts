/**
 * Minimal Node-side polyfills for Web APIs that pdfjs-dist@5 references at
 * module load time. Without these, importing pdf-parse@2 (which loads
 * pdfjs-dist's legacy build) throws "ReferenceError: DOMMatrix is not defined"
 * the moment a PDF whose content stream invokes a transform is parsed.
 *
 * The official escape hatch is `@napi-rs/canvas`, but Next.js standalone
 * output doesn't trace that dynamic require, and packaging the native binary
 * across pnpm symlinks + Alpine musl is fragile. For text-only extraction
 * (`getText()`) the matrix math doesn't need to be correct — it only needs to
 * exist. Identity stubs satisfy the import-time check; pdfjs's internal CTM
 * tracking works on these and the extracted text is unaffected.
 *
 * Importing this module for its side effects MUST happen before any
 * `pdf-parse` / `pdfjs-dist` import.
 */

class DOMMatrixStub {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  m11 = 1;
  m12 = 0;
  m13 = 0;
  m14 = 0;
  m21 = 0;
  m22 = 1;
  m23 = 0;
  m24 = 0;
  m31 = 0;
  m32 = 0;
  m33 = 1;
  m34 = 0;
  m41 = 0;
  m42 = 0;
  m43 = 0;
  m44 = 1;
  is2D = true;
  isIdentity = true;

  constructor(_init?: number[] | string) {}
  multiply(_other?: unknown) {
    return this;
  }
  multiplySelf(_other?: unknown) {
    return this;
  }
  preMultiplySelf(_other?: unknown) {
    return this;
  }
  inverse() {
    return new DOMMatrixStub();
  }
  invertSelf() {
    return this;
  }
  scale(_x?: number, _y?: number) {
    return this;
  }
  scaleSelf(_x?: number, _y?: number) {
    return this;
  }
  scale3d() {
    return this;
  }
  scale3dSelf() {
    return this;
  }
  translate(_x?: number, _y?: number) {
    return this;
  }
  translateSelf(_x?: number, _y?: number) {
    return this;
  }
  rotate(_angle?: number) {
    return this;
  }
  rotateSelf(_angle?: number) {
    return this;
  }
  rotateAxisAngle() {
    return this;
  }
  rotateAxisAngleSelf() {
    return this;
  }
  rotateFromVector() {
    return this;
  }
  rotateFromVectorSelf() {
    return this;
  }
  skewX() {
    return this;
  }
  skewXSelf() {
    return this;
  }
  skewY() {
    return this;
  }
  skewYSelf() {
    return this;
  }
  flipX() {
    return this;
  }
  flipY() {
    return this;
  }
  transformPoint(p: { x?: number; y?: number; z?: number; w?: number } = {}) {
    return { x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0, w: p.w ?? 1 };
  }
  toFloat32Array() {
    return new Float32Array([1, 0, 0, 1, 0, 0]);
  }
  toFloat64Array() {
    return new Float64Array([1, 0, 0, 1, 0, 0]);
  }
  toString() {
    return "matrix(1, 0, 0, 1, 0, 0)";
  }
  toJSON() {
    return {};
  }
}

class ImageDataStub {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  readonly colorSpace = "srgb" as const;

  constructor(
    widthOrData: number | Uint8ClampedArray,
    widthOrHeight: number,
    height?: number,
  ) {
    if (typeof widthOrData === "number") {
      this.width = widthOrData;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(widthOrData * widthOrHeight * 4);
    } else {
      this.data = widthOrData;
      this.width = widthOrHeight;
      this.height = height ?? widthOrData.length / 4 / widthOrHeight;
    }
  }
}

class Path2DStub {
  constructor(_path?: unknown) {}
  addPath() {}
  closePath() {}
  moveTo(_x?: number, _y?: number) {}
  lineTo(_x?: number, _y?: number) {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  arcTo() {}
  ellipse() {}
  rect() {}
  roundRect() {}
}

// Cast to `any` because pdfjs-dist invokes these as constructors but the DOM
// lib types include strict ArrayBuffer/SharedArrayBuffer constraints we can't
// satisfy with plain Uint8ClampedArray. Runtime shape is what pdfjs needs.
const g = globalThis as unknown as Record<string, unknown>;
if (typeof g.DOMMatrix === "undefined") g.DOMMatrix = DOMMatrixStub;
if (typeof g.ImageData === "undefined") g.ImageData = ImageDataStub;
if (typeof g.Path2D === "undefined") g.Path2D = Path2DStub;

export {};
