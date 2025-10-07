import * as React from "react";

type Props = {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function Switch({ checked, onCheckedChange, className = "", ...rest }: Props) {
  return (
    <label className={`inline-flex cursor-pointer items-center ${className}`}>
      {/* hidden control */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="peer sr-only"
        {...rest}
      />

      {/* track (thumb rendered via ::after) */}
      <span
        aria-hidden="true"
        className={[
          // base track
          "relative inline-block h-5 w-9 rounded-full bg-slate-300 transition-colors",
          // track on
          "peer-checked:bg-slate-900",
          // thumb
          "after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4",
          "after:rounded-full after:bg-white after:shadow after:transition-transform",
          // slide thumb when checked
          "peer-checked:after:translate-x-4",
        ].join(" ")}
      />
    </label>
  );
}
