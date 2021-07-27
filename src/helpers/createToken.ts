import intGetRandom from "./intGetRandom";

const larr = "abcdefghijklmnopqrstuvwxyz";
export default function createToken(): string {
  const str: string[] = [];
  const s = Date.now().toString();

  for (let i = 0, k = 0; i < s.length; ++i, ++k) {
    if (k == 2) {
      k = 0;
      const isUpper = intGetRandom(0, 1);
      const char = larr[Number.parseInt(s[i])];
      if (isUpper) {
        str.push(char.toUpperCase());
      } else {
        str.push(char);
      }
    } else {
      str.push(s[i]);
    }
  }

  return str.join("");
}
