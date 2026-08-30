# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Phase 1: Foundation — Design System & UI Primitives

## Current Goal

- Build project management UI and canvas workspace.

## Completed

- **01-design-system**: shadcn/ui (Base UI + Nova preset, Tailwind v4), lucide-react, dark theme CSS variables in globals.css, 14 UI primitive components in components/ui/.
- **02-editor**: Editor chrome shell — `EditorNavbar` (fixed top bar, sidebar toggle with open/close icon swap) and `ProjectSidebar` (floating overlay, slides from left, My Projects / Shared tabs with empty states, New Project button). Dialog pattern already complete via `components/ui/dialog.tsx` (title, description, footer). Wired in `app/editor/page.tsx`.
- **03-auth**: Clerk auth wired into Next.js app. `proxy.ts` at project root protects all routes except `/sign-in` and `/sign-up`. `ClerkProvider` with `dark` theme from `@clerk/ui/themes` wraps the root layout. Two-panel sign-in and sign-up pages (`app/sign-in/[[...sign-in]]`, `app/sign-up/[[...sign-up]]`) — left panel (logo, tagline, feature list) hidden on small screens. Root `/` redirects authenticated users to `/editor`, unauthenticated to `/sign-in`. `UserButton` added to editor navbar right section. Requires `@clerk/ui` package installed.
- **04-project-dialogs**: Editor home screen (`app/editor/page.tsx`) — heading, description, New Project button. Three project dialogs (Create with live slug preview, Rename with auto-focus and Enter-to-submit, Delete with destructive confirm). `useProjectDialogs` hook (`hooks/use-project-dialogs.ts`) manages dialog/form/loading state. `ProjectSidebar` updated with project list from mock data, per-item DropdownMenu (Rename/Delete) shown only for owned projects, mobile backdrop scrim. All wired: home → Create, sidebar New Project → Create, sidebar Rename/Delete → respective dialogs. Mock data in `lib/mock-projects.ts`.

## In Progress

- None.

## Next Up

- Canvas workspace layout

## Open Questions

- `@clerk/ui` must be installed (`npm install @clerk/ui`) — blocked on user permission to add the package.

## Architecture Decisions

- shadcn/ui v4.19.0 uses Base UI (not Radix UI) as the component primitive. Nova preset with Lucide + Geist matches the project stack.
- Dark-only: all CSS vars defined once in `:root`, no `.dark` override block.
- shadcn tokens (`--background`, `--primary`, etc.) mapped directly to project design tokens (no oklch — hex values to match the exact palette from ui-context.md).
- Next.js 16 renames `middleware.ts` → `proxy.ts` and the export from `middleware` → `proxy`. Clerk's `clerkMiddleware` is assigned to the `proxy` named export.
- Clerk appearance overrides use CSS variable references (not hardcoded hex), so the design tokens stay as the single source of truth.

## Session Notes

- Next.js 16.3.3, React 19, Tailwind v4. Components live in components/ui/. TooltipProvider wraps children in app/layout.tsx.
- Editor moved from `app/page.tsx` to `app/editor/page.tsx`.
