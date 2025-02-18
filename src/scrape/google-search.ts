export const searchGoogle = async (query: string) => {
	const response = await fetch(
		`https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID}&q=${query}`,
	);
	return response.json() as Promise<GoogleSearchResponse>;
};

export type GoogleSearchResponse = {
	items: {
		link: string;
		title: string;
		snippet: string;
	}[];
};
