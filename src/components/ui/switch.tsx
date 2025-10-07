// @/components/ui/switch.tsx
import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils" // <- whatever path your cn() helper lives at

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {}

/**
 * Tailwind-friendly Radix Switch
 * - Root exposes data-state="checked|unchecked"
 * - Thumb slides via data-state translate classes
 * - Size can be changed by passing className (e.g., "h-6 w-11")
 */
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, ...props }, ref) => {
  return (
    <SwitchPrimitives.Root
      ref={ref}
      className={cn(
        // track
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full",
        "border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // default size; you can override with className (h-6 w-11 works well)
        "h-5 w-9",
        // colors
        "data-[state=unchecked]:bg-input data-[state=checked]:bg-primary",
        className
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          // thumb must be a block with transform animations
          "pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform",
          // default thumb size for h-5 w-9 track
          "h-4 w-4",
          // slide amounts; if you use h-6 w-11 on Root, this still works
          "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4"
        )}
      />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = "Switch"
export default Switch
