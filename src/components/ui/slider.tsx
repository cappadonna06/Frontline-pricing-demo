import * as React from "react";
type Props = { value: number[]; min?: number; max?: number; step?: number; onValueChange: (v:number[])=>void };
export function Slider({ value, min=0, max=100, step=1, onValueChange }: Props) {
  const v = value[0] ?? 0;
  return (
    <input
      type="range"
      className="w-full accent-slate-900 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-slate-200"
      min={min} max={max} step={step} value={v}
      onChange={(e)=>onValueChange([Number(e.target.value)])}
    />
  );
}
