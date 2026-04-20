import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand ${className}`}
        {...rest}
      />
    );
  },
);
Input.displayName = "Input";
