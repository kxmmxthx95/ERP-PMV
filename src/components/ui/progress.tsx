"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-3 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

function IndeterminateProgress({ className, barClassName, white }: { className?: string; barClassName?: string; white?: boolean }) {
  return (
    <div className={cn("relative h-1 w-full bg-slate-100/50 overflow-hidden rounded-full", white && "bg-white/20", className)}>
      <motion.div
        className={cn(
          "absolute h-full rounded-full", 
          white ? "bg-white" : "bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]",
          barClassName
        )}
        initial={{ left: "-40%", width: "40%" }}
        animate={{ left: "100%", width: "20%" }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  )
}

export { Progress, IndeterminateProgress }
