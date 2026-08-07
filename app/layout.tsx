import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flow Canvas",
  description: "A visual flow design tool for AI workflows and approval chains",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var initial = "light";
                document.documentElement.dataset.theme = initial;
                function closestFromEvent(event, selector) {
                  var target = event.target;
                  if (!target) return null;
                  var element = target.nodeType === 1 ? target : target.parentElement;
                  return element && element.closest ? element.closest(selector) : null;
                }
                document.addEventListener("click", function (event) {
                  var target = closestFromEvent(event, 'button[aria-label="Toggle theme"]');
                  if (!target) return;
                  var next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
                  document.documentElement.dataset.theme = next;
                  if (window.localStorage) window.localStorage.setItem("workflow-canvas-theme", next);
                }, true);
              })();
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}
