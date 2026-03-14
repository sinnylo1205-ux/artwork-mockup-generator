import * as React from "react";

const RadioGroupContext = React.createContext<{ value?: string; onValueChange?: (v: string) => void }>({});

export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, onValueChange, className = "", ...props }, ref) => (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div ref={ref} className={`grid gap-2 ${className}`} {...props} />
    </RadioGroupContext.Provider>
  )
);
RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  id?: string;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ value, id, className = "", ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext);
    const uid = id || `radio-${value}`;
    return (
      <input
        type="radio"
        ref={ref}
        id={uid}
        value={value}
        checked={ctx.value === value}
        onChange={() => ctx.onValueChange?.(value)}
        className={`cursor-pointer ${className}`}
        {...props}
      />
    );
  }
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
