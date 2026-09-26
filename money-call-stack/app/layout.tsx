import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Money Call Stack",
  description: "Recursive on-chain spending delegation for AI agents, via SPL Token approve/delegate.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
