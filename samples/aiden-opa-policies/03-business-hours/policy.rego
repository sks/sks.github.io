package policy

import rego.v1

# Opt-in allow-list: tools only inside daily UTC windows.
# Outside those windows (including lunch) every tool call is hard-denied.
default allow := false

factsheet_ts_ns := time.parse_rfc3339_ns(ts) if {
	ts := object.get(input, "timestamp", "")
	ts != ""
}

hour := time.clock(ns)[0] if {
	ns := factsheet_ts_ns
}

# 09:00-11:59 UTC
in_morning_allow_window if {
	hour >= 9
	hour < 12
}

# 14:00-16:59 UTC (after 12:00-14:00 lunch)
in_afternoon_allow_window if {
	hour >= 14
	hour < 17
}

allow if {
	in_morning_allow_window
}

allow if {
	in_afternoon_allow_window
}

deny_reason := "Tool calls are allow-listed 09:00-17:00 UTC except 12:00-14:00 (lunch). Retry in 09:00-12:00 or 14:00-17:00 UTC." if {
	not allow
}
