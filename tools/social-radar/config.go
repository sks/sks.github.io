package main

import (
	"flag"
	"fmt"
	"os"
	"strings"
	"time"
)

// ScanConfig holds CLI flags and derived scan windows.
type ScanConfig struct {
	Days        int
	MinScore    int
	MinComments int
	Queries     []string
	Subreddits  []string
	Since       time.Time
}

// OutputConfig controls rendered artifacts.
type OutputConfig struct {
	Format       string
	TSVPath      string
	MarkdownPath string
	Quiet        bool
}

// AppConfig combines scan and output settings.
type AppConfig struct {
	Scan   ScanConfig
	Output OutputConfig
}

// ParseConfig reads flags and returns application configuration.
func ParseConfig() (AppConfig, error) {
	days := flag.Int("days", 3, "look back this many days")
	minScore := flag.Int("min-score", 3, "minimum upvotes/points")
	minComments := flag.Int("min-comments", 2, "minimum comments")
	queries := flag.String("queries", strings.Join(defaultQueries(), ","), "comma-separated search phrases")
	subreddits := flag.String("subreddits", strings.Join(defaultSubreddits(), ","), "comma-separated subreddits for Reddit")
	format := flag.String("format", "table", "output format: table, markdown, or both")
	tsvPath := flag.String("tsv-out", "", "optional path to write TSV table")
	markdownPath := flag.String("md-out", "", "optional path to write markdown digest")
	quiet := flag.Bool("quiet", false, "suppress table output to stdout")
	flag.Parse()

	if *days < 1 {
		return AppConfig{}, fmt.Errorf("days must be at least 1")
	}

	normalizedFormat := strings.ToLower(strings.TrimSpace(*format))
	if normalizedFormat != "table" && normalizedFormat != "markdown" && normalizedFormat != "both" {
		return AppConfig{}, fmt.Errorf("format must be table, markdown, or both")
	}

	cfg := AppConfig{
		Scan: ScanConfig{
			Days:        *days,
			MinScore:    *minScore,
			MinComments: *minComments,
			Queries:     splitCSV(*queries),
			Subreddits:  splitCSV(*subreddits),
			Since:       time.Now().Add(-time.Duration(*days) * 24 * time.Hour),
		},
		Output: OutputConfig{
			Format:       normalizedFormat,
			TSVPath:      strings.TrimSpace(*tsvPath),
			MarkdownPath: strings.TrimSpace(*markdownPath),
			Quiet:        *quiet,
		},
	}

	if len(cfg.Scan.Queries) == 0 {
		return AppConfig{}, fmt.Errorf("at least one query is required")
	}

	return cfg, nil
}

func defaultQueries() []string {
	return []string{
		"AI agents production",
		"golang AI agent",
		"LLM observability",
		"human in the loop agent",
		"SRE incident triage AI",
		"multi agent workflow",
	}
}

func defaultSubreddits() []string {
	return []string{
		"golang",
		"devops",
		"sre",
		"MachineLearning",
		"LocalLLaMA",
		"programming",
		"experienceddevs",
	}
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		out = append(out, trimmed)
	}
	return out
}

func envOrEmpty(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}
