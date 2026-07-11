# DNS (OpenTofu)

Zones must already exist in Cloudflare. Apply locally only:

```bash
export TF_VAR_cloudflare_api_token="..."
export TF_VAR_cloudflare_account_id="..."
tofu init && tofu apply
```

Do not commit `terraform.tfvars`, `*.tfstate`, or API tokens.
