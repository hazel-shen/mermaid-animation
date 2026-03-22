import { useState, useCallback } from 'react';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { RenderFrameOptions } from '../utils/canvasRenderer';
import { renderFrame } from '../utils/canvasRenderer';

export type DownloadFormat = 'mp4' | 'gif';

interface UseMediaRecorderReturn {
  isRecording: boolean;
  startDownload: (
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    diagramSizeRef: React.MutableRefObject<{ w: number; h: number }>,
    opts: RenderFrameOptions,
    format: DownloadFormat
  ) => void;
}

const DURATION_MS = 4000;

function getDiagramTransform(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  diagramSizeRef: React.MutableRefObject<{ w: number; h: number }>,
  outW: number,
  outH: number,
  padding: number
) {
  const diagramOffset = (canvasRef.current as any).viewBoxOffset || { x: 0, y: 0 };
  const { w: dw, h: dh } = diagramSizeRef.current;
  const scale = dw > 0 && dh > 0
    ? Math.min((outW - padding) / dw, (outH - padding) / dh)
    : 1;
  const tr = {
    x: (outW - dw * scale) / 2,
    y: (outH - dh * scale) / 2,
    scale,
  };
  return { tr, offset: { x: diagramOffset.x, y: diagramOffset.y } };
}

export const useMediaRecorder = (): UseMediaRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);

  const startDownload = useCallback((
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    diagramSizeRef: React.MutableRefObject<{ w: number; h: number }>,
    opts: RenderFrameOptions,
    format: DownloadFormat
  ) => {
    if (!canvasRef.current) return;
    setIsRecording(true);

    if (format === 'gif') {
      // GIF: 1280×720 @8fps for 4s = 32 frames
      // rgb444 quantizer is ~2x faster than rgb565 with negligible quality diff for flat vector art
      // palette is computed once from frame 1 and reused — safe because Mermaid palette is static
      const GIF_W = 1280;
      const GIF_H = 720;
      const GIF_FPS = 15;
      const FRAME_DELAY = Math.round(100 / GIF_FPS); // gifenc uses centiseconds
      const totalFrames = Math.round((DURATION_MS / 1000) * GIF_FPS);
      // TARGET_TICKS_PER_SEC / GIF_FPS = ticks per frame, keeping speed fps-independent
      const TARGET_TICKS_PER_SEC = 60;
      const ticksPerGifFrame = TARGET_TICKS_PER_SEC / GIF_FPS;
      let tickAccumulator = 0;

      const gifCanvas = document.createElement('canvas');
      gifCanvas.width = GIF_W;
      gifCanvas.height = GIF_H;
      // willReadFrequently keeps getImageData on CPU path (avoids GPU readback stall)
      const gifCtx = gifCanvas.getContext('2d', { willReadFrequently: true })!;

      const { tr: gifTr, offset: gifOffset } = getDiagramTransform(canvasRef, diagramSizeRef, GIF_W, GIF_H, 48);

      const encoder = GIFEncoder();
      let framesCaptured = 0;
      let sharedPalette: number[][] | null = null;

      // Clone particles so GIF rendering is independent of the live main-loop particles
      const gifParticles = opts.particles.map(p => {
        const clone = Object.create(Object.getPrototypeOf(p));
        clone.progress = p.progress;
        clone.speed = p.speed;
        clone.pathElement = p.pathElement;
        return clone;
      });
      const gifOpts = { ...opts, particles: gifParticles };

      const captureNextFrame = () => {
        if (framesCaptured >= totalFrames) {
          encoder.finish();
          const bytes = encoder.bytes() as BlobPart;
          const blob = new Blob([bytes], { type: 'image/gif' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'flowmotion.gif';
          a.click();
          URL.revokeObjectURL(url);
          setIsRecording(false);
          return;
        }

        if (gifOpts.isPremium) {
          tickAccumulator += ticksPerGifFrame * gifOpts.particleSpeed;
          const ticks = Math.floor(tickAccumulator);
          tickAccumulator -= ticks;
          for (let t = 0; t < ticks; t++) gifParticles.forEach(p => p.update(1));
        }
        renderFrame(gifCtx, GIF_W, GIF_H, gifTr, gifOffset, true, gifOpts);

        const { data } = gifCtx.getImageData(0, 0, GIF_W, GIF_H);

        if (!sharedPalette) {
          sharedPalette = quantize(data, 256, { format: 'rgb444' });
        }
        const index = applyPalette(data, sharedPalette, 'rgb444');
        encoder.writeFrame(index, GIF_W, GIF_H, { palette: sharedPalette, delay: FRAME_DELAY });

        framesCaptured++;
        setTimeout(captureNextFrame, 0);
      };

      captureNextFrame();
    } else {
      // MP4/WebM: supersampled 1280×720 via MediaRecorder
      const HD_W = 1280;
      const HD_H = 720;
      const SS = 2;
      const SS_W = HD_W * SS;
      const SS_H = HD_H * SS;

      const ssCanvas = document.createElement('canvas');
      ssCanvas.width = SS_W;
      ssCanvas.height = SS_H;
      const ssCtx = ssCanvas.getContext('2d')!;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = HD_W;
      outCanvas.height = HD_H;
      const outCtx = outCanvas.getContext('2d')!;

      const { tr: ssTr, offset: ssOffset } = getDiagramTransform(canvasRef, diagramSizeRef, HD_W, HD_H, 48);
      const scaledSsTr = { x: ssTr.x * SS, y: ssTr.y * SS, scale: ssTr.scale * SS };

      let rafId: number;
      const drawHDFrame = () => {
        // Do NOT call p.update() here — the main animation loop already advances particles.
        // Calling update() again here would double the speed during recording.
        renderFrame(ssCtx, SS_W, SS_H, scaledSsTr, ssOffset, true, opts);
        outCtx.clearRect(0, 0, HD_W, HD_H);
        outCtx.drawImage(ssCanvas, 0, 0, HD_W, HD_H);
        rafId = requestAnimationFrame(drawHDFrame);
      };
      drawHDFrame();

      const stream = (outCanvas as any).captureStream(60);
      // Prefer avc1 (H.264) MP4 — broadest playback support. Fall back to WebM.
      const mp4Types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
      const mimeType = mp4Types.find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';
      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        cancelAnimationFrame(rafId);
        const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `flowmotion.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };
      recorder.start();
      setTimeout(() => recorder.stop(), DURATION_MS);
    }
  }, []);

  return { isRecording, startDownload };
};
