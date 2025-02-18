export const searchGoogle = async (query: string) => {
	const key = process.env.GOOGLE_SEARCH_API_KEY;
	const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
	if (!key || !cx) {
		throw new Error(
			"GOOGLE_SEARCH_API_KEY or GOOGLE_CUSTOM_SEARCH_ENGINE_ID is not set",
		);
	}
	const response = await fetch(
		`https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${query}`,
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
