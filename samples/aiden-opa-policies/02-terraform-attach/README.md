# Lab 02: manage AI agent policies as code with Terraform

Creates a minimal `sg_agent`, an `sg_policy` from Rego on disk, and `sg_agent_policy_attachment`.

Provider: [terraform-provider-stackgen](https://appcd-dev.github.io/terraform-provider-stackgen/) **v0.1.48**.

## Free account setup

1. [Create a free account](https://app.stackgen.com/) at https://app.stackgen.com/
2. Open [Personal access tokens](https://app.stackgen.com/app/settings/personal-access-tokens) and mint a token
3. Copy `terraform.tfvars.example` to `terraform.tfvars` and set:
   - `stackgen_url = "https://app.stackgen.com"` (or your tenant URL)
   - `stackgen_token` to that personal access token
   - `stackgen_workspace_id` from your workspace in the app

```bash
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars (never commit tokens)
tofu init
tofu plan
# tofu apply   # only when you intend to mutate the tenant
```

`terraform.tfvars` is gitignored when present locally; only `terraform.tfvars.example` is committed.
