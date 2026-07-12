package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"golang.org/x/sync/errgroup"
)

func main() {
	cfg, err := ParseConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	httpClient := &http.Client{Timeout: 30 * time.Second}
	all := make([]ThreadCandidate, 0)

	g, gctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		client := NewHackerNewsClient(httpClient)
		hits, err := client.FindCandidates(gctx, cfg.Scan)
		if err != nil {
			return err
		}
		all = append(all, hits...)
		return nil
	})

	g.Go(func() error {
		client, err := NewRedditClient(httpClient)
		if err != nil {
			fmt.Fprintf(os.Stderr, "reddit skipped: %v\n", err)
			return nil
		}

		hits, err := client.FindCandidates(gctx, cfg.Scan)
		if err != nil {
			return err
		}
		all = append(all, hits...)
		return nil
	})

	if err := g.Wait(); err != nil {
		fmt.Fprintf(os.Stderr, "scan failed: %v\n", err)
		os.Exit(1)
	}

	if err := WriteOutputs(all, cfg.Scan.Since, cfg.Output); err != nil {
		fmt.Fprintf(os.Stderr, "output error: %v\n", err)
		os.Exit(1)
	}
}
