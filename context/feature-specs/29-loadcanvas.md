# 29 — Load the current canvas before AI edits

## Goal

Make follow-up prompts edit the current system design without rebuilding it. For example, after a user asks, “add one more database where acceptable in case it gets overloaded,” Ghost AI should retain every existing node, edge, label, and position, then add only the justified database and its necessary connections.

This spec describes implementation work. No behavior is implemented by this file.

## Current behavior and root cause

- `components/editor/ai-sidebar.tsx` sends `{ prompt, roomId, projectId }` to `POST /api/ai/design`; it does not send canvas content.
- `app/api/ai/design/route.ts` triggers `design-agent` with only `{ prompt, roomId }`. It checks that the fields are strings but does not verify project membership or bind `roomId` to the resolved project.
- `src/trigger/design-agent.ts` asks the model to design a system from the new prompt alone, always requests 5–12 nodes, and assigns no meaning to existing node IDs.
- The task calls `layoutNodes()` on the whole generated graph, then deletes every entry in the room's `flow.nodes` and `flow.edges` maps before inserting the new graph.
- `components/editor/canvas.tsx` can asynchronously restore a Vercel Blob snapshot through `importTemplate()`, which also clears both maps. That restore may race with AI edits after the room opens.

## Required behavior

1. Treat Liveblocks room storage as the current canvas while the editor is active. Vercel Blob is a saved snapshot, not the input for each AI edit.
2. If the canvas is empty, a prompt may generate a complete initial design, retaining the existing initial-generation behavior.
3. If the canvas has content, a prompt must produce a bounded edit plan against that canvas. Additive requests must not delete, replace, rename, or reposition existing elements.
4. An explicit request to change an existing component may update only the identified fields on that component. Deleting or replacing the entire diagram is outside this feature; provide a separate deliberate action for that later.
5. If the intended target or architecture choice is ambiguous, return a clarifying question or an explicit no-change response. Do not guess and rewrite the graph.
6. A failed read, invalid model response, failed validation, or conflict must leave the room unchanged and produce an understandable error in the existing AI chat/status flow.

## Implementation sequence

### 1. Secure and canonicalize the design request

Update `app/api/ai/design/route.ts` before changing the task behavior.

- Validate the request body with a narrow schema: nonempty prompt with a sensible length limit and a project identifier. Keep the current response shape `{ runId, publicToken }` for the sidebar.
- Resolve the project on the server, authenticate the user, and call `checkProjectAccess`, as the spec route and Liveblocks auth route already do. Return 401/404/403 before triggering any work.
- Use `project.id` as the canonical room ID; do not trust a separate client-provided `roomId` or `projectId` as proof of access. If the client still sends both during migration, reject a mismatch.
- Store that same canonical project ID in `TaskRun`. Trigger only after access validation succeeds.
- Keep the task's input small: prompt plus canonical room/project ID. Read canvas state in the task so it reflects the room when the queued run actually starts, not a stale browser snapshot.

### 2. Finish room hydration before allowing a prompt

Update `components/editor/canvas.tsx` and the state passed through `components/editor/workspace-shell.tsx` / `components/editor/ai-sidebar.tsx`.

- Expose a canvas-ready state after Liveblocks storage has loaded and the initial Blob restore check has finished. Disable design submission until ready, with a brief loading message in the existing sidebar. This matters when the room is empty but a saved snapshot exists.
- Change the Blob restore path so the response cannot blindly call the existing replace-style `importTemplate()`. At the moment of applying a restore, inspect the **current** room maps inside a Liveblocks mutation; import the snapshot only if both maps are still empty. If another tab, collaborator, or AI run has populated the room meanwhile, skip the restore.
- Keep a deliberate starter-template import as an explicit replace operation. Do not reuse that unconditional replacement helper for background hydration or incremental AI edits.
- If the snapshot fetch fails, surface a recoverable load error rather than silently treating a potentially saved project as an empty canvas and allowing an AI generation to replace it.

### 3. Read and normalize the current graph in the task

