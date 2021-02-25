import RepoGoogleDrive from "./repoGoogleDrive";

const repo = new RepoGoogleDrive();

(async () => {
  const t1 = await repo.get("test.json");
  await repo.save("test.json", { someValue: Date.now() });
  const t2 = await repo.get("test.json");

  console.warn("was", t1);
  console.warn("now", t2);
})();
