import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { RouteProviders } from "@/providers/route-providers";

export const metadata = {
	robots: {
		index: false,
		follow: false,
	},
};

export default function PortalAuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<RouteProviders>
			<div className="min-h-screen flex flex-col">
				<Header />
				{/*
          Header é fixed (z-50): o conteúdo precisa começar abaixo dele (~4rem).
        */}
				<div className="flex flex-1 flex-col pt-16">
					<main className="flex-1 px-4 pb-8 pt-6">{children}</main>
				</div>
				<Footer />
			</div>
		</RouteProviders>
	);
}
