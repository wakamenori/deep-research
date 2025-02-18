export type JinaResponse = {
	code: number;
	status: number;
	data: {
		title: string;
		description: string;
		url: string;
		content: string;
		usage: {
			tokens: number;
		};
	};
};

export const scrapeUrlWithJinaReader = async (
	url: string,
	timeout?: number,
) => {
	const token = process.env.JINA_API_KEY;
	if (!token) {
		throw new Error("JINA_API_KEY is not set");
	}

	try {
		const response = await fetch("https://r.jina.ai/", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"X-Return-Format": "markdown",
				...(timeout && { "X-Timeout": timeout.toString() }),
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ url }),
		});
		return response.json() as Promise<JinaResponse>;
	} catch (error) {
		console.error(error);
		throw error;
	}
};
