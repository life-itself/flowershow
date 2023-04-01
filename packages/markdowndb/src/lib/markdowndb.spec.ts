import knex from "knex";
import { MarkdownDB } from "./markdowndb";
import * as fs from "fs";
import * as path from "path";

/**
 * @jest-environment node
 */
describe("MarkdownDB", () => {
  const pathToContentFixture = "packages/markdowndb/__mocks__/content";
  let mddb: MarkdownDB;

  beforeAll(async () => {
    const dbConfig = {
      client: "sqlite3",
      connection: {
        filename: "markdown.db",
      },
    };

    mddb = new MarkdownDB(dbConfig);
    await mddb.init();
    await mddb.indexFolder({ folder: pathToContentFixture });
  });

  afterAll(async () => {
    // TODO why we have to call this twice?
    mddb.db.destroy();
    mddb._destroyDb();
  });

  test("adds tables to db", async () => {
    expect(await mddb.db.schema.hasTable("files")).toBe(true);
    expect(await mddb.db.schema.hasTable("tags")).toBe(true);
    expect(await mddb.db.schema.hasTable("file_tags")).toBe(true);
    expect(await mddb.db.schema.hasTable("links")).toBe(true);
  });

  test("indexes all files in folder", async () => {
    const allFiles = walkFolder(pathToContentFixture);
    const allIndexedFiles = await mddb.query();
    expect(allIndexedFiles.length).toBe(allFiles.length);
  });

  test("can query by folder", async () => {
    const allBlogFiles = walkFolder(`${pathToContentFixture}/blog`);
    const indexedBlogFiles = await mddb.query({
      folder: "blog",
      // filetypes: ["md", "mdx"],
    });
    expect(indexedBlogFiles.length).toBe(allBlogFiles.length);
  });

  test("can query by tags", async () => {
    const indexedEconomyFiles = await mddb.query({ tags: ["economy"] });
    const economyFilesPaths = indexedEconomyFiles.map((f) => f._path);

    // TODO this test will break if we add/remove tag from specific file
    // can this be improved?
    const expectedPaths = [
      `${pathToContentFixture}/blog/blog3.mdx`,
      `${pathToContentFixture}/blog/blog2.mdx`,
    ];

    expect(economyFilesPaths).toHaveLength(expectedPaths.length);
    economyFilesPaths.forEach((p) => {
      expect(expectedPaths).toContain(p);
    });
  });

  test("can query by extensions", async () => {
    const indexedPngFiles = await mddb.query({ extensions: ["png"] });
    const pngFilesPaths = indexedPngFiles.map((f) => f._path);

    // TODO this test will break if we add/remove tag from specific file
    // can this be improved?
    const expectedPaths = [`${pathToContentFixture}/assets/datopian-logo.png`];

    expect(pngFilesPaths).toHaveLength(expectedPaths.length);
    pngFilesPaths.forEach((p) => {
      expect(expectedPaths).toContain(p);
    });
  });

  test("can get all forward links of a file", async () => {
    const file = await mddb.query({ urlPath: "blog/blog2" });
    const forwardLinks = await mddb.getLinks({
      fileId: file[0]._id,
    });
    expect(forwardLinks.length).toBe(1);
  });

  test("can get all backward links of a file", async () => {
    const file = await mddb.query({ urlPath: "blog/blog2" });
    const backwardLinks = await mddb.getLinks({
      fileId: file[0]._id,
      direction: "backward",
    });
    expect(backwardLinks.length).toBe(2);
  });
});

function walkFolder(dir: string) {
  // TODO move to separate lib as we need it in other places too
  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  const files = dirents
    .filter((dirent) => dirent.isFile())
    .map((dirent) => path.join(dir, dirent.name));
  const dirs = dirents
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => path.join(dir, dirent.name));
  for (const d of dirs) {
    files.push(...walkFolder(d));
  }
  return files;
}
