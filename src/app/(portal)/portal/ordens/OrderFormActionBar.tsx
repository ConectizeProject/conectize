"use client";

import type { ReactNode } from "react";
import { PORTAL_LAYOUT_CONTAINER, PORTAL_NARROW_FORM_CONTAINER } from "@/lib/portal/portal-layout";
import { cn } from "@/lib/utils";

type Props = {
	children: ReactNode;
	className?: string;
};

/** Coloque imediatamente antes de `<OrderFormActionBar>` para o fim do scroll não ficar atrás da barra `fixed`. */
export const orderFormActionBarFlowSpacerClassName =
	"pointer-events-none shrink-0 h-[calc(6.5rem+env(safe-area-inset-bottom,0px))]";

/**
 * Barra inferior fixa visível ao rolar. O fundo cobre a largura da tela; os
 * botões seguem a mesma coluna estreita centralizada do formulário.
 */
export function OrderFormActionBar({ children, className }: Props) {
	return (
		<div
			className={cn(
				"fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
				className,
			)}
		>
			<div className={PORTAL_LAYOUT_CONTAINER}>
				<div
					className={cn(
						PORTAL_NARROW_FORM_CONTAINER,
						"flex items-center justify-end gap-3",
					)}
				>
					{children}
				</div>
			</div>
		</div>
	);
}
