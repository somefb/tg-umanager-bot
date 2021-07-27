import objectRecursiveSearch from "./objectRecursiveSearch";

describe("objectRecursiveSearch()", () => {
  test("{ value: 1 }: look for value:1", () => {
    expect(objectRecursiveSearch({ value: 1 }, (key, obj) => key === "value" && obj[key] === 1)).toBe(true);
  });
  test("{ value: 1 }: look for value:6", () => {
    expect(objectRecursiveSearch({ value: 1 }, (key, obj) => key === "value" && obj[key] === 6)).toBe(false);
  });
  test("{ value: 1 }: look for v:1", () => {
    expect(objectRecursiveSearch({ value: 1 }, (key, obj) => key === "v" && obj[key] === 1)).toBe(false);
  });
  test("[1, 2, 3]: look for v:1", () => {
    expect(objectRecursiveSearch([1, 2, 3], (key, obj) => key === "v" && obj[key] === 1)).toBe(false);
  });
  test("[{val: 2},{v:1}]: look for v:1", () => {
    expect(objectRecursiveSearch([{ val: 2 }, { v: 1 }], (key, obj) => key === "v" && obj[key] === 1)).toBe(true);
  });
  test("{v:1, o: [{v:2}]}: look for v:2", () => {
    expect(objectRecursiveSearch({ v: 1, o: [{ v: 2 }] }, (key, obj) => key === "v" && obj[key] === 2)).toBe(true);
  });
  test("{v:1, o: [{v:0}]}: look for v:0", () => {
    expect(objectRecursiveSearch({ v: 1, o: [{ v: 0 }] }, (key, obj) => key === "v" && obj[key] === 0)).toBe(true);
  });
  test("{v:1, o: {v:0, o2:{a:1, v:2}}}: look for v:2", () => {
    expect(
      objectRecursiveSearch({ v: 1, o: { v: 0, o2: { a: 1, v: 2 } } }, (key, obj) => key === "v" && obj[key] === 2)
    ).toBe(true);
  });

  const upd = {
    update_id: 123,
    message: {
      message_id: 10,
      from: {
        id: 233,
        is_bot: false,
        first_name: "S",
        last_name: "B",
        username: "testUser",
        language_code: "en",
      },
      chat: { id: -3232, title: "TestBotGroup", type: "supergroup" },
      date: 111701231,
      new_chat_participant: { id: 123, is_bot: true, first_name: "Играем", username: "s" },
      new_chat_member: { id: 123, is_bot: true, first_name: "Играем", username: "s" },
      new_chat_members: [{ id: 123, is_bot: true, first_name: "Играем", username: "s" }],
    },
  };

  test("big object", () => {
    let chatId;
    expect(
      objectRecursiveSearch(upd, (key, obj) => {
        if (key === "chat") {
          chatId = obj[key].id;
          return true;
        }
        return false;
      })
    ).toBe(true);
    expect(chatId).toBe(-3232);
  });
});
