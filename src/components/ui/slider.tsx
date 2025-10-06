import * as React from "react";

type SliderProps = {
  value: number[];              // [current]
  min?: number;                 // default 0
  max?: number;                 // default 100
  step?: number;                // default 1
  onValueChange: (v: number[]) => void;
  className?: string;
};

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = "",
}: SliderProps) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const v = clamp(value?.[0] ?? min, min, max);
  const pct = ((v - min) / (max - min)) * 100;

  const setFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clamp(clientX - rect.left, 0, rect.width);
    const ratio = x / rect.width;
    const raw = min + ratio * (max - min);
    const snapped = Math.round(raw / step) * step;
    onValueChange([clamp(snapped, min, max)]);
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      setFromClientX(e.clientX);
    }
  };

  // Keyboard support on the thumb
  const onKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onValueChange([clamp(v - step, min, max)]);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onValueChange([clamp(v + step, min, max)]);
    } else if (e.key === "Home") {
      e.preventDefault();
      onValueChange([min]);
    } else if (e.key === "End") {
      e.preventDefault();
      onValueChange([max]);
    } else if (e.key === "PageUp") {
      e.preventDefault();
      onValueChange([clamp(v + step * 10, min, max)]);
    } else if (e.key === "PageDown") {
      e.preventDefault();
      onValueChange([clamp(v - step * 10, min, max)]);
    }
  };

  return (
    <div
      ref={trackRef}
      className={`relative h-2 w-full rounded-full bg-slate-200 ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      {/* Filled track */}
      <div
        className="absolute left-0 top-0 h-full rounded-full bg-slate-900/80"
        style={{ width: `${pct}%` }}
      />

      {/* Thumb */}
      <button
        type="button"
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={v}
        aria-valuetext={`${Math.round(pct)}%`}
        onKeyDown={onKeyDown}
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2
                   h-4 w-4 rounded-full bg-white shadow ring-1 ring-slate-300
                   hover:scale-[1.04] focus:outline-none focus:ring-2
                   focus:ring-slate-900/20 transition"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
