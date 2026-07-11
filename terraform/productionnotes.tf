resource "cloudflare_record" "productionnotes_a" {
  for_each = toset(local.github_pages_a)

  zone_id = data.cloudflare_zone.productionnotes.id
  name    = "@"
  type    = "A"
  content = each.value
  proxied = false
}

resource "cloudflare_record" "productionnotes_aaaa" {
  for_each = toset(local.github_pages_aaaa)

  zone_id = data.cloudflare_zone.productionnotes.id
  name    = "@"
  type    = "AAAA"
  content = each.value
  proxied = false
}

resource "cloudflare_record" "productionnotes_www" {
  zone_id = data.cloudflare_zone.productionnotes.id
  name    = "www"
  type    = "CNAME"
  content = var.github_pages_username
  proxied = false
}
