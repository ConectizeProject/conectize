import type { ServiceLine } from "@/components/orders";
import type { OrderDiscountCommissionValues } from "@/lib/orders/order-discount-commission";
import { EMPTY_ORDER_DISCOUNT_COMMISSION } from "@/lib/orders/order-discount-commission";
import * as Yup from "yup";

export type FormValues = {
	customerId: string;
	document: string;
	title: string;
	status: string;
	sellerUserId: string;
	deviceModelId: string;
	brand: string;
	model: string;
	deviceType: string;
	imei: string;
	color: string;
	deviceLocation: string;
	isWarranty: boolean;
	estimatedReadyAt: string;
	passcodeType: string;
	passcodeText: string;
	passcodePattern: string;
	paymentMethods: Array<{
		payment_method_id: string;
		installments?: number;
		value_cents?: number | null;
	}>;
	customerDescription: string;
	internalInitialComment: string;
	receivingNotes: string;
	services: ServiceLine[];
	deviceEntryChecksJson: string;
} & OrderDiscountCommissionValues;

export const initialFormValues: FormValues = {
	customerId: "",
	document: "",
	title: "",
	status: "orcamento",
	sellerUserId: "",
	deviceModelId: "",
	brand: "",
	model: "",
	deviceType: "",
	imei: "",
	color: "",
	deviceLocation: "",
	isWarranty: false,
	estimatedReadyAt: "",
	passcodeType: "none",
	passcodeText: "",
	passcodePattern: "",
	paymentMethods: [],
	customerDescription: "",
	internalInitialComment: "",
	receivingNotes: "",
	services: [],
	deviceEntryChecksJson: "",
	...EMPTY_ORDER_DISCOUNT_COMMISSION,
};

export const orderFormSchema = Yup.object().shape({
	customerId: Yup.string().required("Selecione um cliente (CPF/CNPJ)"),
	title: Yup.string()
		.trim()
		.required("Título é obrigatório")
		.min(2, "Título deve ter pelo menos 2 caracteres"),
	status: Yup.string()
		.oneOf(["orcamento", "aguardando_aprovacao", "aprovado"], "Status inválido")
		.required("Status é obrigatório"),
	estimatedReadyAt: Yup.string().test(
		"min-date",
		"A previsão deve ser igual ou posterior à data de abertura.",
		(value) => !value || new Date(value).getTime() >= Date.now() - 60_000,
	),
});

export const novaOrdemStatusOptions = [
	{ value: "orcamento", label: "Orçamento" },
	{ value: "aguardando_aprovacao", label: "Aguardando aprovação" },
	{ value: "aprovado", label: "Aprovado" },
] as const;
