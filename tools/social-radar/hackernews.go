package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// HackerNewsClient queries the public Algolia HN Search API (no API key).
type HackerNewsClient struct {
	httpClient *http.Client
}

// NewHackerNewsClient builds an HN search client.
func NewHackerNewsClient(httpClient *http.Client) *HackerNewsClient {
	return &HackerNewsClient{httpClient: httpClient}
}

// FindCandidates returns recent HN stories matching configured queries.
func (client *HackerNewsClient) FindCandidates(ctx context.Context, cfg ScanConfig) ([]ThreadCandidate, error) {
	seen := map[string]struct{}{}
	out := make([]ThreadCandidate, 0)

	for _, query := range cfg.Queries {
		hits, err := client.searchStories(ctx, query, cfg)
		if err != nil {
			return nil, fmt.Errorf("hn search %q: %w", query, err)
		}
		out = appendUnique(out, hits, seen)
	}

	return out, nil
}

func (client *HackerNewsClient) searchStories(ctx context.Context, query string, cfg ScanConfig) ([]ThreadCandidate, error) {
	params := url.Values{}
	params.Set("query", query)
	params.Set("tags", "story")
	params.Set("hitsPerPage", "100")
	params.Set("numericFilters", fmt.Sprintf("created_at_i>%d", cfg.Since.Unix()))

	endpoint := "https://hn.algolia.com/api/v1/search_by_date?" + params.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}

	resp, err := client.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}

	var payload hnSearchResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	out := make([]ThreadCandidate, 0, len(payload.Hits))
	for _, hit := range payload.Hits {
		createdAt := time.Unix(hit.CreatedAtI, 0)
		if createdAt.Before(cfg.Since) {
			continue
		}
		if hit.Points < cfg.MinScore && hit.NumComments < cfg.MinComments {
			continue
		}

		threadURL := hit.URL
		if threadURL == "" {
			threadURL = "https://news.ycombinator.com/item?id=" + hit.ObjectID
		}

		out = append(out, ThreadCandidate{
			Platform:   "hackernews",
			Source:     "news.ycombinator.com",
			Title:      hit.Title,
			URL:        threadURL,
			Score:      hit.Points,
			Comments:   hit.NumComments,
			CreatedAt:  createdAt,
			Query:      query,
			Engagement: hit.Points + hit.NumComments,
		})
	}

	return out, nil
}

type hnSearchResponse struct {
	Hits []struct {
		ObjectID    string `json:"objectID"`
		Title       string `json:"title"`
		URL         string `json:"url"`
		Points      int    `json:"points"`
		NumComments int    `json:"num_comments"`
		CreatedAtI  int64  `json:"created_at_i"`
	} `json:"hits"`
}
