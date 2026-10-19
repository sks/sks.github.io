variable "stackgen_url" {
  type        = string
  description = "StackGen / Aiden URL. Free accounts use https://app.stackgen.com"
}

variable "stackgen_token" {
  type        = string
  sensitive   = true
  description = "Personal access token from https://app.stackgen.com/app/settings/personal-access-tokens. Never commit."
}

variable "stackgen_workspace_id" {
  type        = string
  description = "UI workspace ID for Guild APIs (provider workspace_id). Prefer this over deprecated org_id/project_id."
}

variable "agent_name" {
  type        = string
  default     = "lab-opa-policy-agent"
  description = "Agent name created by this lab for policy attachment"
}

variable "policy_name" {
  type        = string
  default     = "lab-deny-secret-write"
  description = "Stable policy name (agents attach by UUID, not name)"
}
