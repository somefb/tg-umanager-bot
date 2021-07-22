/* eslint-disable @typescript-eslint/ban-ts-comment */
import { setNextDate } from "./setNextDate";

// beforeEach(() => {
//   // Temporarily allow us to alter timezone calculation for testing
//   /*eslint no-extend-native: "off"*/
//   Date.prototype.getTimezoneOffset = jest.fn(() => 73);
// });
const def = Date.prototype.getTimezoneOffset;
afterEach(() => {
  jest.restoreAllMocks();
  Date.prototype.getTimezoneOffset = def;
});

function twoDigits(v: number): string {
  return v < 10 ? "0" + v : v.toString();
}

function toTestString(dt: number): string {
  const v = new Date(dt);
  return `${twoDigits(v.getDate())} ${twoDigits(v.getHours())}:${twoDigits(v.getMinutes())}`;
}

describe("setNextDate()", () => {
  test("1st jan 20:00 => 21:05", () => {
    const dt = new Date(Date.parse("2020-01-01T20:00:00.000"));
    // @ts-ignore
    jest.spyOn(global, "Date").mockImplementation(() => dt);
    const dtNext = setNextDate(21 * 60 + 5);
    jest.restoreAllMocks();
    expect(toTestString(dtNext)).toBe(`01 21:05`);
  });
  test("1st jan 22:00 => 2nd jan 21:00", () => {
    const dt = new Date(Date.parse("2020-01-01T22:00:00.000"));
    Date.prototype.getTimezoneOffset = jest.fn(() => 0);
    // @ts-ignore
    jest.spyOn(global, "Date").mockImplementation(() => dt);
    const dtNext = setNextDate(21 * 60, 0);
    jest.restoreAllMocks();
    expect(toTestString(dtNext)).toBe(`02 21:00`);
  });
  test("1st jan 11:00 => 13:00 tz1:-5, tz2:+3 (target 21:00)", () => {
    const localTz = -5 * 60;
    const targetTz = 3 * 60;
    Date.prototype.getTimezoneOffset = jest.fn(() => -localTz);

    const dt = new Date(Date.parse("2020-01-01T11:00:00.000")); //19:00 target
    // @ts-ignore
    jest.spyOn(global, "Date").mockImplementation(() => dt);
    const dtNext = setNextDate(21 * 60, -targetTz); //set 21:00
    jest.restoreAllMocks();
    expect(toTestString(dtNext)).toBe(`01 13:00`); //21:00 target
  });
  test("1st jan 11:00 => 13:00 tz1:-5, tz2:+3 (target 05:00; tzTimeDiff < 0)", () => {
    const localTz = -5 * 60;
    const targetTz = 3 * 60;
    Date.prototype.getTimezoneOffset = jest.fn(() => -localTz);

    const dt = new Date(Date.parse("2020-01-01T11:00:00.000")); //19:00 target
    // @ts-ignore
    jest.spyOn(global, "Date").mockImplementation(() => dt);
    const dtNext = setNextDate(5 * 60, -targetTz);
    jest.restoreAllMocks();
    expect(toTestString(dtNext)).toBe(`01 21:00`); //02 05:00 target
  });
  test("1st jan 11:00 => 13:00 tz1:-5, tz2:+2 (target 21:00; tzTimeDiff >= 24)", () => {
    const localTz = 5 * 60;
    const targetTz = -2 * 60;
    Date.prototype.getTimezoneOffset = jest.fn(() => -localTz);

    const dt = new Date(Date.parse("2020-01-01T11:00:00.000")); //04:00 target
    // @ts-ignore
    jest.spyOn(global, "Date").mockImplementation(() => dt);
    const dtNext = setNextDate(21 * 60, -targetTz);
    jest.restoreAllMocks();
    expect(toTestString(dtNext)).toBe(`02 04:00`); //01 21:00 target
  });
});
