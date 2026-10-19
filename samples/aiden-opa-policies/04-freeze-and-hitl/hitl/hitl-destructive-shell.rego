package policy

import rego.v1

# Intervention policy: pause for human approval; do not hard-deny.
# In Terraform set type = "intervention".
default approval_required := false

approval_required if {
	endswith(input.tool.name, "_execute_command")
	cmd := lower(input.tool.arguments.command)
	destructive_pattern(cmd)
}

destructive_pattern(cmd) if contains(cmd, "rm -rf")

destructive_pattern(cmd) if contains(cmd, "terraform destroy")

destructive_pattern(cmd) if contains(cmd, "kubectl delete")

destructive_pattern(cmd) if contains(cmd, "drop table")

approval_reason := "Destructive shell requires human approval" if {
	approval_required
}
