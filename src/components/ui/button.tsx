import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
};
export function Button({ variant="secondary", size="md", className="", ...rest }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-xl border font-medium shadow-sm transition-colors";
  const variants: Record<string,string> = {
    default: "bg-slate-900 text-white border-slate-900 hover:bg-slate-800",
    secondary: "bg-white text-slate-900 border-slate-200 hover:bg-slate-50",
    outline: "bg-transparent text-slate-700 border-slate-300 hover:bg-slate-50",
  };
  const sizes: Record<string,string> = {
    sm: "px-2.5 py-1.5 text-sm",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-2.5 text-base",
  };
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />;
}
