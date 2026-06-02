export function getEdgeFunctionDeploymentHint(functionName: string, error: string | null | undefined) {
  if (!error) return null;
  if (!/nao encontrada|não encontrada|not found|404/i.test(error)) return null;

  return `A função existe em supabase/functions/${functionName}, mas ainda precisa estar ativa no Supabase canônico.`;
}

export function describeEdgeFunctionRuntimeError(functionName: string, error: string, fallback: string) {
  const message = error || fallback;
  const hint = getEdgeFunctionDeploymentHint(functionName, message);
  return hint ? `${message} ${hint}` : message;
}
