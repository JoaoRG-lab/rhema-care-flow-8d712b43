import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import healthTool from "./tools/health";
import listPatientsTool from "./tools/list-patients";


// The OAuth issuer MUST be the direct Supabase host derived from the project
// ref at build time. VITE_SUPABASE_PROJECT_ID is inlined by Vite as a literal,
// so this stays import-safe (no runtime env read at module load).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "rhema-care-flow-mcp",
  title: "Rhema Care Flow MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for the Rhema Care Flow clinical workspace. Access is restricted to the workspace owner (joaooz123@gmail.com); every tool re-checks the signed-in user and calls the database with the caller's JWT so Row Level Security applies.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, healthTool, listPatientsTool],
});
