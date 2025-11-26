"use client";

import { type ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from "lucide-react";

export type AlertVariant = "success" | "warning" | "error" | "info";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

const variantStyles: Record<AlertVariant, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
    icon: "text-green-500",
  },
  warning: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
    icon: "text-yellow-500",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon: "text-red-500",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    icon: "text-blue-500",
  },
};

const icons: Record<AlertVariant, ReactNode> = {
  success: <CheckCircle className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  error: <AlertCircle className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />,
};

export function Alert({
  variant = "info",
  title,
  children,
  onClose,
  className = "",
}: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`
        ${styles.bg} ${styles.border} border rounded-lg p-4
        ${className}
      `}
      role="alert"
    >
      <div className="flex">
        <div className={`flex-shrink-0 ${styles.icon}`}>{icons[variant]}</div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${styles.text}`}>{title}</h3>
          )}
          <div className={`${title ? "mt-1" : ""} text-sm ${styles.text}`}>
            {children}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={`
              ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5
              ${styles.bg} ${styles.text}
              hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2
            `}
          >
            <span className="sr-only">Dismiss</span>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Badge variant for inline status indicators
export type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const badgeStyles: Record<BadgeVariant, string> = {
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
  neutral: "bg-gray-100 text-gray-800",
};

export function Badge({ variant = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        ${badgeStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
