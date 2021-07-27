/** maps pointed array to 2d array which is table (iteration by column) */
export default function arrayarrayMapToTableByColumn<T, R>(
  arr: T[],
  rows: number,
  columns: number,
  callback: (item: T) => R
): Array<Array<R>> {
  const result: Array<Array<R>> = [];
  for (let i = 0; i < rows; ++i) {
    result.push([]);
  }

  let i = 0;
  for (let c = 0; c < columns; ++c) {
    for (let r = 0; r < rows && i < arr.length; ++r, ++i) {
      result[r].push(callback(arr[i]));
    }
  }

  return result;
}
