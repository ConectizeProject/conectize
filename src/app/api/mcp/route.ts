import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { resolveMcpActor } from '@/lib/mcp/actor'
import { createConectizeMcpServer } from '@/lib/mcp/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function unauthorized() {
	return Response.json(
		{
			jsonrpc: '2.0',
			error: { code: -32001, message: 'Unauthorized' },
			id: null,
		},
		{ status: 401 },
	)
}

async function handle(request: Request) {
	const actor = await resolveMcpActor(request.headers.get('authorization'))
	if (!actor) return unauthorized()

	const server = createConectizeMcpServer(actor)
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	})
	await server.connect(transport)
	return transport.handleRequest(request)
}

export function GET(request: Request) {
	return handle(request)
}

export function POST(request: Request) {
	return handle(request)
}

export function DELETE(request: Request) {
	return handle(request)
}
