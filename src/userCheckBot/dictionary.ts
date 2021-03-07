import arrayFilterRandom from "../helpers/arrayFilterRandom";
import arrayShuffle from "../helpers/arrayShuffle";
import fixOverflowIndex from "../helpers/fixOverflowIndex";
import intGetRandom from "../helpers/intGetRandom";

const dictionary = [
  {
    keyWords: ["волк", "варан", "вагон"],
    replacers: [
      { one: "ожидание", two: "время" },
      { one: "ёмкость", two: "ведро" },
      { one: "везение", two: "вероятность" },
      { one: "блендер", two: "венчик" },
      { one: "низко", two: "высоко" },
    ],
  },
  {
    keyWords: ["черепаха", "червь", "чародей"],
    replacers: [
      { one: "лес", two: "чаща" },
      { one: "правда", two: "честнось" },
      { one: "блеск", two: "чистота" },
      { one: "книга", two: "чтиво" },
      { one: "низко", two: "черенок" },
    ],
  },
  {
    keyWords: ["травинка", "терем", "танк"],
    replacers: [
      { one: "хруст", two: "треск" },
      { one: "мотоблок", two: "трактор" },
      { one: "спорт", two: "тренировка" },
      { one: "покос", two: "триммер" },
      { one: "мгла", two: "тень" },
    ],
  },
  {
    keyWords: ["палец", "поцелуй", "призрак"],
    replacers: [
      { one: "русло", two: "приток" },
      { one: "солидарность", two: "помощь" },
      { one: "зелень", two: "природа" },
      { one: "развилка", two: "перекрёсток" },
      { one: "дорога", two: "путь" },
    ],
  },
  {
    keyWords: ["жизнь", "желание", "жаба"],
    replacers: [
      { one: "скупость", two: "жадность" },
      { one: "грязь", two: "жижа" },
      { one: "мука", two: "жернова" },
      { one: "претензия", two: "жалоба" },
      { one: "холод", two: "жара" },
    ],
  },
  {
    keyWords: ["камень", "канистра", "кит"],
    replacers: [
      { one: "стул", two: "кресло" },
      { one: "дьякон", two: "ксёнз" },
      { one: "ушу", two: "карате" },
      { one: "блокбастер", two: "кино" },
      { one: "творчество", two: "креатив" },
    ],
  },
  {
    keyWords: ["луч", "луна", "лиса"],
    replacers: [
      { one: "сундучок", two: "ларец" },
      { one: "крючок", two: "леска" },
      { one: "страсть", two: "либидо" },
      { one: "блокбастер", two: "лень" },
      { one: "хорёк", two: "ласка" },
    ],
  },
  {
    keyWords: ["струна", "сова", "слон"],
    replacers: [
      { one: "мясо", two: "струганина" },
      { one: "белое", two: "сало" },
      { one: "радио", two: "сарафанное" },
      { one: "быки", two: "стадо" },
      { one: "дырявое", two: "сито" },
    ],
  },
  {
    keyWords: ["апельсин", "ананас", "антилопа"],
    replacers: [
      { one: "качели", two: "аттракцион" },
      { one: "шутка", two: "анекдот" },
      { one: "обозначение", two: "артикул" },
      { one: "глобус", two: "атлас" },
      { one: "лук", two: "арбалет" },
    ],
  },
];

export const wordPairs: WordPair[] = [];

dictionary.forEach((s) => {
  s.replacers.forEach((pair) => {
    wordPairs.push(pair);
  });
});

export default dictionary;

export function generateUserKey(): { num: number; word: string } {
  const num = intGetRandom(1, 9);
  const dictVal = dictionary[intGetRandom(0, dictionary.length - 1)];
  const word = dictVal.keyWords[intGetRandom(0, dictVal.keyWords.length - 1)];
  return { num, word };
}

export function generateWordPairs(ukey: UserValidationKey, count: number): WordPair[] {
  const keyPairs = dictionary.find((v) => v.keyWords[0][0] === ukey.word[0])?.replacers;
  if (!keyPairs) {
    throw new Error(`word '${ukey.word}' is not defined in dictionary`);
  }

  const p = wordPairs.filter((v) => v.one[0] !== ukey.word[0] && v.two[0] !== ukey.word[0]);
  const arr = arrayFilterRandom(p, count - 1);

  const keyPair = keyPairs[intGetRandom(0, keyPairs.length - 1)];
  const keyPairInd = intGetRandom(0, arr.length - 1);
  arr.splice(keyPairInd, 0, keyPair);

  return arr;
}

export function generateWordPairsNext(
  ukey: UserValidationKey,
  selectedPair: WordPair,
  previousPairs: WordPair[],
  isDirect: boolean
): { pairs: WordPair[]; expected: string; truthy: string } {
  arrayShuffle(previousPairs);

  const lastIndex = previousPairs.length - 1;
  let truthyIndex = previousPairs.findIndex((v) => v === selectedPair);
  const ukeyIndex = previousPairs.findIndex((v) => v.two[0] === ukey.word[0]);

  let expectedIndex = ukeyIndex + (isDirect ? ukey.num : -1 * ukey.num);
  expectedIndex = fixOverflowIndex(expectedIndex, lastIndex);
  if (expectedIndex === truthyIndex) {
    const prevTrythyIndex = truthyIndex;

    while (1) {
      truthyIndex = fixOverflowIndex(--truthyIndex, lastIndex);
      if (truthyIndex !== expectedIndex && truthyIndex !== ukeyIndex) {
        break;
      }
    }
    [previousPairs[truthyIndex], previousPairs[prevTrythyIndex]] = [
      previousPairs[prevTrythyIndex],
      previousPairs[truthyIndex],
    ];
  }

  return { pairs: previousPairs, expected: previousPairs[expectedIndex].two, truthy: selectedPair.two };
}

export interface WordPair {
  one: string;
  two: string;
}

export interface UserValidationKey {
  num: number;
  word: string;
}
