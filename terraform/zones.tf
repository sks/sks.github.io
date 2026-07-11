data "cloudflare_zone" "productionnotes" {
  name = var.primary_domain
}

data "cloudflare_zone" "agentbringup" {
  name = "agentbringup.dev"
}

data "cloudflare_zone" "sabithks" {
  name = "sabithks.dev"
}
