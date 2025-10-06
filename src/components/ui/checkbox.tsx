import * as React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
};

export function Checkbox({ checked, onCheckedChange, className = "", ...rest }: Props) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      className={
        "h-5 w-5 rounded border border-slate-300 bg-white " +
        "accent-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 " +
        className
      }
      {...rest}
    />
  );
}
