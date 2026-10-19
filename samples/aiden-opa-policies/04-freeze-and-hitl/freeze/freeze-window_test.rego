package policy

import rego.v1

# Wednesday mid-day UTC
_wed_noon := "2026-07-15T12:00:00Z"

# Saturday mid-day UTC
_sat_noon := "2026-07-18T12:00:00Z"

test_deny_deploy_weekday if {
	not allow with input as {
		"timestamp": _wed_noon,
		"tool": {"name": "ops_tool", "arguments": {"action": "deploy"}},
	}
}

test_allow_deploy_weekend if {
	allow with input as {
		"timestamp": _sat_noon,
		"tool": {"name": "ops_tool", "arguments": {"action": "deploy"}},
	}
}

test_deny_kubectl_apply_weekday if {
	not allow with input as {
		"timestamp": _wed_noon,
		"tool": {
			"name": "shell_execute_command",
			"arguments": {"command": "kubectl apply -f deploy.yaml"},
		},
	}
}

test_allow_read_weekday if {
	allow with input as {
		"timestamp": _wed_noon,
		"tool": {"name": "ops_tool", "arguments": {"action": "status"}},
	}
}
