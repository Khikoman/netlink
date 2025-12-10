type ClassValue = string | boolean | undefined | null | ClassValue[] | Record<string, boolean>;

/**
 * Utility function to conditionally join classNames together
 * Similar to clsx/classnames but lightweight
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  function processInput(input: ClassValue) {
    if (!input) return;

    if (typeof input === "string") {
      classes.push(input);
    } else if (Array.isArray(input)) {
      for (const item of input) {
        processInput(item);
      }
    } else if (typeof input === "object") {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }

  for (const input of inputs) {
    processInput(input);
  }

  return classes.join(" ");
}
