import * as React from "react";
type Ctx = { name: string; value?: string; onValueChange?: (v: string)=>void };
const C = React.createContext<Ctx | null>(null);
let i = 0;

export function RadioGroup({ value, onValueChange, children, className }:{
  value: string; onValueChange: (v:string)=>void; children: React.ReactNode; className?: string;
}) {
  const name = React.useMemo(() => "rg_" + ++i, []);
  return <C.Provider value={{ name, value, onValueChange }}>
    <div className={`grid grid-cols-4 gap-2 ${className||""}`}>{children}</div>
  </C.Provider>;
}

export function RadioGroupItem({ value, className }:{ value: string; className?: string }) {
  const c = React.useContext(C)!;
  const checked = c.value === value;
  return (
    <label className={`cursor-pointer rounded-lg border px-2 py-1 text-center text-xs ${checked ? "bg-slate-100 border-slate-400" : "border-slate-300 hover:bg-slate-50"} ${className||""}`}>
      <input className="sr-only" type="radio" name={c.name} value={value} checked={checked} onChange={(e)=>c.onValueChange?.(e.target.value)} />
      {value}
    </label>
  );
}
