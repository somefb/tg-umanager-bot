import fixOverflowIndex from "./fixOverflowIndex";

describe("fixOverflowIndex()", () => {
  test("ordinary case", () => {
    expect(fixOverflowIndex(0, 4)).toBe(0);
    expect(fixOverflowIndex(4, 4)).toBe(4);
  });
  test("< 0", () => {
    expect(fixOverflowIndex(-1, 4)).toBe(4);
  });
  test("> lastIndex", () => {
    expect(fixOverflowIndex(6, 4)).toBe(1);
  });
});
