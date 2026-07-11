output "productionnotes_nameservers" {
  value = data.cloudflare_zone.productionnotes.name_servers
}

output "agentbringup_nameservers" {
  value = data.cloudflare_zone.agentbringup.name_servers
}

output "sabithks_nameservers" {
  value = data.cloudflare_zone.sabithks.name_servers
}
