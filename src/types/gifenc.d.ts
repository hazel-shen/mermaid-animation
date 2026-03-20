declare module 'gifenc' {
  type ImageDataArray = Uint8ClampedArray | Uint8Array | number[];

  interface GIFEncoderInstance {
    writeFrame(
      data: ImageDataArray,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        delay?: number;
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
      }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(opts?: { auto?: boolean }): GIFEncoderInstance;

  export function quantize(
    data: ImageDataArray,
    maxColors: number,
    opts?: { format?: string; oneBitAlpha?: boolean }
  ): number[][];

  export function applyPalette(
    data: ImageDataArray,
    palette: number[][],
    format?: string
  ): ImageDataArray;
}