Update `src/trigger/design-agent.ts` to read the room's `flow.nodes` and `flow.edges` before calling Claude. Use the installed `@liveblocks/node` storage API and its JSON form, then validate/normalize the result to `CanvasNode[]` and `CanvasEdge[]`. The storage schema is defined in `liveblocks.config.ts` and `types/canvas.ts`.

- A missing room, missing `flow` structure, malformed node, or malformed edge is an error; do not silently assume an empty canvas.
- Preserve stable IDs, labels, edge labels, shapes, colors, dimensions, and positions in the model context. Send only fields useful for design reasoning; omit React Flow runtime-only fields and unrelated Liveblocks data.
- Determine mode from the validated graph: `create` when both maps are empty, `edit` when either map contains content. Treat an edges-only/corrupt graph as an error requiring repair rather than a blank canvas.
- Set a practical graph-size/token limit. If exceeded, fail with a clear message or introduce a separate context-selection strategy; never truncate the graph silently and then apply destructive edits.

### 4. Replace full-graph output with an edit-plan contract

Keep the current full-graph prompt and `layoutNodes()` only for `create` mode. Add a separate prompt and validated output schema for `edit` mode.

The edit response should describe operations, not a replacement canvas. One possible contract is:

```json
{
  "summary": "Add a read replica for the existing primary database",
  "addNodes": [{ "tempId": "new-db", "label": "Read Replica", "shape": "cylinder", "color": "#10233D" }],
  "addEdges": [
    { "source": "existing-primary-id", "target": "new-db", "label": "replication" },
    { "source": "existing-read-service-id", "target": "new-db", "label": "reads" }
  ],
  "updateNodes": [],
  "updateEdges": [],
  "clarifyingQuestion": null
}
```

- `tempId` identifies a new element only within this response. The server assigns permanent, collision-resistant IDs and resolves edge endpoints; the model must never choose final IDs for new elements.
- Only allow existing IDs that were in the supplied canvas. Restrict updates to an explicit allowlist of fields and preserve all unspecified fields. No delete or full-replace operation is permitted in edit mode.
- In the edit prompt, instruct the model to make the smallest change satisfying the request, preserve all existing elements and positions, and obey an explicit count such as “one more database.” Avoid the current blanket “generate 5 to 12 nodes” rule in edit mode.
- Extract an unambiguous requested count/type (such as one database) before generation and validate the returned plan against it. If the plan adds extra components, regenerate once or fail without applying it; do not silently accept a larger rewrite.
- For ambiguous requests, use `clarifyingQuestion` with empty operation arrays. For “overloaded database,” ask whether the bottleneck is reads, writes, or storage if the current graph does not supply enough context. A read replica is an example for read pressure, not a universal fix.
- Validate the model output at runtime with Zod (already installed). Check array limits, unique temp IDs, allowed shapes/colors, matching text colors, nonempty labels, valid endpoints, no dangling edges or self-links unless explicitly supported, and absence of unrelated operations. Treat malformed output as a failed run before touching storage. Do not rely on a TypeScript cast after `JSON.parse` as the current task does.

### 5. Validate against the latest room state and apply only the delta

Use one server-side `mutateStorage(roomId, ...)` call for the edit plan. Do not clear either map.

- Immediately before applying, check the current maps again. Referenced existing IDs must still exist. If a collaborator changed a targeted node/edge since the model read it, reject that update or regenerate a plan from fresh state; do not overwrite the collaborator's edit. Unrelated concurrent edits remain untouched.
- Retain a compact fingerprint of each referenced existing element from the model-input snapshot and compare it with that element in the mutation callback. This makes the targeted-change check concrete without rejecting unrelated room edits.
- Resolve temporary IDs to server-generated IDs, verify they are absent in the live maps, and create only the planned nodes/edges. Apply field-limited updates only where requested and still valid. Validate the entire plan before writing the first entry so ordinary validation failures cannot leave a half-applied plan.
- In `create` mode, recheck that both maps are still empty just before writing the initial graph. If someone populated the room while Claude was generating, stop and replan as an edit instead of clearing their work.
- Make task retries idempotent. Use stable IDs derived from the Trigger run plus each temp ID, or persist an equivalent applied-run marker, and skip already-applied operations on retry. This prevents duplicate databases if storage succeeds but a later status broadcast fails and the task retries.
- Produce a result summary based on operations actually applied. A no-op or clarification must not claim that the canvas was updated.
- If two AI runs can target the same room, serialize them per room or detect/replan conflicts. A browser-only `isRunning` flag is insufficient because another collaborator can submit simultaneously. Manual collaborator edits still require the recheck above.

