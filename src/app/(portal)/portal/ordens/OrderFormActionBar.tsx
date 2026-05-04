"use client";

import { useSidebar } from "@/components/ui/use-sidebar";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
	className?: string;
};

/** Coloque imediatamente antes de `<OrderFormActionBar>` para o fim do scroll não ficar atrás da barra `fixed`. */
export const orderFormActionBarFlowSpacerClassName =
	'pointer-events-none shrink-0 h-[calc(6.5rem+env(safe-area-inset-bottom,0px))]'

/**
 * Barra inferior fixa visível ao rolar, alinhada à coluna de conteúdo do portal
 * (menu lateral expandido ou recolhido). Coluna interna max-w-4xl alinhada como o formulário; botões à direita.
 */
export function OrderFormActionBar({ children, className }: Props) {
	const { isMobile, state } = useSidebar();

	return (
		<div
			className={cn(
				"fixed bottom-0 z-50 border-t bg-background/95 py-3 px-4 backdrop-blur right-0 supports-[backdrop-filter]:bg-background/80",
				isMobile
					? "left-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
					: cn(
							// Mesmo recuo horizontal que o main: spacer da sidebar + px-4 do scroll (abaixo)
							state === "expanded"
								? "left-[calc(var(--sidebar-width))]"
								: "left-[calc(var(--sidebar-width-icon))]",
						),
				className,
			)}
		>
			<div className="flex w-full justify-start">
				<div className="flex w-full max-w-4xl items-center justify-end gap-3">
					{children}
				</div>
			</div>
		</div>
	);
}
