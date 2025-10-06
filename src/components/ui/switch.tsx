import * as React from "react";
type Props = { checked: boolean; onCheckedChange: (v:boolean)=>void } & React.InputHTMLAttributes<HTMLInputElement>;
export function Switch({ checked, onCheckedChange, className="", ...rest }: Props) {
  return (
    <label className={`inline-flex cursor-pointer items-center ${className}`}>
      <input type="checkbox" checked={checked} onChange={(e)=>onCheckedChange(e.target.checked)} className="peer sr-only" {...rest}/>
      <span className="h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-slate-900 relative">
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow" />
      </span>
    </label>
  );
}
