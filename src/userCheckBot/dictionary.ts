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

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateUserKey(): { num: number; word: string } {
  const num = getRandomInt(1, 9);
  const dictVal = dictionary[getRandomInt(0, dictionary.length - 1)];
  const word = dictVal.keyWords[getRandomInt(0, dictVal.keyWords.length - 1)];
  return { num, word };
}

export function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function selectRandomFromArray<T>(arr: T[], count: number): T[] {
  const result: T[] = [];
  const excludeInd: boolean[] = new Array(arr.length);
  const lastInd = arr.length - 1;
  if (arr.length <= count) {
    return [...arr];
  }
  while (result.length < count) {
    let i = getRandomInt(0, arr.length - 1);
    if (excludeInd[i]) {
      let overflow = false;
      while (true) {
        if (++i >= lastInd) {
          i = 0;
          if (overflow) {
            throw new Error("Overflow");
          }
          overflow = true;
        }
        if (!excludeInd[i]) {
          break;
        }
      }
    }

    result.push(arr[i]);
    excludeInd[i] = true;
  }
  return result;
}

//todo split to columns/rows ???
export function generateWordPairs(ukey: UserValidationKey, rows: number, columns: number): WordPair[] {
  const keyPairs = dictionary.find((v) => v.keyWords[0][0] === ukey.word[0])?.replacers;
  if (!keyPairs) {
    throw new Error(`word '${ukey.word}' is not defined in dictionary`);
  }

  const cnt = rows * columns;

  const p = wordPairs.filter((v) => v.one[0] !== ukey.word[0] && v.two[0] !== ukey.word[0]);
  const arr = selectRandomFromArray(p, cnt - 1);

  const keyPair = keyPairs[getRandomInt(0, keyPairs.length - 1)];
  const keyPairInd = getRandomInt(0, arr.length - 1);
  arr.splice(keyPairInd, 0, keyPair);

  return arr;
}

export interface WordPair {
  one: string;
  two: string;
}

export interface UserValidationKey {
  num: number;
  word: string;
}
