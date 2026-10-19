package policy

import rego.v1

default allow := true

change_actions := {"deploy", "apply", "release", "helm_upgrade", "rollout"}

factsheet_ts_ns := time.parse_rfc3339_ns(ts) if {
	ts := object.get(input, "timestamp", "")
	ts != ""
}

# Monday-Friday, 09:00-17:59 UTC
during_business_hours if {
	ns := factsheet_ts_ns
	time.weekday(ns) in {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}
	hour := time.clock(ns)[0]
	hour >= 9
	hour < 18
}

allow := false if {
	during_business_hours
	input.tool.arguments.action in change_actions
}

allow := false if {
	during_business_hours
	endswith(input.tool.name, "_execute_command")
	cmd := lower(input.tool.arguments.command)
	deploy_shell_pattern(cmd)
}

deploy_shell_pattern(cmd) if contains(cmd, "terraform apply")

deploy_shell_pattern(cmd) if contains(cmd, "kubectl apply")

deploy_shell_pattern(cmd) if contains(cmd, "helm upgrade")

deny_reason := "Change freeze: production-impacting changes are blocked Mon-Fri 09:00-17:59 UTC." if {
	not allow
}
