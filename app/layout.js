import './globals.css';

export const metadata = {
  title: 'AI Coding Agent',
  description: 'AI Coding Agent interface',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
