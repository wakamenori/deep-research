import assert from "node:assert";
import { describe, it, beforeEach } from "vitest";

import { scrapeUrlWithJinaReader } from "./jina";

describe("scrapeUrlWithJinaReader", () => {
	it("should scrape a url with jina reader", async () => {
		const result = await scrapeUrlWithJinaReader(
			"https://zenn.dev/byebyeworld/articles/vscode-typescript-debug",
		);
		assert.ok(result);
	});
});
