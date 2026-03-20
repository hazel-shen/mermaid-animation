import { useState, useCallback } from 'react';
import type { RenderFrameOptions } from '../utils/canvasRenderer';
import { renderFrame } from '../utils/canvasRenderer';

interface UseMediaRecorderReturn {
  isRecording: boolean;
  startDownload: (
    canvasRef: React.RefObject<HTMLCanvasElement>,
    diagramSizeRef: React.MutableRefObject<{ w: number; h: number }>,
    opts: RenderFrameOptions
  ) => void;
}

export const useMediaRecorder = (): UseMediaRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);

  const startDownload = useCallback((
    canvasRef: React.RefObject<HTMLCanvasElement>,
    diagramSizeRef: React.MutableRefObject<{ w: number; h: number }>,
    opts: RenderFrameOptions
  ) => {
    if (!canvasRef.current) return;
    setIsRecording(true);

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

    const diagramOffset = (canvasRef.current as any).viewBoxOffset || { x: 0, y: 0 };
    const { w: dw, h: dh } = diagramSizeRef.current;
    const padding = 48;
    const hdScale = dw > 0 && dh > 0
      ? Math.min((HD_W - padding) / dw, (HD_H - padding) / dh)
      : 1;
    const ssTr = {
      x: (HD_W - dw * hdScale) / 2 * SS,
      y: (HD_H - dh * hdScale) / 2 * SS,
      scale: hdScale * SS,
    };
    const ssOffset = { x: diagramOffset.x, y: diagramOffset.y };

    let rafId: number;
    const drawHDFrame = () => {
      renderFrame(ssCtx, SS_W, SS_H, ssTr, ssOffset, true, opts);
      outCtx.clearRect(0, 0, HD_W, HD_H);
      outCtx.drawImage(ssCanvas, 0, 0, HD_W, HD_H);
      rafId = requestAnimationFrame(drawHDFrame);
    };
    drawHDFrame();

    const stream = (outCanvas as any).captureStream(60);
    const mp4Types = ['video/mp4;codecs=h264,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'];
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
      setIsRecording(false);
    };
    recorder.start();
    setTimeout(() => recorder.stop(), 3000);
  }, []);

  return { isRecording, startDownload };
};
