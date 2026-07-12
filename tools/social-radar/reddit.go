package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// RedditClient searches Reddit using application-only OAuth2.
type RedditClient struct {
	httpClient *http.Client
	userAgent  string
	clientID   string
	secret     string
	token      string
}

// NewRedditClient builds a Reddit API client from environment variables.
// Requires REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT.
func NewRedditClient(httpClient *http.Client) (*RedditClient, error) {
	clientID := envOrEmpty("REDDIT_CLIENT_ID")
	secret := envOrEmpty("REDDIT_CLIENT_SECRET")
	userAgent := envOrEmpty("REDDIT_USER_AGENT")
	if clientID == "" || secret == "" || userAgent == "" {
		return nil, fmt.Errorf("reddit: set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT (see README)")
	}

	return &RedditClient{
		httpClient: httpClient,
		userAgent:  userAgent,
		clientID:   clientID,
		secret:     secret,
	}, nil
}

// FindCandidates searches configured subreddits and global Reddit for recent threads.
func (client *RedditClient) FindCandidates(ctx context.Context, cfg ScanConfig) ([]ThreadCandidate, error) {
	if err := client.authenticate(ctx); err != nil {
		return nil, fmt.Errorf("reddit auth: %w", err)
	}

	seen := map[string]struct{}{}
	out := make([]ThreadCandidate, 0)

	for _, query := range cfg.Queries {
		globalHits, err := client.search(ctx, query, "", cfg)
		if err != nil {
			return nil, fmt.Errorf("reddit global search %q: %w", query, err)
		}
		out = appendUnique(out, globalHits, seen)

		for _, subreddit := range cfg.Subreddits {
			hits, err := client.search(ctx, query, subreddit, cfg)
			if err != nil {
				return nil, fmt.Errorf("reddit r/%s search %q: %w", subreddit, query, err)
			}
			out = appendUnique(out, hits, seen)
		}
	}

	return out, nil
}

func (client *RedditClient) authenticate(ctx context.Context) error {
	form := url.Values{}
	form.Set("grant_type", "client_credentials")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://www.reddit.com/api/v1/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("build token request: %w", err)
	}

	req.SetBasicAuth(client.clientID, client.secret)
	req.Header.Set("User-Agent", client.userAgent)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := client.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request token: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("token HTTP %d: %s", resp.StatusCode, string(body))
	}

	var payload struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return fmt.Errorf("decode token: %w", err)
	}
	if payload.AccessToken == "" {
		return fmt.Errorf("empty access token")
	}

	client.token = payload.AccessToken
	return nil
}

func (client *RedditClient) search(ctx context.Context, query string, subreddit string, cfg ScanConfig) ([]ThreadCandidate, error) {
	params := url.Values{}
	params.Set("q", query)
	params.Set("sort", "new")
	params.Set("t", "week")
	params.Set("limit", "100")

	endpoint := "https://oauth.reddit.com/search?" + params.Encode()
	if subreddit != "" {
		params.Set("restrict_sr", "true")
		endpoint = fmt.Sprintf("https://oauth.reddit.com/r/%s/search?%s", subreddit, params.Encode())
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build search request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+client.token)
	req.Header.Set("User-Agent", client.userAgent)

	resp, err := client.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("search request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read search response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("search HTTP %d: %s", resp.StatusCode, string(body))
	}

	var listing redditListing
	if err := json.Unmarshal(body, &listing); err != nil {
		return nil, fmt.Errorf("decode search response: %w", err)
	}

	out := make([]ThreadCandidate, 0)
	for _, child := range listing.Data.Children {
		post := child.Data
		createdAt := time.Unix(int64(post.CreatedUTC), 0)
		if createdAt.Before(cfg.Since) {
			continue
		}
		if post.Score < cfg.MinScore && post.NumComments < cfg.MinComments {
			continue
		}

		threadURL := post.URL
		if strings.HasPrefix(post.Permalink, "/") {
			threadURL = "https://www.reddit.com" + post.Permalink
		}

		source := "reddit"
		if post.Subreddit != "" {
			source = "r/" + post.Subreddit
		}

		out = append(out, ThreadCandidate{
			Platform:   "reddit",
			Source:     source,
			Title:      post.Title,
			URL:        threadURL,
			Score:      post.Score,
			Comments:   post.NumComments,
			CreatedAt:  createdAt,
			Query:      query,
			Engagement: post.Score + post.NumComments,
		})
	}

	return out, nil
}

type redditListing struct {
	Data struct {
		Children []struct {
			Data struct {
				Title       string  `json:"title"`
				URL         string  `json:"url"`
				Permalink   string  `json:"permalink"`
				Score       int     `json:"score"`
				NumComments int     `json:"num_comments"`
				CreatedUTC  float64 `json:"created_utc"`
				Subreddit   string  `json:"subreddit"`
			} `json:"data"`
		} `json:"children"`
	} `json:"data"`
}

func appendUnique(items []ThreadCandidate, more []ThreadCandidate, seen map[string]struct{}) []ThreadCandidate {
	for _, item := range more {
		if _, ok := seen[item.URL]; ok {
			continue
		}
		seen[item.URL] = struct{}{}
		items = append(items, item)
	}
	return items
}
