import * as React from "react";

type Item = { value: string; label: React.ReactNode };
function ItemMarker(_props: any) { return null; } (ItemMarker as any).__isSelectItem = true;

export function Select({ value, onValueChange, children }:{
  value: any; onValueChange: (v:any)=>void; children: React.ReactNode;
}) {
  const items: Item[] = [];

  function pushItem(v: unknown, label: React.ReactNode) {
    if (v == null) return;
    const val = String(v);
    if (!items.some(i => i.value === val)) items.push({ value: val, label });
  }
  function isRenderable(x:any){ return typeof x==="string"||typeof x==="number"||Array.isArray(x)||React.isValidElement(x); }

  function collect(node: React.ReactNode) {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(collect); return; }
    // @ts-ignore fragments
    if (node?.type === React.Fragment) { collect((node as any).props?.children); return; }
    if (React.isValidElement(node)) {
      const t:any = node.type;
      if (t === SelectTrigger || t === SelectContent || t === SelectValue) { collect(node.props?.children); return; }
      if (t && t.__isSelectItem) { pushItem(node.props.value, node.props.children); return; }
      if (Object.prototype.hasOwnProperty.call(node.props ?? {}, "value") && isRenderable(node.props?.children)) {
        pushItem(node.props.value, node.props.children);
      }
      if (node.props?.children) collect(node.props.children);
    }
  }
  collect(children);

  return (
    <select
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
      value={value}
      onChange={(e)=>onValueChange(e.target.value)}
    >
      {items.map(it => <option key={it.value} value={it.value}>{it.label as any}</option>)}
    </select>
  );
}
export function SelectTrigger({ children }:{ children?:React.ReactNode }){ return <>{children}</>; }
export function SelectValue(){ return null; }
export function SelectContent({ children }:{ children?:React.ReactNode }){ return <>{children}</>; }
export function SelectItem({ value, children }:{ value:string; children:React.ReactNode }) {
  return <ItemMarker value={value}>{children}</ItemMarker>;
}
