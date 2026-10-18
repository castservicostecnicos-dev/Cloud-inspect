import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  title: string;
  subtitle?: string;
  initialSignature?: string;
  onSave: (dataUrl: string) => void;
  onClear?: () => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  title,
  subtitle,
  initialSignature,
  onSave,
  onClear,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    // Save current image data before resizing if already drawn
    let prevData: string | null = null;
    try {
      if (hasDrawn) {
        prevData = canvas.toDataURL('image/png');
      }
    } catch {
      // ignore
    }

    canvas.width = rect.width * dpr;
    canvas.height = 160 * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const source = prevData || initialSignature;
    if (source) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, 160);
        setHasDrawn(true);
      };
      img.src = source;
    }
  };

  useEffect(() => {
    initCanvas();

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      initCanvas();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [initialSignature]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent scrolling on mobile during signature
    if ('touches' in e) {
      e.stopPropagation();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    if ('touches' in e) {
      e.stopPropagation();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    if (onClear) onClear();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <PenTool className="w-4 h-4 text-blue-600" />
            <span>{title}</span>
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={clearCanvas}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
          title="Limpar assinatura"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Limpar</span>
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative border-2 border-dashed border-slate-200 rounded-lg overflow-hidden bg-slate-50/50 touch-none w-full max-w-full"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-40 cursor-crosshair block"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400">
            <PenTool className="w-6 h-6 mb-1 opacity-40" />
            <span className="text-xs font-medium">Assine com o dedo ou caneta touch aqui</span>
          </div>
        )}
        <div className="absolute bottom-2 left-4 right-4 pointer-events-none border-b border-slate-300/80"></div>
      </div>
    </div>
  );
};
