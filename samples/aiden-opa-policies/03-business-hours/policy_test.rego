package policy

import rego.v1

_tool := {"name": "any_integration_any_tool", "arguments": {}}

test_allow_mid_morning if {
	allow with input as {
		"tool": _tool,
		"timestamp": "2026-07-16T10:30:00Z",
	}
}

test_deny_during_lunch if {
	not allow with input as {
		"tool": _tool,
		"timestamp": "2026-07-16T13:15:00Z",
	}
}

test_allow_after_lunch if {
	allow with input as {
		"tool": _tool,
		"timestamp": "2026-07-16T14:00:00Z",
	}
}

test_deny_evening if {
	not allow with input as {
		"tool": _tool,
		"timestamp": "2026-07-16T20:00:00Z",
	}
}
