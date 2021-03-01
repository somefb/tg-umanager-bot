import dictionary, {
  generateWordPairs,
  generateUserKey,
  selectRandomFromArray,
  UserValidationKey,
  wordPairs,
} from "./dictionary";

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

  test("wordPairs are unique", () => {
    expect(checkUnique(wordPairs)).toBeTruthy();
  });
});

describe("dictionary functions", () => {
  test("generateUserKey()", () => {
    for (let i = 0; i < 10; ++i) {
      const v = generateUserKey();
      expect(v.num >= 1 && v.num <= 9, v.num.toString()).toBeTruthy();
      expect(dictionary.some((d) => d.keyWords.some((k) => k === v.word))).toBeTruthy();
    }
  });

  test("selectRandomFromArray()", () => {
    const checkArray = <T>(arr: T[], cnt: number) => {
      const v = selectRandomFromArray(arr, cnt);
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

  test("generatePairs()", () => {
    const check = (ukey: UserValidationKey, rows: number, columns: number): void => {
      const v = generateWordPairs(ukey, rows, columns);
      const errMsg = `Error for word '${ukey.word}'. Got arr: ${JSON.stringify(v)}`;

      // console.warn("got", JSON.stringify(v));
      // length is expected
      expect(v, errMsg).toHaveLength(rows * columns);
      // has keyWord
      expect(
        v.some((a) => a.two[0] === ukey.word[0]),
        errMsg
      ).toBeTruthy();
      expect(checkUnique(v), errMsg).toBeTruthy();

      // has only one keyWord
      expect(v.reduce((acc, a) => (a.two[0] === ukey.word[0] ? acc + 1 : acc), 0)).toBe(1);

      // doesn't have nulls
      expect(
        v.some((v) => v == null),
        errMsg
      ).toBeFalsy();
    };

    check({ num: 1, word: dictionary[0].keyWords[0] }, 4, 3);
    check({ num: 1, word: dictionary[0].keyWords[0] }, 4, 3);
    check({ num: 1, word: dictionary[1].keyWords[1] }, 4, 3);
    check({ num: 1, word: dictionary[4].keyWords[2] }, 4, 3);
  });
});
