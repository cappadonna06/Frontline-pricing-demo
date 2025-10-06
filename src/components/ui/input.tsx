import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className="", type, ...props }, ref) => {
    const numberClasses =
      type === "number"
        ? "tabular-nums text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        : "";
    return (
      <input
        ref={ref}
        type={type}
        className={[
          "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm",
          "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10",
          numberClasses,
          className
        ].join(" ")}
        {...props}
      />
    );
  }
);
