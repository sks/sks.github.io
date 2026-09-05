.PHONY: talk-conf42 talk-conf42-html talk-conf42-pdf

TALK_DECK := talks/conf42-observability-2026/deck.md
TALK_DIR := talks/conf42-observability-2026
TALK_EXPORT := $(TALK_DIR)/exports

talk-conf42: talk-conf42-pdf talk-conf42-html

talk-conf42-pdf:
	mkdir -p $(TALK_EXPORT)
	npx --yes @marp-team/marp-cli@4.1.0 $(TALK_DECK) \
		--theme-set $(TALK_DIR)/theme.css \
		--allow-local-files \
		-o $(TALK_EXPORT)/deck.pdf

talk-conf42-html:
	mkdir -p $(TALK_EXPORT)
	npx --yes @marp-team/marp-cli@4.1.0 $(TALK_DECK) \
		--theme-set $(TALK_DIR)/theme.css \
		--allow-local-files \
		--html \
		-o $(TALK_EXPORT)/deck.html
