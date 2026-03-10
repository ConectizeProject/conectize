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
import { portalFetch } from "@/lib/portal/portal-fetch";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

export type EntryPhotoItem = {
	id: string;
	url: string | null;
	created_at: string;
};

type OrderEntryPhotosProps = {
	orderId: string;
	initialPhotos?: EntryPhotoItem[];
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
	disabled = false,
}: OrderEntryPhotosProps) {
	const [photos, setPhotos] = useState<EntryPhotoItem[]>(initialPhotos);
	const [modalOpen, setModalOpen] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const searchParams = useSearchParams();

	const fetchPhotos = useCallback(async () => {
		const res = await portalFetch(
			`/api/portal/ordens/${orderId}/entry-photos`,
		);
		if (!res.ok) return;
		const data = await res.json();
		if (data?.ok && Array.isArray(data.photos)) {
			setPhotos(data.photos);
		}
	}, [orderId]);

	useEffect(() => {
		fetchPhotos();
	}, [fetchPhotos]);

	useEffect(() => {
		if (searchParams.get("addEntryPhotos") === "1") {
			setModalOpen(true);
		}
	}, [searchParams]);

	useEffect(() => {
		if (!modalOpen) return;
		const url = getAddPhotosUrl(orderId);
		if (!url) return;
		QRCode.toDataURL(url, { width: 200, margin: 1 })
			.then(setQrDataUrl)
			.catch(() => setQrDataUrl(null));
	}, [modalOpen, orderId]);

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

			setUploading(true);
			try {
				const formData = new FormData();
				imageFiles.forEach((f) => formData.append("files", f));

				const res = await portalFetch(
					`/api/portal/ordens/${orderId}/entry-photos`,
					{
						method: "POST",
						body: formData,
					},
				);

				if (res.ok) {
					await fetchPhotos();
				}
			} finally {
				setUploading(false);
			}
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
				if (res.ok) await fetchPhotos();
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
					{photos.length > 0 && (
						<span className="text-sm text-muted-foreground">
							{photos.length}{" "}
							{photos.length === 1 ? "foto" : "fotos"}
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
							{photos.map((photo) => (
								<li
									key={photo.id}
									className="relative aspect-square rounded-lg border bg-muted overflow-hidden group"
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
									<Button
										type="button"
										variant="destructive"
										size="icon"
										className="absolute top-1 right-1 h-7 w-7 opacity-90 group-hover:opacity-100"
										onClick={() => handleDelete(photo.id)}
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
							<li className="aspect-square">{addBlock}</li>
						</ul>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
