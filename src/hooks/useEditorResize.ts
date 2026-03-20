import { useState, useRef, useCallback } from 'react';

interface UseEditorResizeReturn {
  editorWidth: number;
  isResizingRef: React.MutableRefObject<boolean>;
  handleResizeStart: (e: React.MouseEvent) => void;
}

export const useEditorResize = (initialWidth = 320): UseEditorResizeReturn => {
  const [editorWidth, setEditorWidth] = useState(initialWidth);
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWRef = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeStartXRef.current = e.clientX;
    resizeStartWRef.current = editorWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = ev.clientX - resizeStartXRef.current;
      const newW = Math.min(Math.max(resizeStartWRef.current + delta, 180), 600);
      setEditorWidth(newW);
    };
    const onUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [editorWidth]);

  return { editorWidth, isResizingRef, handleResizeStart };
};
