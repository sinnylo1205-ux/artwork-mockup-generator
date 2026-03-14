import * as React from "react";

const AlertDialogContext = React.createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

export function AlertDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return <AlertDialogContext.Provider value={{ open, setOpen }}>{children}</AlertDialogContext.Provider>;
}

export function AlertDialogTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx) return <>{children}</>;
  const child = React.Children.only(children) as React.ReactElement<{ onClick?: (e: any) => void }>;
  const existingOnClick = child.props.onClick;
  return React.cloneElement(child, {
    onClick: (e: any) => {
      existingOnClick?.(e);
      ctx.setOpen(true);
    },
  });
}

export function AlertDialogContent({ children }: { children: React.ReactNode }) {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx?.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => ctx.setOpen(false)} />
      <div className="relative z-50 rounded-lg border bg-card p-6 shadow-lg max-w-md w-full mx-4">
        {children}
      </div>
    </div>
  );
}

export function AlertDialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col space-y-2 text-center sm:text-left">{children}</div>;
}

export function AlertDialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

export function AlertDialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function AlertDialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">{children}</div>;
}

export function AlertDialogCancel({ children }: { children: React.ReactNode }) {
  const ctx = React.useContext(AlertDialogContext);
  return (
    <button type="button" className="mt-2 sm:mt-0 border px-4 py-2 rounded-md" onClick={() => ctx?.setOpen(false)}>
      {children}
    </button>
  );
}

export function AlertDialogAction({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const ctx = React.useContext(AlertDialogContext);
  return (
    <button
      type="button"
      className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
      onClick={() => {
        onClick?.();
        ctx?.setOpen(false);
      }}
    >
      {children}
    </button>
  );
}
