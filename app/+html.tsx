import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Custom HTML shell for the web build. Adds PWA + iOS standalone tags so
// "Add to Home Screen" on iOS Safari behaves like a native app: full-screen,
// dark status bar, splash, icon. Native (iOS/Android) builds don't see this.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />

        <title>LifeOS</title>
        <meta
          name="description"
          content="AI-first life-management — goals, health, finance, career, social, polymath, all in one daily routine."
        />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0D0D0D" />

        {/* iOS Safari — Add to Home Screen */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LifeOS" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Favicon */}
        <link rel="icon" href="/apple-touch-icon.png" type="image/png" />

        <ScrollViewStyleReset />

        {/* Force dark background to avoid white flash on cold load */}
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root { background-color: #0D0D0D; height: 100%; }
          body { overscroll-behavior-y: none; }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
