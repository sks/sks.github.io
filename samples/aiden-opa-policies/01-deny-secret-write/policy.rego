package policy

import rego.v1

# Allow by default; hard-deny secret writes. Flip to default allow := false for
# stricter catalogs that only permit what you list.
default allow := true

allow := false if {
	endswith(input.tool.name, "_execute_parallel")
	some c in input.tool.arguments.commands
	contains(lower(c.command), "gh secret set")
}

allow := false if {
	endswith(input.tool.name, "_execute_command")
	contains(lower(input.tool.arguments.command), "gh secret set")
}

deny_reason := "gh secret set is denied by policy" if {
	not allow
}
