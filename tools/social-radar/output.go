package main

import (
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"text/tabwriter"
	"time"
)

func sortCandidates(candidates []ThreadCandidate) {
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].Engagement == candidates[j].Engagement {
			return candidates[i].CreatedAt.After(candidates[j].CreatedAt)
		}
		return candidates[i].Engagement > candidates[j].Engagement
	})
}

// WriteOutputs renders scan results to stdout and optional files.
func WriteOutputs(candidates []ThreadCandidate, since time.Time, cfg OutputConfig) error {
	sortCandidates(candidates)

	if cfg.Format == "table" || cfg.Format == "both" {
		if !cfg.Quiet {
			if err := writeTable(os.Stdout, candidates, since); err != nil {
				return err
			}
		}
	}

	if cfg.Format == "markdown" && !cfg.Quiet {
		if err := writeMarkdown(os.Stdout, candidates, since); err != nil {
			return err
		}
	}

	if cfg.TSVPath != "" {
		file, err := os.Create(cfg.TSVPath)
		if err != nil {
			return fmt.Errorf("create tsv output: %w", err)
		}
		if err := writeTable(file, candidates, since); err != nil {
			_ = file.Close()
			return err
		}
		if err := file.Close(); err != nil {
			return fmt.Errorf("close tsv output: %w", err)
		}
	}

	if cfg.MarkdownPath != "" {
		file, err := os.Create(cfg.MarkdownPath)
		if err != nil {
			return fmt.Errorf("create markdown output: %w", err)
		}
		if err := writeMarkdown(file, candidates, since); err != nil {
			_ = file.Close()
			return err
		}
		if err := file.Close(); err != nil {
			return fmt.Errorf("close markdown output: %w", err)
		}
	}

	if !cfg.Quiet {
		printLinkedInGuidance(os.Stdout)
	}

	return nil
}

func writeTable(writer io.Writer, candidates []ThreadCandidate, since time.Time) error {
	tab := tabwriter.NewWriter(writer, 0, 0, 2, ' ', 0)
	if _, err := fmt.Fprintf(tab, "PLATFORM\tAGE\tSCORE\tCOMMENTS\tSOURCE\tTITLE\tURL\n"); err != nil {
		return fmt.Errorf("write tsv header: %w", err)
	}

	for _, item := range candidates {
		age := time.Since(item.CreatedAt).Truncate(time.Hour)
		if _, err := fmt.Fprintf(
			tab,
			"%s\t%s\t%d\t%d\t%s\t%s\t%s\n",
			item.Platform,
			age.String(),
			item.Score,
			item.Comments,
			item.Source,
			truncate(item.Title, 72),
			item.URL,
		); err != nil {
			return fmt.Errorf("write tsv row: %w", err)
		}
	}

	if err := tab.Flush(); err != nil {
		return fmt.Errorf("flush tsv: %w", err)
	}

	if _, err := fmt.Fprintf(writer, "\n%d thread(s) since %s (sorted by engagement)\n", len(candidates), since.Format(time.RFC3339)); err != nil {
		return fmt.Errorf("write tsv footer: %w", err)
	}

	return nil
}

func writeMarkdown(writer io.Writer, candidates []ThreadCandidate, since time.Time) error {
	if _, err := fmt.Fprintf(writer, "# Social radar digest\n\n"); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(writer, "Window: last %s through now (%d threads)\n\n", time.Since(since).Truncate(24*time.Hour), len(candidates)); err != nil {
		return err
	}

	if len(candidates) == 0 {
		if _, err := fmt.Fprintf(writer, "_No threads matched filters._\n"); err != nil {
			return err
		}
		return nil
	}

	if _, err := fmt.Fprintf(writer, "| Platform | Age | Score | Comments | Source | Title |\n"); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(writer, "| --- | --- | ---: | ---: | --- | --- |\n"); err != nil {
		return err
	}

	for _, item := range candidates {
		age := time.Since(item.CreatedAt).Truncate(time.Hour)
		title := strings.ReplaceAll(item.Title, "|", "\\|")
		if _, err := fmt.Fprintf(
			writer,
			"| %s | %s | %d | %d | %s | [%s](%s) |\n",
			item.Platform,
			age,
			item.Score,
			item.Comments,
			item.Source,
			truncate(title, 96),
			item.URL,
		); err != nil {
			return err
		}
	}

	if _, err := fmt.Fprintf(writer, "\n## LinkedIn\n\nNo public API for feed search. Use saved searches or Google Alerts:\n\n`site:linkedin.com/posts \"AI agents\" OR \"platform engineering\" OR \"SRE\"`\n"); err != nil {
		return err
	}

	return nil
}

func printLinkedInGuidance(writer io.Writer) {
	_, _ = fmt.Fprintln(writer, strings.TrimSpace(`
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
