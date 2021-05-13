import arrayFilterRandom from "../helpers/arrayFilterRandom";
import arrayShuffle from "../helpers/arrayShuffle";
import fixOverflowIndex from "../helpers/fixOverflowIndex";
import intGetRandom from "../helpers/intGetRandom";

const dictionary = [
  {
    keyWords: ["волк", "варан", "вагон"],
    replacers: [
      { one: "ожидание", two: "время", oneEng: "time" },
      { one: "ёмкость", two: "ведро", oneEng: "bucket" },
      { one: "везение", two: "вероятность", oneEng: "probability" },
      { one: "блендер", two: "венчик", oneEng: "whisk" },
      { one: "низко", two: "высоко", oneEng: "high" },
    ],
  },
  {
    keyWords: ["черепаха", "червь", "чародей"],
    replacers: [
      { one: "лес", two: "чаща", oneEng: "forest" },
      { one: "правда", two: "честность", oneEng: "honesty" },
      { one: "блеск", two: "чистота", oneEng: "purity" },
      { one: "книга", two: "чтиво", oneEng: "reading" },
      { one: "рукоять", two: "черенок", oneEng: "stem" },
    ],
  },
  {
    keyWords: ["травинка", "терем", "танк"],
    replacers: [
      { one: "хруст", two: "треск", oneEng: "crunch" },
      { one: "мотоблок", two: "трактор", oneEng: "tractor" },
      { one: "спорт", two: "тренировка", oneEng: "sport" },
      { one: "покос", two: "триммер", oneEng: "mowing" },
      { one: "мгла", two: "тень", oneEng: "mist" },
    ],
  },
  {
    keyWords: ["палец", "поцелуй", "призрак"],
    replacers: [
      { one: "русло", two: "приток", oneEng: "riverbed" },
      { one: "солидарность", two: "помощь", oneEng: "solidarity" },
      { one: "зелень", two: "природа", oneEng: "green" },
      { one: "развилка", two: "перекрёсток", oneEng: "fork" },
      { one: "дорога", two: "путь", oneEng: "road" },
    ],
  },
  {
    keyWords: ["жизнь", "желание", "жаба"],
    replacers: [
      { one: "скупость", two: "жадность", oneEng: "cheapness" },
      { one: "грязь", two: "жижа", oneEng: "mud" },
      { one: "мука", two: "жернова", oneEng: "flour" },
      { one: "претензия", two: "жалоба", oneEng: "complaint" },
      { one: "холод", two: "жара", oneEng: "cold" },
    ],
  },
  {
    keyWords: ["камень", "канистра", "кит"],
    replacers: [
      { one: "стул", two: "кресло", oneEng: "chair" },
      { one: "дьякон", two: "ксёнз", oneEng: "deacon" },
      { one: "ушу", two: "карате", oneEng: "wushu" },
      { one: "блокбастер", two: "кино", oneEng: "blockbuster" },
      { one: "творчество", two: "креатив", oneEng: "creativity" },
    ],
  },
  {
    keyWords: ["луч", "луна", "лиса"],
    replacers: [
      { one: "сундучок", two: "ларец", oneEng: "box" },
      { one: "крючок", two: "леска", oneEng: "hook" },
      { one: "страсть", two: "либидо", oneEng: "passion" },
      { one: "вялость", two: "лень", oneEng: "laziness" },
      { one: "хорёк", two: "ласка", oneEng: "weasel" },
    ],
  },
  {
    keyWords: ["струна", "сова", "слон"],
    replacers: [
      { one: "мясо", two: "струганина", oneEng: "meat" },
      { one: "белое", two: "сало", oneEng: "white" },
      { one: "радио", two: "сарафанное", oneEng: "radio" },
      { one: "быки", two: "стадо", oneEng: "bulls" },
      { one: "дырявое", two: "сито", oneEng: "leaky" },
    ],
  },
  {
    keyWords: ["апельсин", "ананас", "антилопа"],
    replacers: [
      { one: "качели", two: "аттракцион", oneEng: "swing" },
      { one: "шутка", two: "анекдот", oneEng: "joke" },
      { one: "обозначение", two: "артикул", oneEng: "designation" },
      { one: "глобус", two: "атлас", oneEng: "globe" },
      { one: "лук", two: "арбалет", oneEng: "bow" },
    ],
  },
];
export const dictDeclinatedWords = new Map<string, Record<number, string>>();
dictDeclinatedWords.set("волк", ["волка", "волков"]);
dictDeclinatedWords.set("варан", ["варана", "варанов"]);
dictDeclinatedWords.set("вагон", ["вагона", "вагонов"]);
dictDeclinatedWords.set("черепаха", ["черепахи", "черепах"]);
dictDeclinatedWords.set("червь", ["червя", "червей"]);
dictDeclinatedWords.set("чародей", ["чародея", "чародеев"]);
dictDeclinatedWords.set("травинка", ["травинки", "травинок"]);
dictDeclinatedWords.set("терем", ["терема", "теремов"]);
dictDeclinatedWords.set("танк", ["танка", "танков"]);
dictDeclinatedWords.set("палец", ["пальца", "пальцев"]);
dictDeclinatedWords.set("поцелуй", ["поцелуя", "поцелуев"]);
dictDeclinatedWords.set("призрак", ["призрака", "призраков"]);
dictDeclinatedWords.set("жизнь", ["жизни", "жизней"]);
dictDeclinatedWords.set("желание", ["желания", "желаний"]);
dictDeclinatedWords.set("жаба", ["жабы", "жаб"]);
dictDeclinatedWords.set("камень", ["камня", "камней"]);
dictDeclinatedWords.set("канистра", ["канистры", "канистр"]);
dictDeclinatedWords.set("кит", ["кита", "китов"]);
dictDeclinatedWords.set("луч", ["луча", "лучей"]);
dictDeclinatedWords.set("луна", ["луны", "лун"]);
dictDeclinatedWords.set("лиса", ["лисы", "лис"]);
dictDeclinatedWords.set("струна", ["струны", "струн"]);
dictDeclinatedWords.set("сова", ["совы", "сов"]);
dictDeclinatedWords.set("слон", ["слона", "слонов"]);
dictDeclinatedWords.set("апельсин", ["апельсина", "апельсинов"]);
dictDeclinatedWords.set("ананас", ["ананаса", "ананасов"]);
dictDeclinatedWords.set("антилопа", ["антилопы", "антилоп"]);

export function declinateWord(str: { num: number; word: string }): string {
  let w = str.word;
  if (str.num !== 1) {
    const set = dictDeclinatedWords.get(str.word);
    if (set) {
      w = str.num >= 5 ? set[1] : set[0];
    }
  }
  return `${str.num} ${w}`;
}

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
  oneEng: string;
  two: string;
}

export interface UserValidationKey {
  num: number;
  word: string;
}
