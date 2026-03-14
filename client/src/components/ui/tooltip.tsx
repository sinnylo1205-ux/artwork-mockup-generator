import * as React from "react";

const TooltipContext = React.createContext<boolean>(false);

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipContext.Provider value={true}>{children}</TooltipContext.Provider>;
}

export function Tooltip({ children, content }: { children: React.ReactNode; content?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && content && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs rounded bg-popover border shadow z-50 whitespace-nowrap">
          {content}
        </span>
      )}
    </span>
  );
}
