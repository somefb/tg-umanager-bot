/* eslint-disable @typescript-eslint/no-var-requires */
import arrayShuffle from "../helpers/arrayShuffle";
import fixOverflowIndex from "../helpers/fixOverflowIndex";
import dictionary, {
  generateWordPairs,
  generateUserKey,
  UserValidationKey,
  wordPairs,
  generateWordPairsNext,
  WordPair,
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

beforeAll(() => {
  const m = require("../helpers/arrayShuffle");
  //todo such mock doesn't work inside module
  m.default = <T>(arr: T[]) => {
    // console.warn("shuffle");
    return arr;
  };
});

// afterAll(() => {});

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

  test("generatePairs()", () => {
    const check = (ukey: UserValidationKey, count: number): void => {
      const v = generateWordPairs(ukey, count);
      const errMsg = `Error for word '${ukey.word}'. Got arr: ${JSON.stringify(v)}`;

      // console.warn("got", JSON.stringify(v));
      // length is expected
      expect(v, errMsg).toHaveLength(count);
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

    check({ num: 1, word: dictionary[0].keyWords[0] }, 12);
    check({ num: 1, word: dictionary[0].keyWords[0] }, 10);
    check({ num: 1, word: dictionary[1].keyWords[1] }, 8);
    check({ num: 1, word: dictionary[4].keyWords[2] }, 9);
  });

  test("generateWordPairsNext()", () => {
    // preparing mock data
    const word = "волк";
    const myPair = { one: "d1", two: "весна" };
    const pairs = [
      //
      { one: "a1", two: "a2" },
      { one: "b1", two: "b2" },
      { one: "c1", two: "c2" },
      myPair,
    ];
    const keyPairIndex = pairs.findIndex((v) => v == myPair);

    //check if shuffle mocked
    const was = [...pairs];
    arrayShuffle(pairs);
    expect(was.every((v, i) => v === pairs[i])).toBeTruthy();

    // ordinary checking
    {
      const ukey = { num: 1, word };
      const clonedArr = JSON.parse(JSON.stringify(pairs)) as WordPair[];
      const r = generateWordPairsNext(ukey, clonedArr[0], clonedArr, true);
      expect(r.truthy).not.toBe(r.expected);
      expect(r.truthy).toBe("a2");

      expect(r.expected).toBe(r.pairs[0].two);
      expect(r.pairs).toHaveLength(pairs.length);
      //check if has unique user-keyPair
      expect(r.pairs.reduce((acc, v) => (v.two[0] === myPair.two[0] ? acc + 1 : acc), 0)).toBe(1);
    }

    // check if indexes are ok
    for (let i = 0; i < pairs.length; ++i) {
      for (let n = 1; n < pairs.length; ++n) {
        const ukey = { num: n, word };
        const clonedArr = pairs.map((p) => ({ ...p }));
        const r = generateWordPairsNext(ukey, clonedArr[i], clonedArr, true);
        expect(r.truthy).not.toBe(r.expected);
        expect(r.truthy).toBe(pairs[i].two);

        const expectedIndex = fixOverflowIndex(keyPairIndex + ukey.num, pairs.length - 1);
        expect(r.expected, i.toString()).toBe(r.pairs[expectedIndex].two);
        expect(r.pairs).toHaveLength(pairs.length);
        //check if has unique user-keyPair
        expect(r.pairs.reduce((acc, v) => (v.two[0] === myPair.two[0] ? acc + 1 : acc), 0)).toBe(1);
      }
    }
  });
});
