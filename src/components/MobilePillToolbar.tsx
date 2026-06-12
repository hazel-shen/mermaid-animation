import React from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Code, X, SlidersHorizontal } from 'lucide-react';

interface MobilePillToolbarProps {
  isEditorOpen: boolean;
  scale: number;
  isControlBarOpen: boolean;
  onToggleEditor: () => void;
  onFit: () => void;
  onToggleDrawer: () => void;
}

// Mobile-only draggable pill toolbar.
export const MobilePillToolbar: React.FC<MobilePillToolbarProps> = ({
  isEditorOpen, scale, isControlBarOpen, onToggleEditor, onFit, onToggleDrawer,
}) => {
  const { t } = useTranslation();
  const pillRef = React.useRef<HTMLDivElement>(null);
  const posRef = React.useRef({ x: -1, y: -1 }); // x=-1/y=-1 means "not yet placed"
  const dragRef = React.useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const didDragRef = React.useRef(false);
  const wasDragRef = React.useRef(false);

  // Cache viewport size to avoid layout reads inside pointermove
  const vpRef = React.useRef({ w: window.innerWidth, h: window.innerHeight });
  const headerHRef = React.useRef(0);

  React.useEffect(() => {
    const onResize = () => { vpRef.current = { w: window.innerWidth, h: window.innerHeight }; };
    window.addEventListener('resize', onResize);

    // Track header height via ResizeObserver — works for all screen sizes
    // and when header collapses/expands
    const headerEl = document.querySelector('header');
    if (headerEl) {
      const ro = new ResizeObserver(entries => {
        headerHRef.current = entries[0].contentRect.height + 8;
      });
      ro.observe(headerEl);
      // initial read
      headerHRef.current = headerEl.offsetHeight + 8;
      return () => {
        window.removeEventListener('resize', onResize);
        ro.disconnect();
      };
    }
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const applyPos = React.useCallback((x: number, y: number) => {
    posRef.current = { x, y };
    if (pillRef.current) {
      // transform instead of left/top — runs on compositor thread, no layout
      pillRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }
  }, []);

  // Use layout effect so position is applied before first paint
  React.useLayoutEffect(() => {
    const el = pillRef.current;
    if (!el) return;
    // rAF gives the browser a chance to lay out the pill before we measure it
    requestAnimationFrame(() => {
      const w = el.offsetWidth || 220;
      const h = el.offsetHeight || 44;
      const initialX = Math.max(4, vpRef.current.w - w - 12);
      const initialY = vpRef.current.h - h - 32;
      applyPos(initialX, initialY);
    });
  }, [applyPos]);

  // Native pointer event handlers — attached directly to DOM to avoid React batching
  React.useEffect(() => {
    const el = pillRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      didDragRef.current = false;
      wasDragRef.current = false;
      dragRef.current = {
        startX: e.clientX, startY: e.clientY,
        origX: posRef.current.x, origY: posRef.current.y,
      };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };

    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 4) didDragRef.current = true;
      if (!didDragRef.current) return;
      const { w, h } = vpRef.current;
      const pillW = el.offsetWidth || 260;
      const pillH = el.offsetHeight || 48;
      const headerH = headerHRef.current || 8;
      const x = Math.max(4, Math.min(w - pillW - 4, dragRef.current.origX + dx));
      const y = Math.max(headerH, Math.min(h - pillH - 4, dragRef.current.origY + dy));
      applyPos(x, y);
    };

    const onUp = (e: PointerEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      wasDragRef.current = didDragRef.current;
      dragRef.current = null;
      didDragRef.current = false;
      el.style.cursor = 'grab';
    };

    // { capture: true } ensures we get the event before browser scroll handling
    el.addEventListener('pointerdown', onDown, { capture: true });
    el.addEventListener('pointermove', onMove, { capture: true });
    el.addEventListener('pointerup', onUp, { capture: true });
    el.addEventListener('pointercancel', onUp, { capture: true });
    return () => {
      el.removeEventListener('pointerdown', onDown, { capture: true });
      el.removeEventListener('pointermove', onMove, { capture: true });
      el.removeEventListener('pointerup', onUp, { capture: true });
      el.removeEventListener('pointercancel', onUp, { capture: true });
    };
  }, [applyPos]);

  return (
    <div
      ref={pillRef}
      className="lg:hidden fixed z-40 flex items-center bg-white/90 backdrop-blur border border-gray-200 rounded-full shadow-md select-none"
      style={{ top: 0, left: 0, willChange: 'transform', cursor: 'grab', fontSize: 'clamp(22px, 7vw, 32px)', touchAction: 'none' }}
    >
      <button
        onClick={() => { if (!wasDragRef.current) onToggleEditor(); }}
        className="flex items-center pl-[0.7em] pr-[0.6em] py-[0.4em] text-slate-600 active:bg-gray-100 rounded-l-full transition-colors"
        title={isEditorOpen ? t('mobile.closeEditor') : t('mobile.openEditor')}
      >
        <Code size="1.1em" />
      </button>
      <div className="w-px self-stretch bg-gray-200 flex-shrink-0 my-[0.3em]" />
      <span className="font-mono text-slate-400 px-[0.6em] tabular-nums whitespace-nowrap text-[0.5em]">
        {Math.round(scale * 100)}%
      </span>
      <div className="w-px self-stretch bg-gray-200 flex-shrink-0 my-[0.3em]" />
      <button
        onClick={() => { if (!wasDragRef.current) onFit(); }}
        className="flex items-center justify-center text-slate-500 active:bg-gray-100 transition-colors px-[0.5em]"
        title={t('mobile.fitScreen')}
      >
        <Maximize2 size="1.1em" />
      </button>
      <div className="w-px self-stretch bg-gray-200 flex-shrink-0 my-[0.3em]" />
      <button
        onClick={() => { if (!wasDragRef.current) onToggleDrawer(); }}
        className="rounded-full flex items-center justify-center transition-all active:scale-90 flex-shrink-0 m-[0.2em]"
        style={{
          width: 'clamp(28px, 8vw, 38px)',
          height: 'clamp(28px, 8vw, 38px)',
          background: isControlBarOpen ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#3b82f6,#6366f1)',
        }}
        aria-label={isControlBarOpen ? t('mobile.hideControls') : t('mobile.showControls')}
      >
        {isControlBarOpen
          ? <X size="1.2em" className="text-white" />
          : <SlidersHorizontal size="1.2em" className="text-white" />
        }
      </button>
    </div>
  );
};
