/* eslint-disable @typescript-eslint/no-explicit-any */
export default function objectRecursiveSearch(
  obj: Record<string, any>,
  predicate: (key: string, obj: Record<string, any>) => boolean
): boolean {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  if (Array.isArray(obj)) {
    return (obj as any[]).some((v) => objectRecursiveSearch(v, predicate));
  }

  return Object.keys(obj).some((key: string) => {
    if (predicate(key, obj) === true) {
      return true;
    } else {
      return objectRecursiveSearch(obj[key], predicate);
    }
  });
}
