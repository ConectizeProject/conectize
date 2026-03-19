"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { compressImageForEntry } from "@/lib/image/compress-image";
import { portalFetch } from "@/lib/portal/portal-fetch";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

type UploadQueueItem = {
	key: string;
	previewUrl: string;
	status: "uploading" | "success" | "error";
	id?: string;
};

export type EntryPhotoItem = {
	id: string;
	url: string | null;
	created_at: string;
};

type OrderEntryPhotosProps = {
	orderId: string;
	initialPhotos?: EntryPhotoItem[];
	/** Quantidade de fotos vinda do servidor (evita request extra no mount) */
	initialPhotoCount?: number | null;
	disabled?: boolean;
};

function getAddPhotosUrl(orderId: string): string {
	if (typeof window === "undefined") {
		return "";
	}
	const base = window.location.origin;
	return `${base}/portal/ordens/${orderId}?addEntryPhotos=1`;
}

export function OrderEntryPhotos({
	orderId,
	initialPhotos = [],
	initialPhotoCount,
	disabled = false,
}: OrderEntryPhotosProps) {
	const [photos, setPhotos] = useState<EntryPhotoItem[]>([]);
	const [photoCount, setPhotoCount] = useState<number | null>(
		initialPhotoCount !== undefined && initialPhotoCount !== null ? initialPhotoCount : null,
	);
	const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
	const [modalOpen, setModalOpen] = useState(false);
	const [lightboxOpen, setLightboxOpen] = useState(false);
	const [lightboxIndex, setLightboxIndex] = useState(0);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const searchParams = useSearchParams();
	const uploading = uploadQueue.some((u) => u.status === "uploading");

	const fetchCount = useCallback(async () => {
		const res = await portalFetch(
			`/api/portal/ordens/${orderId}/entry-photos?countOnly=1`,
		);
		if (!res.ok) return;
		const data = await res.json().catch(() => null);
		if (data?.ok && typeof data.count === "number") {
			setPhotoCount(data.count);
		}
	}, [orderId]);

	const fetchPhotos = useCallback(async () => {
		const res = await portalFetch(
			`/api/portal/ordens/${orderId}/entry-photos`,
		);
		if (!res.ok) return;
		const data = await res.json().catch(() => null);
		if (data?.ok && Array.isArray(data.photos)) {
			setPhotos(data.photos);
			setPhotoCount(data.photos.length);
		}
	}, [orderId]);

	useEffect(() => {
		if (initialPhotoCount === undefined || initialPhotoCount === null) fetchCount();
	}, [fetchCount, initialPhotoCount]);

	useEffect(() => {
		if (modalOpen) fetchPhotos();
	}, [modalOpen, fetchPhotos]);

	useEffect(() => {
		if (searchParams.get("addEntryPhotos") === "1") {
			setModalOpen(true);
		}
	}, [searchParams]);

	useEffect(() => {
		if (!modalOpen) setLightboxOpen(false);
	}, [modalOpen]);

	useEffect(() => {
		if (!modalOpen) return;
		const url = getAddPhotosUrl(orderId);
		if (!url) return;
		QRCode.toDataURL(url, { width: 200, margin: 1 })
			.then(setQrDataUrl)
			.catch(() => setQrDataUrl(null));
	}, [modalOpen, orderId]);

	const openLightbox = useCallback((index: number) => {
		setLightboxIndex(index);
		setLightboxOpen(true);
	}, []);

	const lightboxTotal = photos.length;
	const lightboxCanPrev = lightboxTotal > 1 && lightboxIndex > 0;
	const lightboxCanNext = lightboxTotal > 1 && lightboxIndex < lightboxTotal - 1;
	const lightboxGoPrev = useCallback(() => {
		if (lightboxCanPrev) setLightboxIndex((i) => i - 1);
	}, [lightboxCanPrev]);
	const lightboxGoNext = useCallback(() => {
		if (lightboxCanNext) setLightboxIndex((i) => i + 1);
	}, [lightboxCanNext]);

	useEffect(() => {
		if (!lightboxOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") lightboxGoPrev();
			else if (e.key === "ArrowRight") lightboxGoNext();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [lightboxOpen, lightboxGoPrev, lightboxGoNext]);

	const handleUploadFiles = useCallback(
		async (files: FileList | File[]) => {
			const list = Array.isArray(files) ? files : Array.from(files);
			const imageFiles = list.filter(
				(f) =>
					f.type.startsWith("image/") &&
					f.size > 0 &&
					f.size <= 10 * 1024 * 1024,
			);
			if (imageFiles.length === 0) return;

			const compressed: { key: string; previewUrl: string; blob: Blob; file: File }[] = [];
			for (let i = 0; i < imageFiles.length; i++) {
				const file = imageFiles[i];
				const blob = await compressImageForEntry(file);
				const key = `upload-${Date.now()}-${i}`;
				compressed.push({
					key,
					previewUrl: URL.createObjectURL(blob),
					blob,
					file,
				});
			}

			const newItems: UploadQueueItem[] = compressed.map((c) => ({
				key: c.key,
				previewUrl: c.previewUrl,
				status: "uploading" as const,
			}));
			setUploadQueue((prev) => [...prev, ...newItems]);

			const updateItem = (key: string, patch: Partial<UploadQueueItem>) => {
				setUploadQueue((prev) =>
					prev.map((u) => (u.key === key ? { ...u, ...patch } : u)),
				);
			};

			for (const { key, blob, file } of compressed) {
				const formData = new FormData();
				formData.append("files", blob, file.name || "image.jpg");

				try {
					const res = await portalFetch(
						`/api/portal/ordens/${orderId}/entry-photos`,
						{ method: "POST", body: formData },
					);
					const data = res.ok ? await res.json().catch(() => null) : null;
					const id = data?.photos?.[0]?.id;
					updateItem(key, {
						status: res.ok && id ? "success" : "error",
						id,
					});
				} catch {
					updateItem(key, { status: "error" });
				}
			}

			await fetchPhotos();
			const toRemove = newItems.map((n) => n.key);
			setUploadQueue((prev) => {
				prev.forEach((u) => {
					if (toRemove.includes(u.key)) URL.revokeObjectURL(u.previewUrl);
				});
				return prev.filter((u) => !toRemove.includes(u.key));
			});
			toast({
				variant: "success",
				title: "Fotos salvas",
				description: "As fotos foram adicionadas à OS e já estão salvas.",
			});
		},
		[orderId, fetchPhotos],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragOver(false);
			if (e.dataTransfer.files.length)
				handleUploadFiles(e.dataTransfer.files);
		},
		[handleUploadFiles],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		// só reseta se sair do próprio bloco (não ao entrar em um filho)
		const related = e.relatedTarget as Node | null;
		if (!related || !e.currentTarget.contains(related)) {
			setIsDragOver(false);
		}
	}, []);

	const handleDelete = useCallback(
		async (photoId: string) => {
			setDeletingId(photoId);
			try {
				const res = await portalFetch(
					`/api/portal/ordens/${orderId}/entry-photos/${photoId}`,
					{ method: "DELETE" },
				);
				if (res.ok) {
					await fetchPhotos();
					toast({
						variant: "success",
						title: "Foto excluída",
						description: "A foto foi removida da OS e a alteração já está salva.",
					});
				}
			} finally {
				setDeletingId(null);
			}
		},
		[orderId, fetchPhotos],
	);

	const addBlock = (
		<div
			role="button"
			tabIndex={0}
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onDragEnter={handleDragOver}
			onDragLeave={handleDragLeave}
			onClick={() => fileInputRef.current?.click()}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					fileInputRef.current?.click();
				}
			}}
			className={cn(
				"relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-center text-sm transition-colors",
				"cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring",
				isDragOver
					? "border-primary bg-primary/10 text-primary"
					: "border-muted-foreground/40 bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/50",
			)}
		>
			<input
				ref={fileInputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp,image/heic"
				multiple
				className="sr-only"
				onChange={(e) => {
					const files = e.target.files;
					if (files?.length) handleUploadFiles(files);
					e.target.value = "";
				}}
			/>
			{uploading ? (
				<Loader2 className="h-8 w-8 animate-spin" />
			) : (
				<ImagePlus className="h-8 w-8" />
			)}
			<span>
				{uploading ? "Enviando…" : isDragOver ? "Solte aqui" : "Adicionar fotos"}
			</span>
		</div>
	);

	return (
		<div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
			<div className="flex items-center justify-between gap-2">
				<Label>Fotos do aparelho no momento de entrada</Label>
				<div className="flex items-center gap-2">
					{photoCount !== null && (
						<span className="text-sm text-muted-foreground">
							{photoCount} {photoCount === 1 ? "foto" : "fotos"}
						</span>
					)}
					{photoCount === null && photos.length > 0 && (
						<span className="text-sm text-muted-foreground">
							{photos.length} {photos.length === 1 ? "foto" : "fotos"}
						</span>
					)}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setModalOpen(true)}
						disabled={disabled}
						aria-label="Adicionar fotos de entrada"
					>
						+
					</Button>
				</div>
			</div>

			<Dialog open={modalOpen} onOpenChange={setModalOpen}>
				<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Fotos de entrada do aparelho</DialogTitle>
						<DialogDescription>
							Adicione fotos do aparelho no momento do
							recebimento. No celular, escaneie o QR code para
							abrir esta tela e enviar fotos da câmera.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						{qrDataUrl && (
							<div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-4">
								<p className="text-sm font-medium">
									Abrir no celular para enviar fotos
								</p>
								<img
									src={qrDataUrl}
									alt="QR Code para abrir página de fotos no celular"
									className="h-[200px] w-[200px] rounded border bg-white object-contain"
								/>
							</div>
						)}

						<ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
							{photos.map((photo, index) => (
								<li
									key={photo.id}
									className="relative aspect-square rounded-lg border bg-muted overflow-hidden group"
								>
									<button
										type="button"
										className="absolute inset-0 w-full h-full focus:outline-none focus:ring-0"
										onClick={() => openLightbox(index)}
										aria-label="Ver foto em tamanho maior"
									>
										{photo.url ? (
											<Image
												src={photo.url}
												alt=""
												fill
												className="object-cover"
												sizes="(max-width: 640px) 50vw, 33vw"
												unoptimized
											/>
										) : (
											<div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
												<Loader2 className="h-6 w-6 animate-spin" />
											</div>
										)}
									</button>
									<Button
										type="button"
										variant="destructive"
										size="icon"
										className="absolute top-1 right-1 h-7 w-7 opacity-90 group-hover:opacity-100 z-10"
										onClick={(e) => {
											e.stopPropagation();
											handleDelete(photo.id);
										}}
										disabled={deletingId === photo.id}
										aria-label="Remover foto"
									>
										{deletingId === photo.id ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Trash2 className="h-4 w-4" />
										)}
									</Button>
								</li>
							))}
							{uploadQueue.map((item) => (
								<li
									key={item.key}
									className="relative aspect-square rounded-lg border bg-muted overflow-hidden"
								>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={item.previewUrl}
										alt=""
										className="absolute inset-0 size-full object-cover"
									/>
									<div
										className={cn(
											"absolute inset-0 flex items-center justify-center bg-black/50 transition-colors",
											item.status === "error" && "bg-red-900/50",
										)}
									>
										{item.status === "uploading" && (
											<Loader2 className="h-10 w-10 text-white animate-spin" aria-hidden />
										)}
										{item.status === "success" && (
											<div className="rounded-full bg-emerald-500 p-2">
												<Check className="h-8 w-8 text-white" aria-hidden />
											</div>
										)}
										{item.status === "error" && (
											<div className="rounded-full bg-destructive p-2">
												<X className="h-8 w-8 text-destructive-foreground" aria-hidden />
											</div>
										)}
									</div>
								</li>
							))}
							<li className="aspect-square">{addBlock}</li>
						</ul>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
				<DialogContent
					className="max-w-[95vw] w-full max-h-[95vh] p-2 sm:p-6 flex flex-col items-center justify-center gap-2"
					aria-describedby={undefined}
				>
					<DialogTitle className="sr-only">
						Foto do aparelho {lightboxTotal > 1 ? `— ${lightboxIndex + 1} de ${lightboxTotal}` : ""}
					</DialogTitle>
					<div className="relative flex items-center justify-center gap-2 w-full flex-1 min-h-0">
						{lightboxTotal > 1 && (
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="shrink-0 h-10 w-10 rounded-full"
								onClick={lightboxGoPrev}
								disabled={!lightboxCanPrev}
								aria-label="Foto anterior"
							>
								<ChevronLeft className="h-6 w-6" />
							</Button>
						)}
						<div className="relative w-full h-[70vh] min-h-[200px] max-w-4xl mx-auto flex items-center justify-center">
							{photos[lightboxIndex]?.url ? (
								<Image
									src={photos[lightboxIndex].url!}
									alt=""
									fill
									className="object-contain"
									sizes="95vw"
									unoptimized
								/>
							) : (
								<div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
									<Loader2 className="h-8 w-8 animate-spin" />
								</div>
							)}
						</div>
						{lightboxTotal > 1 && (
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="shrink-0 h-10 w-10 rounded-full"
								onClick={lightboxGoNext}
								disabled={!lightboxCanNext}
								aria-label="Próxima foto"
							>
								<ChevronRight className="h-6 w-6" />
							</Button>
						)}
					</div>
					{lightboxTotal > 1 && (
						<p className="text-sm text-muted-foreground">
							{lightboxIndex + 1} / {lightboxTotal}
						</p>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
