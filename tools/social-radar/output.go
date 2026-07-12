package main

import (
	"fmt"
	"os"
	"sort"
	"strings"
	"text/tabwriter"
	"time"
)

func printCandidates(candidates []ThreadCandidate, since time.Time) {
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].Engagement == candidates[j].Engagement {
			return candidates[i].CreatedAt.After(candidates[j].CreatedAt)
		}
		return candidates[i].Engagement > candidates[j].Engagement
	})

	writer := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintf(writer, "PLATFORM\tAGE\tSCORE\tCOMMENTS\tSOURCE\tTITLE\tURL\n")

	for _, item := range candidates {
		age := time.Since(item.CreatedAt).Truncate(time.Hour)
		fmt.Fprintf(
			writer,
			"%s\t%s\t%d\t%d\t%s\t%s\t%s\n",
			item.Platform,
			age.String(),
			item.Score,
			item.Comments,
			item.Source,
			truncate(item.Title, 72),
			item.URL,
		)
	}

	_ = writer.Flush()
	fmt.Printf("\n%d thread(s) since %s (sorted by engagement)\n", len(candidates), since.Format(time.RFC3339))
}

func printLinkedInGuidance() {
	fmt.Println(strings.TrimSpace(`
LinkedIn: no public API can search the feed for engaging posts.
Use manual saved searches in the LinkedIn app, or set Google Alerts for:
  site:linkedin.com/posts "AI agents" OR "platform engineering" OR "SRE"
`))
}

func truncate(value string, max int) string {
	value = strings.ReplaceAll(value, "\t", " ")
	value = strings.ReplaceAll(value, "\n", " ")
	if len(value) <= max {
		return value
	}
	return value[:max-3] + "..."
}
