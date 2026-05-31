import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useEditorResize } from '../../hooks/useEditorResize';

// Fire mouseup after each test to clean up window event listeners
afterEach(() => {
  act(() => { window.dispatchEvent(new MouseEvent('mouseup')); });
});

// ── handleResizeStart ─────────────────────────────────────────────────────────

describe('useEditorResize – handleResizeStart', () => {
  it('calls preventDefault', () => {
    const { result } = renderHook(() => useEditorResize());
    const preventDefault = vi.fn();
    act(() => { result.current.handleResizeStart({ preventDefault, clientX: 300 } as any); });
    expect(preventDefault).toHaveBeenCalled();
  });

  it('sets isResizingRef to true', () => {
    const { result } = renderHook(() => useEditorResize());
    act(() => { result.current.handleResizeStart({ preventDefault: vi.fn(), clientX: 300 } as any); });
    expect(result.current.isResizingRef.current).toBe(true);
  });

  it('sets body cursor to col-resize', () => {
    const { result } = renderHook(() => useEditorResize());
    act(() => { result.current.handleResizeStart({ preventDefault: vi.fn(), clientX: 300 } as any); });
    expect(document.body.style.cursor).toBe('col-resize');
  });
});

// ── mousemove during resize ───────────────────────────────────────────────────

describe('useEditorResize – mousemove', () => {
  it('updates editorWidth by the drag delta', () => {
    // start at 320, drag start at x=300, move to x=350 → delta=+50 → 320+50=370
    const { result } = renderHook(() => useEditorResize(320));
    act(() => { result.current.handleResizeStart({ preventDefault: vi.fn(), clientX: 300 } as any); });
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 350 })); });
    expect(result.current.editorWidth).toBe(370);
  });

  it('clamps width to minimum 180', () => {
    // 320 + (0 - 300) = 20, clamped to 180
    const { result } = renderHook(() => useEditorResize(320));
    act(() => { result.current.handleResizeStart({ preventDefault: vi.fn(), clientX: 300 } as any); });
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 })); });
    expect(result.current.editorWidth).toBe(180);
  });

  it('clamps width to maximum 600', () => {
    // 320 + (900 - 300) = 920, clamped to 600
    const { result } = renderHook(() => useEditorResize(320));
    act(() => { result.current.handleResizeStart({ preventDefault: vi.fn(), clientX: 300 } as any); });
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900 })); });
    expect(result.current.editorWidth).toBe(600);
  });
});

// ── mouseup ───────────────────────────────────────────────────────────────────

describe('useEditorResize – mouseup', () => {
  it('sets isResizingRef to false', () => {
    const { result } = renderHook(() => useEditorResize());
    act(() => { result.current.handleResizeStart({ preventDefault: vi.fn(), clientX: 300 } as any); });
    act(() => { window.dispatchEvent(new MouseEvent('mouseup')); });
    expect(result.current.isResizingRef.current).toBe(false);
  });

  it('resets body cursor', () => {
    const { result } = renderHook(() => useEditorResize());
    act(() => { result.current.handleResizeStart({ preventDefault: vi.fn(), clientX: 300 } as any); });
    act(() => { window.dispatchEvent(new MouseEvent('mouseup')); });
    expect(document.body.style.cursor).toBe('');
  });

  it('stops updating width after mouseup', () => {
    const { result } = renderHook(() => useEditorResize(320));
    act(() => { result.current.handleResizeStart({ preventDefault: vi.fn(), clientX: 300 } as any); });
    act(() => { window.dispatchEvent(new MouseEvent('mouseup')); });
    const widthAfterUp = result.current.editorWidth;
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900 })); });
    expect(result.current.editorWidth).toBe(widthAfterUp);
  });
});
