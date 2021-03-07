/** returns the newIndex if the pointed < 0 or > lastIndex */
export default function fixOverflowIndex(curIndex: number, lastIndex: number): number {
  while (curIndex > lastIndex) {
    curIndex -= lastIndex + 1;
  }
  while (curIndex < 0) {
    curIndex += lastIndex + 1;
  }
  return curIndex;
}
