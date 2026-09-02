import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ghost AI",
  description: "AI-powered diagram workspace",
};

const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorBackground: "#111114",
    colorInputBackground: "#18181c",
    colorInputText: "#f0f0f4",
    colorText: "#f0f0f4",
    colorTextSecondary: "#c0c0cc",
    colorPrimary: "#00c8d4",
    colorDanger: "#ff4d4f",
    colorSuccess: "#34d399",
    colorNeutral: "#f0f0f4",
    borderRadius: "0.75rem",
  },
  elements: {
    headerTitle: { color: "#f0f0f4" },
    headerSubtitle: { color: "#c0c0cc" },
    formFieldLabel: { color: "#c0c0cc" },
    formFieldInput: { color: "#f0f0f4", backgroundColor: "#18181c", borderColor: "#2a2a30" },
    socialButtonsBlockButtonText: { color: "#f0f0f4" },
    dividerText: { color: "#808090" },
    footerActionText: { color: "#c0c0cc" },
    footerActionLink: { color: "#00c8d4" },
    identityPreviewText: { color: "#f0f0f4" },
    identityPreviewEditButton: { color: "#00c8d4" },
    formResendCodeLink: { color: "#00c8d4" },
    alternativeMethodsBlockButton: { color: "#f0f0f4" },
    alternativeMethodsBlockButtonText: { color: "#f0f0f4" },
    userButtonPopoverCard: { backgroundColor: "#111114", borderColor: "#2a2a30" },
    userPreviewMainIdentifier: { color: "#f0f0f4" },
    userPreviewSecondaryIdentifier: { color: "#c0c0cc" },
    userButtonPopoverActionButton: { color: "#f0f0f4" },
    userButtonPopoverActionButtonText: { color: "#f0f0f4" },
    userButtonPopoverActionButtonIcon: { color: "#c0c0cc" },
    userButtonPopoverFooter: { display: "none" },
    badge: { color: "#f0f0f4" },
    formFieldHintText: { color: "#c0c0cc" },
    formFieldInfoText: { color: "#c0c0cc" },
    formFieldMessage: { color: "#c0c0cc" },
    formFieldErrorText: { color: "#ff4d4f" },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <TooltipProvider>{children}</TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
