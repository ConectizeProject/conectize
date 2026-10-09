export function mcpText(text: string, isError = false) {
	return {
		content: [{ type: 'text' as const, text }],
		isError,
	}
}
