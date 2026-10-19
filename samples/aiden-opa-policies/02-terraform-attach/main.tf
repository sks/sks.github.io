# Teaching shape: create a Rego policy, a minimal agent, and attach the policy.
# Free account: https://app.stackgen.com/
# Token: https://app.stackgen.com/app/settings/personal-access-tokens
# Provider docs: https://appcd-dev.github.io/terraform-provider-stackgen/
# See variables.tf and terraform.tfvars.example.

terraform {
  required_version = ">= 1.5"
  required_providers {
    sg = {
      source  = "releases.stackgen.com/stackgen/stackgen"
      version = "0.1.48"
    }
  }
}

provider "sg" {
  stackgen_url   = var.stackgen_url
  stackgen_token = var.stackgen_token
  # Preferred workspace scope (org_id / project_id are deprecated aliases).
  workspace_id = var.stackgen_workspace_id
}

# Bare agent is enough as an attach target for this lab.
resource "sg_agent" "lab" {
  name        = var.agent_name
  description = "Teaching lab agent for OPA policy attach"
  persona     = "You are a lab agent used only to demonstrate policy attachment."
}

resource "sg_policy" "deny_secret_write" {
  name        = var.policy_name
  description = "Deny gh secret set (teaching lab)"
  # Use logic for allow/deny. Provider docs may still show tool_call; solutions use logic.
  type = "logic"

  rego_source = file("${path.module}/policies/deny-secret-write.rego")
}

resource "sg_agent_policy_attachment" "deny_secret_write" {
  agent_name = sg_agent.lab.name
  policy_id  = sg_policy.deny_secret_write.id
  enabled    = true
}

output "agent_name" {
  value = sg_agent.lab.name
}

output "policy_id" {
  value = sg_policy.deny_secret_write.id
}
