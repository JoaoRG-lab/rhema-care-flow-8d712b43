import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

const ALLOWED_EMAIL = "joaooz123@gmail.com";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Returns the identity of the signed-in Rhema Care Flow user calling the MCP server.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const email = ctx.getUserEmail();
    if (email?.toLowerCase() !== ALLOWED_EMAIL) {
      return {
        content: [{ type: "text", text: `Access denied for ${email ?? "unknown user"}.` }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ userId: ctx.getUserId(), email }, null, 2),
        },
      ],
    };
  },
});
