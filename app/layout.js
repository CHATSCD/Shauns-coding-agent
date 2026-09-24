import './globals.css';

export const metadata = {
  title: 'OneJob Site Factory',
  description: 'Paste trade leads, get deployed tap-to-call one-pagers.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
