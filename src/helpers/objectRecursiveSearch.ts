/* eslint-disable @typescript-eslint/no-explicit-any */
export default function objectRecursiveSearch(
  obj: Record<string, any>,
  predicate: (key: string, obj: Record<string, any>) => boolean
): boolean {
  if (!obj) {
    return false;
  }

  if (Array.isArray(obj)) {
    const is = (obj as any[]).some((v) => objectRecursiveSearch(v, predicate));
    if (is) {
      return true;
    }
  }

  return Object.keys(obj).some((key: string) => {
    if (predicate(key, obj) === true) {
      return true;
    } else {
      return objectRecursiveSearch(obj[key], predicate);
    }
  });
}
