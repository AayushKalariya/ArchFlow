⨯ Error: Vercel Blob: Cannot use public access on a private store. The store is configured with private access.
    at async PUT (app\api\projects\[projectId]\canvas\route.ts:32:16)
  30 |
  31 |   const json = JSON.stringify(body)
> 32 |   const blob = await put(`canvas/${projectId}.json`, json, {
     |                ^
  33 |     access: "public",
  34 |     contentType: "application/json",
  35 |     allowOverwrite: true,
 PUT /api/projects/c8b54fcc-473b-4895-b6c8-dd4e00afa25e/canvas 500 in 500ms (next.js: 9ms, proxy.ts: 13ms, application-code: 478ms)

 Go through the problem above and fix the issue, do not mitigate it, fix the root cause, dont hide the problem. 