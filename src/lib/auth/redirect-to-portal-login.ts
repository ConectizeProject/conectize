import { PORTAL_INTENDED_PATH_HEADER } from "@/lib/auth/portal-intended-path";
import { logPortalRedirect } from "@/lib/auth/portal-redirect-log";
import { assertSafePortalPath } from "@/lib/auth/safe-redirect";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function normalizeLoginRedirectTarget(path: string): string {
	const safe = assertSafePortalPath(path);
	if (safe === "/portal/login" || safe.startsWith("/portal/login?"))
		return "/portal";
	return safe;
}

/**
 * Fallback quando o layout/página detecta ausência de sessão sem o middleware ter redirecionado
 * (caso raro). O fluxo normal é 302 no middleware com `?redirectTo=` na URL.
 */
export async function redirectToPortalLogin(): Promise<never> {
	const h = await headers();
	const fromHeader = h.get(PORTAL_INTENDED_PATH_HEADER)?.trim();

	const raw = (fromHeader || "").trim() || undefined;
	const target = raw ? normalizeLoginRedirectTarget(raw) : "/portal";
	const loginPath = `/portal/login?redirectTo=${encodeURIComponent(target)}`;

	logPortalRedirect("redirectToPortalLogin(fallback)", {
		fromHeader: fromHeader ?? "(ausente)",
		chosen: raw ?? "(fallback /portal)",
		normalizedTarget: target,
		loginPath,
	});

	redirect(loginPath);
}
