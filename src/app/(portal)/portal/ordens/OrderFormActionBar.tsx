"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
	className?: string;
};

/** Coloque imediatamente antes de `<OrderFormActionBar>` para o fim do scroll não ficar atrás da barra `fixed`. */
export const orderFormActionBarFlowSpacerClassName =
	"pointer-events-none shrink-0 h-[calc(6.5rem+env(safe-area-inset-bottom,0px))]";

/**
 * Barra inferior fixa visível ao rolar, alinhada à coluna de conteúdo do portal.
 * Coluna interna max-w-4xl alinhada como o formulário; botões à direita.
 */
export function OrderFormActionBar({ children, className }: Props) {
	return (
		<div
			className={cn(
				"fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
				className,
			)}
		>
			<div className="flex w-full justify-center px-4 lg:px-6">
				<div className="flex w-full max-w-4xl items-center justify-end gap-3">
					{children}
				</div>
			</div>
		</div>
	);
}
