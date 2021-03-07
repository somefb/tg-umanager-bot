/** maps pointed array to 2d array which is table */
export default function arrayMapToTable<T, R>(
  arr: T[],
  rows: number,
  columns: number,
  callback: (item: T) => R
): Array<Array<R>> {
  const result: Array<Array<R>> = [];
  let i = 0;
  for (let r = 0; r < rows; ++r) {
    const vArr: Array<R> = [];
    result.push(vArr);
    for (let c = 0; c < columns && i < arr.length; ++c, ++i) {
      vArr.push(callback(arr[i]));
    }
  }

  return result;
}