### 6. Position additions without moving the current workflow

- Keep every existing node's `position`, `width`, and `height` unchanged in edit mode. Do not pass the combined graph to the current global `layoutNodes()` function.
- Size new nodes with the existing shape-size defaults. Place each new node near the existing node it connects to, using a deterministic offset and a bounding-box collision check against all current and newly planned nodes.
- If no attachment target is clear, place the new node at a free spot near the current graph bounds or ask for clarification. Do not move existing nodes to make space.
- Keep existing edge IDs and labels unchanged. Add only the edges needed for the requested relationship.

### 7. Keep the sidebar and status messages accurate

- Preserve the existing `/api/ai/design` call, Trigger realtime subscription, Liveblocks-driven canvas updates, and AI chat feed. The client must not manually merge graphs.
- Change task status text from “designing your architecture” to wording appropriate to `create` or `edit` after the task determines the mode.
- Return a concise user-facing summary of what was added/updated, or a clarifying question. Display that response in the current AI chat rather than a generic “updated your canvas” message. Confirm that the current `useRealtimeRun` options expose the task output needed for this; if output is skipped, use a small run-scoped response/status payload instead.
- Avoid automatically fitting the entire canvas after every edit if that makes a collaborator's view jump. Fit on initial generation; for edits, leave the viewport alone or offer a “Show new component” action.

### 8. Verify snapshot persistence and release behavior

- The canvas autosave in `hooks/use-canvas-autosave.ts` and `app/api/projects/[projectId]/canvas/route.ts` must save the merged graph after Liveblocks broadcasts the edit. Test with two open clients and a reload.
- Check for out-of-order or overlapping Blob `PUT`s. An older snapshot must not become the restored state after a newer edit. If this is reproducible, add a monotonic revision/compare-before-write mechanism or a single server-side snapshot writer before shipping. Do not make Blob the authority for live editing.
- Once code is implemented, run the repository's TypeScript/build checks, validate locally with two browser sessions, then deploy both the Vercel app and a new Trigger.dev production worker version. A Vercel deploy alone will not update `design-agent`.

## Acceptance checks

1. On an empty canvas, a prompt still creates a connected initial architecture.
2. On a populated canvas, “add one more database” adds exactly one database node plus justified edges. All pre-existing node/edge IDs, labels, styles, and positions compare equal before and after.
3. An explicitly targeted node update changes only its requested fields. An ambiguous request asks a question and changes nothing.
4. Invalid model JSON, an unknown node reference, a failed storage read, or a graph-size limit error changes nothing and appears as an error in chat/status.
5. If a collaborator adds or edits an unrelated element while the AI is running, that element remains. If the AI's target is removed or modified, the run rejects or replans instead of overwriting it.
6. Retrying the same Trigger run does not add duplicate nodes or edges. Two simultaneous AI requests for one room do not erase each other's changes.
7. A delayed Blob restore cannot wipe an AI edit; reload and two-client tests show the same final graph.
8. A signed-in nonmember cannot trigger edits against another project's room by submitting its ID.

## Scope limits

- No general diagram history, undo system, or user-facing full-redesign mode in this feature.
- No change to the generated Markdown spec workflow except that it should naturally read the updated canvas when invoked afterward.
- No new database table is required unless an applied-run marker or snapshot revision is chosen for idempotency/persistence safety.
- Do not modify generated shadcn components or replace the Liveblocks/React Flow canvas architecture.

## Reference APIs

- Liveblocks Node storage read and mutation: <https://liveblocks.io/docs/api-reference/liveblocks-node>
- Liveblocks JSON storage representation: <https://liveblocks.io/docs/api-reference/rest-api-endpoints>
- Trigger.dev per-entity queues and concurrency: <https://trigger.dev/product/concurrency-and-queues>
