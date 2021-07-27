import intGetRandom from "./intGetRandom";

export default function arrayGetRandomItem<T>(arr: T[]): T {
  return arr[intGetRandom(0, arr.length - 1)];
}
