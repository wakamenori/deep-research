import { searchGoogle } from "./google-search";
import { scrapeUrlWithJinaReader } from "./jina";

export type SearchResponse = {
	success: boolean;
	data: Array<{
		url: string;
		title: string;
		markdown: string;
	}>;
};

export async function search(
	query: string,
	options?: {
		timeout?: number; // seconds
		limit?: number;
	},
): Promise<SearchResponse> {
	const limit = options?.limit ?? 5;

	try {
		const googleResults = await searchGoogle(query);

		const results = await Promise.all(
			googleResults.items.slice(0, limit).map(async (item) => {
				try {
					const jinaResponse = await scrapeUrlWithJinaReader(
						item.link,
						options?.timeout,
					);

					return {
						url: item.link,
						title: item.title,
						markdown: jinaResponse.data.content,
					};
				} catch (error) {
					console.error(`Failed to scrape ${item.link}:`, error);
					return {
						url: item.link,
						title: item.title,
						markdown: "",
					};
				}
			}),
		);

		return {
			success: true,
			data: results,
		};
	} catch (error) {
		console.error("Search failed:", error);
		throw error;
	}
}
