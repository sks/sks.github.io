variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type = string
}

variable "github_pages_username" {
  type    = string
  default = "sks.github.io"
}

variable "primary_domain" {
  type    = string
  default = "productionnotes.dev"
}

variable "bring_up_post_url" {
  type    = string
  default = "https://productionnotes.dev/blog/bring-up-agent-workflows-like-hardware/"
}

variable "homepage_url" {
  type    = string
  default = "https://productionnotes.dev/"
}
