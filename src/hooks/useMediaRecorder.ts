import { useState, useCallback } from 'react';
import type { RenderFrameOptions } from '../utils/canvasRenderer';
import { renderFrame } from '../utils/canvasRenderer';
import GifWorker from '../workers/gif.worker?worker';

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
      // GIF via Web Worker + Transferable Objects (zero-copy frame shipping):
      // Main thread renders frames with willReadFrequently canvas → getImageData →
      // transfers the ArrayBuffer to gif.worker.ts (gifenc) → worker posts back
      // the finished GIF buffer (also transferred, zero-copy).
      const GIF_W = 960;
      const GIF_H = 540;
      const GIF_FPS = 15;
      const totalFrames = Math.round((DURATION_MS / 1000) * GIF_FPS);

      const gifCanvas = document.createElement('canvas');
      gifCanvas.width = GIF_W;
      gifCanvas.height = GIF_H;
      // willReadFrequently keeps getImageData on the CPU path — avoids GPU readback stall
      const gifCtx = gifCanvas.getContext('2d', { willReadFrequently: true })!;

      const { tr: gifTr, offset: gifOffset } = getDiagramTransform(canvasRef, diagramSizeRef, GIF_W, GIF_H, 48);

      const worker = new GifWorker();
      worker.postMessage({ type: 'init', width: GIF_W, height: GIF_H, fps: GIF_FPS });

      worker.onmessage = (e: MessageEvent<{ type: 'done'; buffer: ArrayBuffer }>) => {
        worker.terminate();
        const blob = new Blob([e.data.buffer], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'flowmotion.gif';
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };

      let framesCaptured = 0;
      const gifOpts = { ...opts, isPremium: true };

      // Particles run at ~60 ticks/s on the main loop. GIF captures at GIF_FPS,
      // so each captured frame must advance particles by (60 / GIF_FPS) ticks
      // to keep the apparent speed identical to the live canvas.
      const TICK_MULTIPLIER = 60 / GIF_FPS;

      const captureNextFrame = () => {
        if (framesCaptured >= totalFrames) {
          worker.postMessage({ type: 'finish' });
          return;
        }

        gifOpts.particles.forEach(p => p.update(TICK_MULTIPLIER));
        renderFrame(gifCtx, GIF_W, GIF_H, gifTr, gifOffset, true, gifOpts);

        // Transfer the pixel buffer — the ArrayBuffer moves to the Worker (zero-copy).
        // getImageData always returns a fresh buffer so this is safe to transfer.
        const imageData = gifCtx.getImageData(0, 0, GIF_W, GIF_H);
        worker.postMessage({ type: 'frame', data: imageData.data.buffer }, [imageData.data.buffer]);

        framesCaptured++;
        // yield to event loop between frames so the UI stays responsive
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
      const mp4Opts = { ...opts, isPremium: true };
      const drawHDFrame = () => {
        // Do NOT call p.update() here — the main animation loop already advances particles.
        // Calling update() again here would double the speed during recording.
        renderFrame(ssCtx, SS_W, SS_H, scaledSsTr, ssOffset, true, mp4Opts);
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
