// Vendored from vercel/ai @ dnukumamras/policy-package-prompt-context
// (packages/policy-opa/src, PR vercel/ai#15732). When @ai-sdk/policy-opa is
// published to npm, replace this directory with the package and update imports.
export type { PolicyClient } from './policy-client';
export type { PolicyDecision } from './policy-decision';
export { opaPolicy, optionalOpaPolicy, type DefaultOpaInput } from './opa/opa-policy';
export { httpPolicyClient } from './opa/http-policy-client';
export { wasmPolicyClient } from './opa/wasm-policy-client';
export { normalizeOpaDecision } from './opa/normalize-opa-decision';
