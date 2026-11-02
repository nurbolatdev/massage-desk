// Types generated from apps/api/openapi.json with `npm run api:types`.
import type { components } from "./schema.js";

export type * from "./schema.js";

/** Body of every documented error response (`application/problem+json`). */
export type ApiProblem = components["schemas"]["ApiProblem"];

/** Machine-readable reason of an error response; branch on it, never on `detail`. */
export type ErrorCode = components["schemas"]["ErrorCode"];
