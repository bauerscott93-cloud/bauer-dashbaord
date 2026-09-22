/** Join class names, dropping falsy values. */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}
