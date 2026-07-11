resource "cloudflare_record" "agentbringup_apex" {
  zone_id = data.cloudflare_zone.agentbringup.id
  name    = "@"
  type    = "A"
  content = local.redirect_placeholder_ipv4
  proxied = true
}

resource "cloudflare_record" "agentbringup_www" {
  zone_id = data.cloudflare_zone.agentbringup.id
  name    = "www"
  type    = "CNAME"
  content = "agentbringup.dev"
  proxied = true
}

resource "cloudflare_ruleset" "agentbringup_redirect" {
  zone_id = data.cloudflare_zone.agentbringup.id
  name    = "redirect-to-bring-up-post"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"

  rules {
    action     = "redirect"
    expression = "true"
    action_parameters {
      from_value {
        status_code = 301
        target_url {
          value = var.bring_up_post_url
        }
        preserve_query_string = false
      }
    }
  }
}

resource "cloudflare_record" "sabithks_apex" {
  zone_id = data.cloudflare_zone.sabithks.id
  name    = "@"
  type    = "A"
  content = local.redirect_placeholder_ipv4
  proxied = true
}

resource "cloudflare_record" "sabithks_www" {
  zone_id = data.cloudflare_zone.sabithks.id
  name    = "www"
  type    = "CNAME"
  content = "sabithks.dev"
  proxied = true
}

resource "cloudflare_ruleset" "sabithks_redirect" {
  zone_id = data.cloudflare_zone.sabithks.id
  name    = "redirect-to-homepage"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"

  rules {
    action     = "redirect"
    expression = "true"
    action_parameters {
      from_value {
        status_code = 301
        target_url {
          value = var.homepage_url
        }
        preserve_query_string = false
      }
    }
  }
}
