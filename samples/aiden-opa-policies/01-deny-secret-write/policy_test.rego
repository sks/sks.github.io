package policy

import rego.v1

test_allow_safe_issue_list if {
	allow with input as {
		"tool": {
			"name": "github_execute_parallel",
			"arguments": {"commands": [{"command": "gh issue list --limit 5"}]},
		},
		"timestamp": "2026-07-16T10:30:00Z",
	}
}

test_deny_secret_set_parallel if {
	not allow with input as {
		"tool": {
			"name": "github_execute_parallel",
			"arguments": {"commands": [{"command": "gh secret set MY_TOKEN --body x"}]},
		},
		"timestamp": "2026-07-16T10:30:00Z",
	}
}

test_deny_secret_set_execute_command if {
	not allow with input as {
		"tool": {
			"name": "github_execute_command",
			"arguments": {"command": "GH SECRET SET other --body y"},
		},
		"timestamp": "2026-07-16T10:30:00Z",
	}
}
