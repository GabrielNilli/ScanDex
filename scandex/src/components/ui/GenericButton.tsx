// =================================
//  IMPORTS
// =================================
import type { ButtonHTMLAttributes, ReactNode } from "react";

// =================================
//  TYPE
// =================================
type GenericButtonVariant = "primary" | "secondary" | "ghost" | "semi";

// =================================
//  INTERFACE
// =================================
interface GenericButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: GenericButtonVariant;
}

// =================================
//  VARIANTS
// =================================
const variantClasses: Record<GenericButtonVariant, string> = {
  primary: `
    bg-[#8B0000]
    border-[#C41E3A]
    text-white
    shadow-[0_4px_6px_rgba(196,30,58,0.3)]
    hover:bg-[#C41E3A]
    hover:shadow-[0_6px_12px_rgba(196,30,58,0.5)]
  `,
  secondary: `
    bg-[#140000]
    border-[#C41E3A]
    text-[#C41E3A]
    shadow-[0_4px_6px_rgba(196,30,58,0.2)]
    hover:bg-[#8B0000]
    hover:text-white
    hover:shadow-[0_6px_12px_rgba(196,30,58,0.4)]
  `,
  ghost: `
    bg-transparent
    border-transparent
    text-white
    shadow-none
    hover:border-[#C41E3A]
    hover:bg-[#C41E3A]/20
    hover:text-[#C41E3A]
  `,
  semi: `
    bg-[#140000]
    border-[#C41E3A]
    text-[#C41E3A]
    shadow-[0_4px_6px_rgba(196,30,58,0.2)]
    hover:bg-[#8B0000]
    hover:text-white
    hover:shadow-[0_6px_12px_rgba(196,30,58,0.4)]
    rotate-90
    lg:rotate-0
    lg:rounded-lg
    rounded-t-full
    `,
};

// =================================
//  COMPONENT
// =================================
export default function GenericButton({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: GenericButtonProps) {
  // =================================
  //  RENDER
  // =================================
  return (
    <button
      type={type}
      className={`
        inline-flex h-14 items-center justify-center rounded-lg border-2
        px-8 py-4 font-mono text-xl font-bold cursor-pointer select-none
        transition-all duration-150 hover:-translate-y-0.5
        active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
