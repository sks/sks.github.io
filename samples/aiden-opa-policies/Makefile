.PHONY: opa-check opa-test opa-fmt help

OPA ?= opa

help:
	@echo "Targets: opa-check, opa-test, opa-fmt"

opa-check:
	@set -e; \
	for f in $$(find . -name '*.rego' ! -name '*_test.rego' | sort); do \
		echo "opa check $$f"; \
		$(OPA) check "$$f"; \
	done

opa-test:
	@set -e; \
	for d in 01-deny-secret-write 03-business-hours 04-freeze-and-hitl/freeze 04-freeze-and-hitl/hitl; do \
		echo "opa test $$d"; \
		$(OPA) test "$$d"; \
	done

opa-fmt:
	@find . -name '*.rego' -print0 | xargs -0 $(OPA) fmt -w
