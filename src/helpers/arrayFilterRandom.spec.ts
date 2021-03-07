import arrayFilterRandom from "./arrayFilterRandom";

const checkUnique = <T>(arr: T[]): boolean => {
  return !arr.some((v, k) => {
    for (let i = 0; i < arr.length; ++i) {
      if (i === k) {
        continue;
      }
      if (v === arr[i]) {
        console.warn(`not unique: v[${k}] === arr[${i}]`, v, arr[i], arr);
        return true;
      }
    }
    return false;
  });
};

test("arrayFilterRandom()", () => {
  const checkArray = <T>(arr: T[], cnt: number) => {
    const v = arrayFilterRandom(arr, cnt);
    //console.warn("got", JSON.stringify(v));
    expect(v).toHaveLength(cnt);
    expect(checkUnique(v), JSON.stringify(v)).toBeTruthy();
    expect(
      v.some((v) => v == null),
      JSON.stringify(v)
    ).toBeFalsy();
  };

  checkArray(["a", "b", "c", "d", "e"], 2);
  checkArray(["a", "b", "c", "d", "e"], 2);
  checkArray(["a", "b", "c", "d", "e"], 2);
  checkArray(["a", "b", "c", "d", "e"], 2);
  checkArray(["a", "b", "c", "d", "e"], 2);
  checkArray(["a", "b", "c", "d", "e"], 3);
  checkArray(["a", "b", "c", "d", "e"], 4);
  checkArray(["a", "b", "c", "d", "e"], 5);
});
