package main

import "time"

// ThreadCandidate is a recent post worth reviewing for thoughtful engagement.
type ThreadCandidate struct {
	Platform   string
	Source     string
	Title      string
	URL        string
	Score      int
	Comments   int
	CreatedAt  time.Time
	Query      string
	Engagement int
}
