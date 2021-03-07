import arrayMapToTableByColumn from "./arrayMapToTableByColumn";

describe("arrayMapToTableByColumn()", () => {
  test("[1, 2, 3, 4, 5, 6], 2rows, 3columns", () => {
    const v = arrayMapToTableByColumn([1, 2, 3, 4, 5, 6], 2, 3, (item) => item);
    expect(v).toHaveLength(2);
    v.forEach((a) => expect(a).toHaveLength(3));
    expect(v[0][0]).toBe(1);
    expect(v[1][0]).toBe(2);

    expect(v[0][1]).toBe(3);
    expect(v[1][1]).toBe(4);

    expect(v[0][2]).toBe(5);
    expect(v[1][2]).toBe(6);
  });

  test("['a','b','c'], 2rows, 3columns; arr less then rows*col", () => {
    // when arr length less than rows*columns
    const v2 = arrayMapToTableByColumn(["a", "b", "c"], 2, 3, (item) => item);
    expect(v2).toHaveLength(2);
    expect(v2[0]).toHaveLength(2);
    expect(v2[1]).toHaveLength(1);

    expect(v2[0][0]).toBe("a");
    expect(v2[1][0]).toBe("b");

    expect(v2[0][1]).toBe("c");
  });
});
