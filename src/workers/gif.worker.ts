import { GIFEncoder, quantize, applyPalette } from 'gifenc';

interface InitMsg {
  type: 'init';
  width: number;
  height: number;
  fps: number;
}

interface FrameMsg {
  type: 'frame';
  // RGBA pixel data transferred (zero-copy) from main thread
  data: ArrayBuffer;
}

interface FinishMsg {
  type: 'finish';
}

type WorkerInMsg = InitMsg | FrameMsg | FinishMsg;

let encoder: ReturnType<typeof GIFEncoder>;
let width = 0;
let height = 0;
let frameDelay = 0;
let sharedPalette: number[][] | null = null;

self.onmessage = (e: MessageEvent<WorkerInMsg>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    width = msg.width;
    height = msg.height;
    frameDelay = Math.round(100 / msg.fps);
    encoder = GIFEncoder();
    sharedPalette = null;
    return;
  }

  if (msg.type === 'frame') {
    // msg.data is the transferred ArrayBuffer — wrap without copying
    const rgba = new Uint8ClampedArray(msg.data);

    if (!sharedPalette) {
      sharedPalette = quantize(rgba, 256, { format: 'rgb444' });
    }
    const index = applyPalette(rgba, sharedPalette, 'rgb444');
    encoder.writeFrame(index, width, height, {
      palette: sharedPalette,
      delay: frameDelay,
    });
    return;
  }

  if (msg.type === 'finish') {
    encoder.finish();
    // bytes() returns a Uint8Array view — copy it into a plain ArrayBuffer
    // so we can transfer it back to the main thread (zero-copy)
    const src = encoder.bytes() as Uint8Array;
    const buf = src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength) as ArrayBuffer;
    self.postMessage({ type: 'done', buffer: buf }, [buf]);
  }
};
