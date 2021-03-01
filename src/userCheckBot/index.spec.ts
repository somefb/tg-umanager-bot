import dictionary, { generateUserKey, selectRandomFromArray } from "./dictionary";

describe("dictionary", () => {
  // validate commands according to tg-spec: https://core.telegram.org/bots/api#botcommand
  dictionary.forEach((v) => {
    describe(v.keyWords.join(", "), () => {
      test("keyWords have same first letter", () => {
        const firstLetter = v.keyWords[0][0];
        v.keyWords.forEach((k) => {
          expect(k[0] === firstLetter).toBeTruthy();
        });
      });
      test("2nd replacer have same first letter", () => {
        const firstLetter = v.keyWords[0][0];
        v.replacers.forEach((k) => {
          expect(k.two[0] === firstLetter).toBeTruthy();
        });
      });
    });
  });
});

describe("dictionary functions", () => {
  test("generateUserKey", () => {
    for (let i = 0; i < 10; ++i) {
      const v = generateUserKey();
      expect(v.num >= 1 && v.num <= 9, v.num.toString()).toBeTruthy();
      expect(dictionary.some((d) => d.keyWords.some((k) => k === v.word))).toBeTruthy();
    }
  });

  const checkUnique = <T>(arr: T[]): boolean => {
    return !arr.some((v, k) => {
      for (let i = 0; i < arr.length; ++i) {
        if (i === k) {
          continue;
        }
        if (v === arr[i]) {
          return true;
        }
      }
      return false;
    });
  };

  test("selectRandomFromArray", () => {
    const checkArray = <T>(arr: T[], cnt: number) => {
      const v = selectRandomFromArray(arr, cnt);
      //console.warn("got", JSON.stringify(v));
      expect(v.length).toBe(cnt);
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
});
