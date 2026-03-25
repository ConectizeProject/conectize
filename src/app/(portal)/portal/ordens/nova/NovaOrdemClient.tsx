"use client";

import {
	CreateCustomerDialog,
	EditCustomerDialog,
	type CustomerHit,
} from "@/components/customers";
import {
	OrderPaymentMethodFields,
	OrderServicesCard,
	OrderServicesTotalProvider,
	OsAssistAiIconButton,
	type DeviceModel,
	type OrderPaymentMethodFieldsRef,
	type OrderServicesCardRef,
} from "@/components/orders";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { PortalPaymentMethodCatalogItem } from "@/lib/portal/payment-methods-server";
import { portalFetch } from "@/lib/portal/portal-fetch";
import { formatCpfCnpj } from "@/lib/utils/format-cpf-cnpj";
import { parseMoneyToCents } from "@/lib/utils/format-money";
import {
	parseOptionalUuid,
	SELECT_NONE_VALUE,
} from "@/lib/utils/optional-uuid";
import {
	getDefaultPrevisao,
	getMinPrevisaoNow,
} from "@/lib/utils/previsao-ordem";
import { Field, FieldArray, Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { OrderFormActionBar } from "../OrderFormActionBar";
import {
	NovaOrdemAparelhoCard,
	type NovaOrdemCustomerDevice,
} from "./NovaOrdemAparelhoCard";
import { NovaOrdemAssistenciaCard } from "./NovaOrdemAssistenciaCard";
import { NovaOrdemCustomerCard } from "./NovaOrdemCustomerCard";
import { NovaOrdemEntryChecksDialog } from "./NovaOrdemEntryChecksDialog";
import {
	type FormValues,
	initialFormValues,
	orderFormSchema,
} from "./nova-ordem-form";
import {
	getCustomerDocumentDigits,
	useNovaOrdemCustomerSearch,
} from "./use-nova-ordem-customer-search";

type SellerOption = {
	id: string;
	full_name: string | null;
	email: string | null;
};

type Props = {
	action: (formData: FormData) => Promise<{ redirectTo: string } | void>;
	initialError?: string;
	sellerName: string;
	isAdmin: boolean;
	sellerOptions: SellerOption[];
	deviceModels?: DeviceModel[];
	paymentMethodsCatalog: PortalPaymentMethodCatalogItem[];
	currentUserId: string;
	duplicateOrderId?: string;
};

export function NovaOrdemClient(props: Props) {
	const router = useRouter();

	const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(
		null,
	);

	const {
		customerSearchInput,
		setCustomerSearchInput,
		documentDigits,
		isDocumentMode,
		isNameMode,
		customersBase,
		setCustomersBase,
		isSearchingDocument,
		documentSearchError,
		hasFetched,
		customersFiltered,
		isCpfPopoverOpen,
		setIsCpfPopoverOpen,
		setLastPrefixFetched,
	} = useNovaOrdemCustomerSearch({ selectedCustomer });

	const [duplicateFormValues, setDuplicateFormValues] =
		useState<FormValues | null>(null);
	const [duplicateLoaded, setDuplicateLoaded] = useState(false);

	const servicesCardRef = useRef<OrderServicesCardRef>(null);
	const paymentMethodsFieldsRef = useRef<OrderPaymentMethodFieldsRef>(null);
	const initialErrorToastShownRef = useRef(false);

	const [customerDevices, setCustomerDevices] = useState<
		NovaOrdemCustomerDevice[]
	>([]);
	const [isLoadingCustomerDevices, setIsLoadingCustomerDevices] =
		useState(false);
	const [isDevicesDialogOpen, setIsDevicesDialogOpen] = useState(false);

	const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);
	const [
		createCustomerInitialDocumentDigits,
		setCreateCustomerInitialDocumentDigits,
	] = useState("");
	const [customerToEdit, setCustomerToEdit] = useState<CustomerHit | null>(
		null,
	);

	const [isEntryChecksDialogOpen, setIsEntryChecksDialogOpen] = useState(false);

	const defaultPrevisao = useMemo(() => getDefaultPrevisao(), []);
	const minPrevisao = useMemo(() => getMinPrevisaoNow(), []);
	const initialFormValuesWithPrevisao = useMemo(
		() => ({
			...initialFormValues,
			estimatedReadyAt: defaultPrevisao,
			sellerUserId: props.isAdmin ? props.currentUserId : "",
		}),
		[defaultPrevisao, props.isAdmin, props.currentUserId],
	);

	useEffect(() => {
		if (!props.initialError) {
			initialErrorToastShownRef.current = false;
			return;
		}
		if (initialErrorToastShownRef.current) return;
		initialErrorToastShownRef.current = true;
		toast({
			variant: "destructive",
			title: "Não foi possível continuar",
			description: props.initialError,
		});
		const dup = props.duplicateOrderId;
		const qs = dup ? `?duplicate=${encodeURIComponent(dup)}` : "";
		router.replace(`/portal/ordens/nova${qs}`);
	}, [props.initialError, props.duplicateOrderId, router]);

	useEffect(() => {
		if (!props.duplicateOrderId) {
			setDuplicateLoaded(true);
			return;
		}
		let cancelled = false;
		portalFetch(`/api/portal/ordens/${props.duplicateOrderId}/duplicate`)
			.then((res) => res.json())
			.then((data) => {
				if (cancelled || !data?.ok || !data?.order) return;
				const o = data.order;
				setDuplicateFormValues({
					customerId: o.customerId ?? "",
					document: o.documentDigits ?? "",
					title: o.title ?? "",
					status: o.status ?? "orcamento",
					sellerUserId: props.isAdmin ? props.currentUserId : "",
					deviceModelId: o.deviceModelId ?? "",
					brand: o.brand ?? "",
					model: o.model ?? "",
					deviceType: o.deviceType ?? "",
					imei: o.imei ?? "",
					color: o.color ?? "",
					isWarranty: Boolean(o.isWarranty),
					estimatedReadyAt: o.estimatedReadyAt ?? "",
					passcodeType: o.passcodeType ?? "none",
					passcodeText: o.passcodeText ?? "",
					passcodePattern: o.passcodePattern ?? "",
					paymentMethods:
						Array.isArray(o.paymentMethods) && o.paymentMethods.length > 0
							? o.paymentMethods
							: o.paymentMethodId
								? [
										{
											payment_method_id: o.paymentMethodId,
											installments: o.installments ?? 1,
											value_cents: null,
										},
									]
								: [],
					customerDescription: o.customerDescription ?? "",
					internalInitialComment: o.internalInitialComment ?? "",
					receivingNotes: o.receivingNotes ?? "",
					services: o.services ?? [],
					deviceEntryChecksJson:
						typeof o.deviceEntryChecks === "string"
							? o.deviceEntryChecks
							: o.deviceEntryChecks
								? JSON.stringify(o.deviceEntryChecks)
								: "",
				});
				if (o.customer) {
					setSelectedCustomer(o.customer as CustomerHit);
					setCustomersBase((prev) => {
						const exists = prev.some(
							(c) => getCustomerDocumentDigits(c) === (o.documentDigits ?? ""),
						);
						if (exists) return prev;
						return [o.customer, ...prev].filter(Boolean) as CustomerHit[];
					});
				}
				if (o.documentDigits) {
					setCustomerSearchInput(formatCpfCnpj(o.documentDigits));
					setLastPrefixFetched(String(o.documentDigits).slice(0, 5));
				}
				setDuplicateLoaded(true);
			})
			.catch(() => {
				if (!cancelled) setDuplicateLoaded(true);
			});
		return () => {
			cancelled = true;
		};
	}, [props.duplicateOrderId]);

	useEffect(() => {
		if (!selectedCustomer?.id) {
			setCustomerDevices([]);
			setIsDevicesDialogOpen(false);
			return;
		}
		let cancelled = false;
		async function loadCustomerDevices() {
			setIsLoadingCustomerDevices(true);
			try {
				const res = await portalFetch(
					`/api/portal/customers/${selectedCustomer.id}/devices`,
				);
				const data = await res.json().catch(() => null);
				if (!cancelled && data?.ok && Array.isArray(data.devices)) {
					setCustomerDevices(data.devices as NovaOrdemCustomerDevice[]);
				}
				if (!cancelled && (!data?.ok || !Array.isArray(data.devices))) {
					setCustomerDevices([]);
				}
			} catch {
				if (!cancelled) setCustomerDevices([]);
			} finally {
				if (!cancelled) setIsLoadingCustomerDevices(false);
			}
		}
		loadCustomerDevices();
		return () => {
			cancelled = true;
		};
	}, [selectedCustomer]);

	function buildFormDataFromValues(
		values: FormValues,
		documentDigits: string,
	): FormData {
		const servicesNormalized = (values.services || [])
			.map((s) => {
				const kind = s.kind === "product" ? "product" : "service";
				const description = String(s.description || "").trim();
				const quantityRaw =
					kind === "product"
						? Number.parseInt(String(s.quantity || "1"), 10)
						: 1;
				const quantity =
					Number.isFinite(quantityRaw) && quantityRaw > 0
						? Math.min(9999, Math.max(1, quantityRaw))
						: 1;
				const unitValueCents = parseMoneyToCents(s.value);
				const unitCostCents = parseMoneyToCents(s.cost);
				const valueCents = unitValueCents * quantity;
				const costCents = unitCostCents * quantity;
				const sourceProductId = parseOptionalUuid(s.sourceProductId);
				return {
					kind,
					description,
					quantity,
					unitValueCents,
					unitCostCents,
					valueCents,
					costCents,
					...(sourceProductId ? { sourceProductId } : {}),
				};
			})
			.filter((s) => s.description || s.valueCents > 0 || s.costCents > 0);

		const totalValueCents = servicesNormalized.reduce(
			(acc, s) => acc + s.valueCents,
			0,
		);
		const totalCostCents = servicesNormalized.reduce(
			(acc, s) => acc + s.costCents,
			0,
		);
		const servicesJson = JSON.stringify({
			items: servicesNormalized,
			totals: { totalValueCents, totalCostCents },
		});

		const fd = new FormData();
		fd.append("customerId", values.customerId);
		fd.append("document", documentDigits);
		fd.append("deviceModelId", values.deviceModelId);
		fd.append("brand", values.brand);
		fd.append("deviceType", values.deviceType);
		fd.append("model", values.model);
		fd.append("isWarranty", values.isWarranty ? "1" : "");
		fd.append("passcodeType", values.passcodeType);
		fd.append("passcodeText", values.passcodeText);
		fd.append("passcodePattern", values.passcodePattern);
		fd.append(
			"paymentMethodsJson",
			JSON.stringify(
				(values.paymentMethods || []).filter((e) => {
					const id = String(e.payment_method_id || "").trim();
					return Boolean(id) && id !== SELECT_NONE_VALUE;
				}),
			),
		);
		fd.append("title", values.title);
		fd.append("status", values.status);
		fd.append("imei", values.imei);
		fd.append("color", values.color);
		fd.append("estimatedReadyAt", values.estimatedReadyAt);
		fd.append("customerDescription", values.customerDescription);
		fd.append("internalInitialComment", values.internalInitialComment);
		fd.append("receivingNotes", values.receivingNotes);
		fd.append("servicesJson", servicesJson);
		fd.append("deviceEntryChecksJson", values.deviceEntryChecksJson || "");
		fd.append(
			"seller_user_id",
			props.isAdmin
				? values.sellerUserId || props.currentUserId
				: props.currentUserId,
		);
		return fd;
	}

	if (props.duplicateOrderId && !duplicateLoaded) {
		return (
			<div className="max-w-4xl space-y-6">
				<div>
					<h1 className="text-2xl font-bold">Nova ordem de serviço</h1>
					<p className="text-sm text-muted-foreground">
						Carregando dados da ordem para duplicar…
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-4xl space-y-6 pb-24">
			<div>
				<h1 className="text-2xl font-bold">Nova ordem de serviço</h1>
				{duplicateFormValues ? (
					<p className="text-sm text-muted-foreground">
						Revise os dados e salve para criar a cópia.
					</p>
				) : null}
			</div>

			<Formik
				initialValues={duplicateFormValues ?? initialFormValuesWithPrevisao}
				validationSchema={orderFormSchema}
				enableReinitialize={!!duplicateFormValues}
				onSubmit={async (values) => {
					const fd = buildFormDataFromValues(values, documentDigits);
					const result = await props.action(fd);
					if (result && "redirectTo" in result && result.redirectTo)
						router.push(result.redirectTo);
				}}
			>
				{(formik) => (
					<>
						<Form className="relative space-y-6">
							<OrderServicesTotalProvider initialTotal={0}>
								<NovaOrdemCustomerCard
									selectedCustomer={selectedCustomer}
									searchInput={customerSearchInput}
									documentDigits={documentDigits}
									onSearchInputChange={setCustomerSearchInput}
									isCpfPopoverOpen={isCpfPopoverOpen}
									onCpfPopoverOpenChange={setIsCpfPopoverOpen}
									customersFiltered={customersFiltered}
									isSearchingDocument={isSearchingDocument}
									documentSearchError={documentSearchError}
									hasFetched={hasFetched}
									isDocumentMode={isDocumentMode}
									isNameMode={isNameMode}
									onSelectCustomer={(c) => {
										setSelectedCustomer(c);
										setIsCpfPopoverOpen(false);
										formik.setFieldValue("customerId", c.id);
										formik.setFieldValue(
											"document",
											getCustomerDocumentDigits(c),
										);
									}}
									onClearCustomer={() => {
										setSelectedCustomer(null);
										setIsCpfPopoverOpen(true);
										formik.setFieldValue("customerId", "");
										formik.setFieldValue("document", documentDigits);
									}}
									onEditCustomer={() => {
										setCustomerToEdit(selectedCustomer!);
										setIsCreateCustomerOpen(true);
									}}
									onCreateCustomer={() => {
										setCreateCustomerInitialDocumentDigits(documentDigits);
										setCustomerToEdit(null);
										setIsCpfPopoverOpen(false);
										setIsCreateCustomerOpen(true);
									}}
								/>

								<NovaOrdemAparelhoCard
									deviceModels={props.deviceModels}
									customerDevices={customerDevices}
									isLoadingCustomerDevices={isLoadingCustomerDevices}
									isDevicesDialogOpen={isDevicesDialogOpen}
									onDevicesDialogOpenChange={setIsDevicesDialogOpen}
								/>

								<NovaOrdemAssistenciaCard
									isAdmin={props.isAdmin}
									sellerName={props.sellerName}
									currentUserId={props.currentUserId}
									sellerOptions={props.sellerOptions}
									minPrevisao={minPrevisao}
									onOpenEntryChecksDialog={() =>
										setIsEntryChecksDialogOpen(true)
									}
								/>

								<FieldArray name="services">
									{({ push, remove }) => (
										<OrderServicesCard
											ref={servicesCardRef}
											formik={{
												services: formik.values.services ?? [],
												onAdd: (item) => push(item),
												onRemove: remove,
												onUpdate: (idx, field, value) =>
													formik.setFieldValue(
														`services.${idx}.${field}`,
														value,
													),
												onBlurSync: (services) =>
													formik.setFieldValue("services", services),
											}}
										/>
									)}
								</FieldArray>

								<Card>
									<CardHeader>
										<CardTitle>Formas de pagamento</CardTitle>
										<CardDescription>
											Defina como o cliente pagará a OS.
										</CardDescription>
									</CardHeader>
									<CardContent className="relative space-y-3">
										<OrderPaymentMethodFields
											ref={paymentMethodsFieldsRef}
											initialCatalog={props.paymentMethodsCatalog}
											formik={{
												values: {
													paymentMethods: formik.values.paymentMethods ?? [],
												},
												setFieldValue: formik.setFieldValue,
											}}
										/>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="w-full border-dashed border-green-600 bg-green-600/5 text-green-700 hover:bg-green-600/10 hover:text-green-800"
											onClick={() =>
												paymentMethodsFieldsRef.current?.addEntry()
											}
											aria-label="Incluir forma de pagamento"
										>
											<Plus className="h-4 w-4 mr-2" />
											Incluir forma de pagamento
										</Button>
									</CardContent>
								</Card>

								<Card>
									<CardHeader>
										<CardTitle>Descrição interna</CardTitle>
										<CardDescription>
											Primeira anotação interna (opcional). Depois de criar a
											OS, use o histórico na página da ordem para mais
											comentários.
										</CardDescription>
									</CardHeader>
									<CardContent className="relative space-y-6">
										<div className="space-y-2">
											<div className="flex items-center justify-between gap-2">
												<Label htmlFor="internalInitialComment">
													Texto inicial
												</Label>
												<OsAssistAiIconButton
													value={formik.values.internalInitialComment}
													onImproved={(text) =>
														formik.setFieldValue("internalInitialComment", text)
													}
													device={[
														formik.values.brand,
														formik.values.deviceType,
														formik.values.model,
													]
														.filter(Boolean)
														.join(" ")}
												/>
											</div>
											<Field
												as={Textarea}
												id="internalInitialComment"
												name="internalInitialComment"
												placeholder=""
												maxLength={6000}
											/>
										</div>

										{formik.status && typeof formik.status === "string" ? (
											<p className="text-sm text-destructive">
												{formik.status}
											</p>
										) : null}

										{formik.errors.customerId ? (
											<p className="text-sm text-destructive">
												{formik.errors.customerId}
											</p>
										) : null}
									</CardContent>
								</Card>

								<OrderFormActionBar>
									<Button
										variant="ghost"
										asChild
										className="font-medium text-muted-foreground hover:text-foreground"
									>
										<Link href="/portal/ordens">Voltar</Link>
									</Button>
									<Button
										type="submit"
										variant="success"
										disabled={formik.isSubmitting || !selectedCustomer}
										onClick={(e) => {
											e.preventDefault();
											servicesCardRef.current?.syncToFormik();
											setTimeout(() => formik.submitForm(), 0);
										}}
									>
										{formik.isSubmitting ? (
											<span className="inline-flex items-center gap-2">
												<Loader2 className="h-4 w-4 animate-spin" />
												Carregando
											</span>
										) : (
											"Criar ordem"
										)}
									</Button>
								</OrderFormActionBar>
							</OrderServicesTotalProvider>
						</Form>

					<NovaOrdemEntryChecksDialog
						open={isEntryChecksDialogOpen}
						onOpenChange={setIsEntryChecksDialogOpen}
					/>


						{customerToEdit ? (
							<EditCustomerDialog
								open={isCreateCustomerOpen}
								onOpenChange={setIsCreateCustomerOpen}
								customer={customerToEdit}
								onSaved={(customer) => {
									setSelectedCustomer(customer);
									setIsCpfPopoverOpen(false);
									formik.setFieldValue("customerId", customer.id);
									formik.setFieldValue(
										"document",
										getCustomerDocumentDigits(customer),
									);
								}}
							/>
						) : (
							<CreateCustomerDialog
								open={isCreateCustomerOpen}
								onOpenChange={setIsCreateCustomerOpen}
								initialDocumentDigits={createCustomerInitialDocumentDigits}
								mode="create"
								onCreated={(customer) => {
									setSelectedCustomer(customer);
									setIsCpfPopoverOpen(false);
									formik.setFieldValue("customerId", customer.id);
									formik.setFieldValue(
										"document",
										getCustomerDocumentDigits(customer),
									);
								}}
							/>
						)}
					</>
				)}
			</Formik>
		</div>
	);
}
