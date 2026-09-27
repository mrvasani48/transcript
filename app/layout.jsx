import "./globals.css";

export const metadata = {
  title: "Transcript — pull text from any YouTube video",
  description: "Paste a YouTube link, get the spoken text back, timestamped.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-bg text-ink font-serif antialiased">{children}</body>
    </html>
  );
}