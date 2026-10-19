package policy

import rego.v1

test_hitl_rm_rf if {
	approval_required with input as {
		"tool": {
			"name": "shell_execute_command",
			"arguments": {"command": "rm -rf /tmp/scratch"},
		},
	}
}

test_no_hitl_ls if {
	not approval_required with input as {
		"tool": {
			"name": "shell_execute_command",
			"arguments": {"command": "ls -la"},
		},
	}
}

test_hitl_terraform_destroy if {
	approval_required with input as {
		"tool": {
			"name": "shell_execute_command",
			"arguments": {"command": "terraform destroy -auto-approve"},
		},
	}
}
