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

// ParseConfig reads flags and returns scan configuration.
func ParseConfig() (ScanConfig, error) {
	days := flag.Int("days", 3, "look back this many days")
	minScore := flag.Int("min-score", 3, "minimum upvotes/points")
	minComments := flag.Int("min-comments", 2, "minimum comments")
	queries := flag.String("queries", strings.Join(defaultQueries(), ","), "comma-separated search phrases")
	subreddits := flag.String("subreddits", strings.Join(defaultSubreddits(), ","), "comma-separated subreddits for Reddit")
	flag.Parse()

	if *days < 1 {
		return ScanConfig{}, fmt.Errorf("days must be at least 1")
	}

	cfg := ScanConfig{
		Days:        *days,
		MinScore:    *minScore,
		MinComments: *minComments,
		Queries:     splitCSV(*queries),
		Subreddits:  splitCSV(*subreddits),
		Since:       time.Now().Add(-time.Duration(*days) * 24 * time.Hour),
	}

	if len(cfg.Queries) == 0 {
		return ScanConfig{}, fmt.Errorf("at least one query is required")
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
