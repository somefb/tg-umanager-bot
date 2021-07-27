import dateToPastTime from "./dateToPastTime";

describe("dateToPastTime()", () => {
  test("30с назад", () => {
    const dt = Date.now() - 30 * 1000;
    expect(dateToPastTime(dt)).toBe("30с назад");
  });

  test("4м 59с назад", () => {
    const dt = Date.now() - 4 * 60000 - 59 * 1000;
    expect(dateToPastTime(dt)).toBe("4м 59с назад");
  });
  test("5м назад skip diffMin if m>=5", () => {
    const dt = Date.now() - 5 * 60000 - 59 * 1000;
    expect(dateToPastTime(dt)).toBe("5м назад");
  });
  test("17м назад", () => {
    const dt = Date.now() - 17 * 60000;
    expect(dateToPastTime(dt)).toBe("17м назад");
  });

  test("2ч назад", () => {
    const dt = Date.now() - 2 * 60 * 60000;
    expect(dateToPastTime(dt)).toBe("2ч назад");
  });
  test("12ч 17м назад", () => {
    const dt = Date.now() - 12 * 60 * 60000 - 17 * 60000;
    expect(dateToPastTime(dt)).toBe("12ч 17м назад");
  });
  test("23ч назад", () => {
    const dt = Date.now() - 23 * 60 * 60000;
    expect(dateToPastTime(dt)).toBe("23ч назад");
  });

  test("1д 2ч назад", () => {
    const dt = Date.now() - 1 * 24 * 60 * 60000 - 2 * 60 * 60000;
    expect(dateToPastTime(dt)).toBe("1д 2ч назад");
  });

  test("2д 2ч назад", () => {
    const dt = Date.now() - 2 * 24 * 60 * 60000 - 2 * 60 * 60000;
    expect(dateToPastTime(dt)).toBe("2д 2ч назад");
  });

  test("3д назад: skip diffHour if d>2", () => {
    const dt = Date.now() - 25 * 24 * 60 * 60000 - 2 * 60 * 60000;
    expect(dateToPastTime(dt)).toBe("25д назад");
  });
});
