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
- **05-prisma**: Prisma Next (v8) ORM wired. Contract schema at `src/prisma/contract.prisma` with `Project` (ownerId, name, description, status enum DRAFT/ARCHIVED, canvasJsonPath, timestamps, indexes on ownerId and createdAt) and `ProjectCollaborator` (projectId with cascade delete, email, createdAt, unique on projectId/email, indexes on email and projectId/createdAt). `lib/prisma.ts` exports cached singleton `prisma` (the `postgres<Contract>` db client). Migration run via `prisma db init` — 9 additive operations applied (2 tables, 1 unique constraint, 4 indexes, 1 foreign key). `npm run build` passes.

- **06-project-apis**: REST API routes for project management. `GET /api/projects` lists authenticated user's projects. `POST /api/projects` creates project (defaults name to "Untitled Project"). `PATCH /api/projects/[projectId]` renames (owner-only). `DELETE /api/projects/[projectId]` deletes (owner-only). All routes return 401 for unauthenticated requests; PATCH/DELETE return 403 for non-owners. Uses Prisma v8 ORM (`prisma.orm.public.Project`). `npm run build` passes.
- **07-wire-editor-home**: Editor home wired to real project API. `lib/projects.ts` exports `Project` type and `getOwnedProjects()` server helper. `hooks/use-project-actions.ts` manages dialog state + mutations: create (POST → navigate to `/editor/[id]`), rename (PATCH → refresh), delete (DELETE → redirect if active else refresh). `app/editor/page.tsx` converted to server component — fetches owned projects, passes to `EditorHome` client wrapper. `components/editor/editor-home.tsx` extracted as client component. `ProjectSidebar` accepts `ownedProjects`/`sharedProjects` arrays (real `Project[]`, not mock). `ProjectDialogs` updated to `UseProjectActionsReturn`, create dialog shows live room ID preview (slug + random suffix). `hooks/use-project-dialogs.ts` deleted.

- **08-editor-workspace-shell**: `/editor/[projectId]` converted to full server-side access-checked workspace. `lib/project-access.ts` exports `getCurrentUser()` (Clerk identity: userId + primary email) and `checkProjectAccess(projectId, ownerId, cu)` (owner or collaborator). `components/editor/access-denied.tsx` — centered lock icon, message, link to `/editor`. `components/editor/workspace-shell.tsx` — client shell managing sidebar + AI sidebar state; renders `EditorNavbar` (project name, share placeholder, AI toggle), `ProjectSidebar` (active room highlighted, click-to-navigate), central canvas placeholder, collapsible right AI sidebar placeholder. `EditorNavbar` extended with optional `projectName`, `onShare`, `aiSidebarOpen`, `onAiToggle` props. `ProjectSidebar` extended with optional `activeProjectId` (highlights active item) and per-item click navigation via `router.push`. Unauthenticated → redirect `/sign-in`. Missing/unauthorized project → `AccessDenied`. `npm run build` passes.

- **09-sharing**: Share dialog on workspace. `GET/POST /api/projects/[projectId]/collaborators` — list (owner or collaborator, enriched with Clerk display name + avatar via `clerkClient().users.getUserList`) and invite (owner only, 409 on duplicate). `DELETE /api/projects/[projectId]/collaborators/[collaboratorId]` — remove (owner only). `components/editor/share-dialog.tsx` — invite input + collaborator list with avatars/names, remove buttons (owner), read-only list (collaborator), copy link with "Copied!" feedback. `isOwner` computed in workspace page (`cu.userId === project.ownerId`) and passed through `WorkspaceShell`. `npm run build` passes.

## In Progress

- None.

## Fixes

- **create-project-stale-list**: `useProjectActions.handleCreate` now calls `router.refresh()` before `router.push(/editor/[id])`. Without it the client Router Cache kept the pre-create (empty) RSC payload for `/editor`, so a new project was missing from "My Projects" on back-navigation. `handleRename`/`handleDelete` already did this.
- **project-dialog-stuck-loading**: `useProjectActions` never reset `isLoading` to `false` on the mutation success paths (only the `catch` did). After the first successful create/rename/delete in a session, `isLoading` stayed `true`, so every subsequently opened dialog rendered with disabled buttons stuck on "Creating…/Saving…/Deleting…" and `handleDialogOpenChange` blocked closing (couldn't even Cancel). Fix: `close()` and each `open*` now call `setIsLoading(false)`; `catch` blocks also `console.error` instead of swallowing silently. The server-side DELETE/PATCH/POST routes were working correctly the whole time.

## Next Up

- Canvas implementation (Liveblocks + React Flow)

## Open Questions

- None.

## Architecture Decisions

- shadcn/ui v4.19.0 uses Base UI (not Radix UI) as the component primitive. Nova preset with Lucide + Geist matches the project stack.
- Dark-only: all CSS vars defined once in `:root`, no `.dark` override block.
- shadcn tokens (`--background`, `--primary`, etc.) mapped directly to project design tokens (no oklch — hex values to match the exact palette from ui-context.md).
- Next.js 16 renames `middleware.ts` → `proxy.ts` and the export from `middleware` → `proxy`. Clerk's `clerkMiddleware` is assigned to the `proxy` named export.
- Clerk appearance overrides use CSS variable references (not hardcoded hex), so the design tokens stay as the single source of truth.
- Prisma v8 (Platform CLI) installed — uses contract-based ORM (`@prisma/orm-postgres`) not classic `PrismaClient`. Contract at `src/prisma/contract.prisma`, client is `postgres<Contract>({contractJson, url})`. Migration via `prisma db init` (not `prisma migrate dev`). Query API: `prisma.orm.public.Project.all()`.

## Session Notes

- Next.js 16.3.3, React 19, Tailwind v4. Components live in components/ui/. TooltipProvider wraps children in app/layout.tsx.
- Editor moved from `app/page.tsx` to `app/editor/page.tsx`.
- Prisma v8 is a Platform CLI — no `migrate dev` or `generate` commands. Uses `prisma contract emit` + `prisma db init`.
