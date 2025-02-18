import dotenv from "dotenv";
import assert from "node:assert";
import { beforeEach, describe, it } from "vitest";

import { scrapeUrlWithJinaReader } from "./jina";

// .env.localファイルを読み込む
beforeEach(() => {
	dotenv.config({
		path: "../../.env.local",
	});
});

describe("scrapeUrlWithJinaReader", () => {
	it("should scrape a url with jina reader", async () => {
		const result = await scrapeUrlWithJinaReader("https://www.google.com");
		console.log(result);
		assert.ok(result);
	}, 15000);
});
