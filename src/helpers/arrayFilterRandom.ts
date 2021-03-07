import intGetRandom from "./intGetRandom";

/** returns new random array with pointed length */
export default function arrayFilterRandom<T>(arr: T[], count: number): T[] {
  const result: T[] = [];
  const excludeInd: boolean[] = new Array(arr.length);
  const lastInd = arr.length - 1;
  if (arr.length <= count) {
    return [...arr];
  }
  while (result.length < count) {
    let i = intGetRandom(0, arr.length - 1);
    if (excludeInd[i]) {
      let overflow = false;
      while (true) {
        if (++i >= lastInd) {
          i = 0;
          if (overflow) {
            throw new Error("Overflow");
          }
          overflow = true;
        }
        if (!excludeInd[i]) {
          break;
        }
      }
    }

    result.push(arr[i]);
    excludeInd[i] = true;
  }
  return result;
}
