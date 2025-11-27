"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle, X } from "lucide-react";

interface HelpTooltipProps {
  term: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

// Pre-defined help content for common fiber terms
export const HELP_CONTENT: Record<string, React.ReactNode> = {
  "Fusion Splice": (
    <div className="space-y-2">
      <p>A permanent joint made by melting fiber ends together using an arc.</p>
      <ul className="list-disc list-inside text-sm space-y-1">
        <li>Typical loss: 0.02-0.1 dB</li>
        <li>Requires fusion splicer machine</li>
        <li>Best for: permanent installations</li>
      </ul>
    </div>
  ),
  "Mechanical Splice": (
    <div className="space-y-2">
      <p>A joint using alignment hardware (index-matching gel, no heat).</p>
      <ul className="list-disc list-inside text-sm space-y-1">
        <li>Typical loss: 0.1-0.3 dB</li>
        <li>Quick, no special equipment needed</li>
        <li>Best for: repairs, temporary connections</li>
      </ul>
    </div>
  ),
  "Acceptable Loss": (
    <div className="space-y-2">
      <p>Per TIA-568 standards:</p>
      <ul className="list-disc list-inside text-sm space-y-1">
        <li>
          <strong>Fusion:</strong> max 0.3 dB (target {"<"}0.1 dB)
        </li>
        <li>
          <strong>Mechanical:</strong> max 0.5 dB (target {"<"}0.3 dB)
        </li>
      </ul>
    </div>
  ),
  "Buffer Tube": (
    <div className="space-y-2">
      <p>A protective tube containing 12 individual fiber strands.</p>
      <p className="text-sm">
        Each tube is color-coded (Blue, Orange, Green, etc.) following TIA-598 standard.
      </p>
    </div>
  ),
  Enclosure: (
    <div className="space-y-2">
      <p>A protective housing where fiber splices are made and stored.</p>
      <ul className="list-disc list-inside text-sm space-y-1">
        <li>
          <strong>Splice Closure:</strong> Above-ground dome or inline
        </li>
        <li>
          <strong>Handhole:</strong> Underground access point
        </li>
        <li>
          <strong>Pedestal:</strong> Ground-level cabinet
        </li>
      </ul>
    </div>
  ),
  Tray: (
    <div className="space-y-2">
      <p>A splice tray holds fiber splices organized inside an enclosure.</p>
      <p className="text-sm">Typical capacity: 12 or 24 splices per tray.</p>
    </div>
  ),
  "Loss Budget": (
    <div className="space-y-2">
      <p>Total allowable signal loss from transmitter to receiver.</p>
      <p className="text-sm">Includes: fiber attenuation + splice loss + connector loss + safety margin.</p>
    </div>
  ),
  OTDR: (
    <div className="space-y-2">
      <p>
        <strong>Optical Time Domain Reflectometer</strong>
      </p>
      <p className="text-sm">
        Sends light pulses to measure fiber distance, loss, and locate faults/splices.
      </p>
    </div>
  ),
};

export function HelpTooltip({ term, children, position = "top" }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="ml-1 p-0.5 text-gray-400 hover:text-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-full"
        aria-label={`Help: ${term}`}
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 ${positionClasses[position]} w-64 sm:w-72`}
        >
          <div className="bg-gray-900 text-white rounded-lg shadow-lg p-4 text-sm">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-blue-300">{term}</h4>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-gray-200">{children}</div>
          </div>
          {/* Arrow */}
          <div
            className={`absolute w-3 h-3 bg-gray-900 transform rotate-45 ${
              position === "top"
                ? "top-full left-1/2 -translate-x-1/2 -mt-1.5"
                : position === "bottom"
                ? "bottom-full left-1/2 -translate-x-1/2 -mb-1.5"
                : position === "left"
                ? "left-full top-1/2 -translate-y-1/2 -ml-1.5"
                : "right-full top-1/2 -translate-y-1/2 -mr-1.5"
            }`}
          />
        </div>
      )}
    </span>
  );
}

// Convenience component with pre-defined content
export function HelpTip({ term, position }: { term: keyof typeof HELP_CONTENT; position?: "top" | "bottom" | "left" | "right" }) {
  const content = HELP_CONTENT[term];
  if (!content) return null;

  return (
    <HelpTooltip term={term} position={position}>
      {content}
    </HelpTooltip>
  );
}

// Inline label with help tooltip
export function LabelWithHelp({
  label,
  helpTerm,
  required,
  htmlFor,
}: {
  label: string;
  helpTerm: keyof typeof HELP_CONTENT;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center text-sm font-medium text-gray-700"
    >
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
      <HelpTip term={helpTerm} />
    </label>
  );
}
