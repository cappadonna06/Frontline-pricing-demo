import * as React from "react";

export function Card({ className="", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`} {...props} />;
}
export function CardHeader({ className="", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-5 border-b border-slate-100 ${className}`} {...props} />;
}
export function CardContent({ className="", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-5 ${className}`} {...props} />;
}
export function CardTitle({ className="", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`text-xl font-semibold ${className}`} {...props} />;
}
