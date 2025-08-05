package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mage-kick-webhook-proxy/pkg/config"
	"mage-kick-webhook-proxy/pkg/model"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func (s *Server) HandleToken(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		requestId := r.Header.Get("Rndr-Id")
		var tokenRequest model.AuthTokenRequest
		if err := json.NewDecoder(r.Body).Decode(&tokenRequest); err != nil {
			http.Error(w, fmt.Sprintf("Bad Request (%s)", requestId), http.StatusBadRequest)
			return
		}

		switch tokenRequest.GrantType {
		case "authorization_code":
			s.handleAuthorizationCode(ctx, w, r, tokenRequest)
		case "refresh_token":
			s.handleRefreshToken(ctx, w, r, tokenRequest)
		default:
			s.log(ctx, r, "Unsupported grant type: %s", tokenRequest.GrantType)
			http.Error(w, fmt.Sprintf("Unsupported Grant Type (%s)", requestId), http.StatusBadRequest)
		}
	}
}

func (s *Server) handleAuthorizationCode(ctx context.Context, w http.ResponseWriter, r *http.Request, tokenRequest model.AuthTokenRequest) {
	cfg := config.FromContext(ctx)
	formData := url.Values{
		"grant_type":    {`authorization_code`},
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"redirect_uri":  {fmt.Sprintf("https://%s/auth/callback", r.Host)},
		"code_verifier": {tokenRequest.CodeVerifier},
		"code":          {tokenRequest.Code},
	}

	requestId := r.Header.Get("Rndr-Id")
	result, err := s.requestAndReturnToken(ctx, formData)
	if err != nil {
		s.log(ctx, r, "Failed to request authorization code token: %v", err)
		http.Error(w, fmt.Sprintf("Internal Server Error (%s)", requestId), http.StatusInternalServerError)
		return
	}
	defer result.Body.Close()

	body, err := io.ReadAll(result.Body)
	if err != nil {
		s.log(ctx, r, "Failed to read response body: %v", err)
		http.Error(w, fmt.Sprintf("Internal Server Error (%s)", requestId), http.StatusInternalServerError)
		return
	}

	// If unsuccessful, log the error
	if result.StatusCode != http.StatusOK {
		s.log(ctx, r, "Authorization code token request failed: status=%d, redirect_uri=%s, response=%s", result.StatusCode, formData.Get("redirect_uri"), body)
		http.Error(w, fmt.Sprintf("Upstream authorization code token request failed (%s)", requestId), http.StatusInternalServerError)
		return
	}

	// Parse the response so we can make an API call to get the username
	// belonging to this access token. We can use that to provide the user's
	// polling key in the response.
	var response model.AuthTokenResponse
	if err := json.Unmarshal(body, &response); err != nil {
		s.log(ctx, r, "Failed to parse authorization code token response: %v", err)
		http.Error(w, fmt.Sprintf("Internal Server Error (%s)", requestId), http.StatusInternalServerError)
		return
	}

	headers := http.Header{
		"Authorization": {fmt.Sprintf("Bearer %s", response.AccessToken)},
	}

	req, err := http.NewRequest("GET", "https://api.kick.com/public/v1/users", nil)
	if err != nil {
		s.log(ctx, r, "Failed to create request for user info: %v", err)
		http.Error(w, fmt.Sprintf("Internal Server Error (%s)", requestId), http.StatusInternalServerError)
		return
	}
	for k, v := range headers {
		for _, vv := range v {
			req.Header.Add(k, vv)
		}
	}

	client := &http.Client{
		Timeout: 5 * time.Second,
	}
	req = req.WithContext(ctx)

	result2, err := client.Do(req)
	if err != nil {
		s.log(ctx, r, "Failed to request user info: %v", err)
		http.Error(w, fmt.Sprintf("Internal Server Error (%s)", requestId), http.StatusInternalServerError)
		return
	}
	defer result2.Body.Close()

	body2, err := io.ReadAll(result2.Body)
	if err != nil {
		s.log(ctx, r, "Failed to read user info response body: %v", err)
		http.Error(w, fmt.Sprintf("Internal Server Error (%s)", requestId), http.StatusInternalServerError)
		return
	}

	if result2.StatusCode != http.StatusOK {
		s.log(ctx, r, "Failed to get user info: status=%d, response=%s", result2.StatusCode, body2)
		http.Error(w, fmt.Sprintf("Failed to get user info (%s)", requestId), http.StatusInternalServerError)
		return
	}

	var userInfo model.UserInfo
	if err := json.Unmarshal(body2, &userInfo); err != nil {
		s.log(ctx, r, "Failed to parse user info response: %v, %v", body2, err)
		http.Error(w, fmt.Sprintf("Internal Server Error (%s)", requestId), http.StatusInternalServerError)
		return
	}

	if len(userInfo.Data) != 1 {
		s.log(ctx, r, "Unexpected user info response: %v", userInfo)
		http.Error(w, fmt.Sprintf("Internal Server Error (%s)", requestId), http.StatusInternalServerError)
		return
	}

	if key, exists := config.FromContext(ctx).KickNameToID[strings.ToLower(userInfo.Data[0].Name)]; exists {
		response.ProxyPollKey = key
		s.log(ctx, r, "User %s found in configured Kick IDs, setting ProxyPollKey to %s", userInfo.Data[0].Name, key)
	} else {
		s.log(ctx, r, "User %s not found in configured Kick IDs", userInfo.Data[0].Name)
		http.Error(w, fmt.Sprintf("User is not authorized to use this proxy (%s)", requestId), http.StatusForbidden)
		return
	}

	data, err := json.Marshal(response)
	if err != nil {
		s.log(ctx, r, "Failed to marshal response: %v", err)
		http.Error(w, fmt.Sprintf("Internal Server Error (%s)", requestId), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
	s.log(ctx, r, "Authorization code token request successful: user=%s", userInfo.Data[0].Name)
}

func (s *Server) handleRefreshToken(ctx context.Context, w http.ResponseWriter, r *http.Request, tokenRequest model.AuthTokenRequest) {
	cfg := config.FromContext(ctx)
	formData := url.Values{
		"grant_type":    {`refresh_token`},
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"refresh_token": {tokenRequest.RefreshToken},
	}

	requestId := r.Header.Get("Rndr-Id")
	result, err := s.requestAndReturnToken(ctx, formData)
	if err != nil {
		s.log(ctx, r, "Failed to request refresh token: %v", err)
		http.Error(w, fmt.Sprintf("Internal Server Error (%s)", requestId), http.StatusInternalServerError)
		return
	}
	defer result.Body.Close()

	if result.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(result.Body)
		s.log(ctx, r, "Refresh token request failed: status=%d, response=%s", result.StatusCode, body)
		http.Error(w, fmt.Sprintf("Upstream refresh token request failed (%s)", requestId), http.StatusInternalServerError)
		return
	}

	// We don't even want to look at the result. Just blindly return it.
	w.WriteHeader(result.StatusCode)
	if _, err := io.Copy(w, result.Body); err != nil {
		s.log(ctx, r, "Failed to write response: %v", err)
		http.Error(w, fmt.Sprintf("Internal Server Error (%s)", requestId), http.StatusInternalServerError)
		return
	}

	s.log(ctx, r, "Refresh token request successful")
}

func (s *Server) requestAndReturnToken(ctx context.Context, formData url.Values) (*http.Response, error) {
	headers := http.Header{
		"Content-Type": {"application/x-www-form-urlencoded"},
	}

	req, err := http.NewRequest("POST", "https://id.kick.com/oauth/token", strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		for _, vv := range v {
			req.Header.Add(k, vv)
		}
	}

	client := &http.Client{
		Timeout: 5 * time.Second,
	}
	req = req.WithContext(ctx)
	return client.Do(req)
}

func (s *Server) HandleAuthorizationRequest(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		queryParams := r.URL.Query()
		required := []string{"redirect_uri", "scope", "code_challenge", "code_challenge_method", "state"}
		for _, param := range required {
			if queryParams.Get(param) == "" {
				http.Error(w, fmt.Sprintf("Bad Request: Missing %s", param), http.StatusBadRequest)
				return
			}
		}

		{
			s.authsMu.Lock()
			defer s.authsMu.Unlock()

			if _, exists := s.auths[queryParams.Get("state")]; exists {
				http.Error(w, "State already used", http.StatusConflict)
				return
			}

			s.auths[queryParams.Get("state")] = queryParams.Get("redirect_uri")
		}

		cfg := config.FromContext(ctx)
		queryParams.Set("client_id", cfg.ClientID)
		queryParams.Set("response_type", "code")
		queryParams.Set("redirect_uri", fmt.Sprintf("https://%s/auth/callback", r.Host))
		target := "https://id.kick.com/oauth/authorize?" + queryParams.Encode()
		s.log(ctx, r, "Redirecting authorize request to Kick: %s", target)
		http.Redirect(w, r, target, http.StatusMovedPermanently)
	}
}

func (s *Server) HandleCallback(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	// Even though we see the code, we can't do anything with it due to PKCE.
	return func(w http.ResponseWriter, r *http.Request) {
		queryParams := r.URL.Query()
		required := []string{"code", "state"}
		for _, param := range required {
			if queryParams.Get(param) == "" {
				http.Error(w, fmt.Sprintf("Bad Request: Missing %s", param), http.StatusBadRequest)
				return
			}
		}

		redirectURI := ""
		{
			s.authsMu.RLock()
			defer s.authsMu.RUnlock()

			uri, exists := s.auths[queryParams.Get("state")]
			if !exists {
				http.Error(w, "State not found", http.StatusBadRequest)
				return
			}

			redirectURI = uri
			s.auths[queryParams.Get("state")] = "" // Clear the state to prevent reuse
		}

		target := redirectURI + "?" + queryParams.Encode()
		s.log(ctx, r, "Redirecting Kick callback to original redirect URI: %s", target)

		http.Redirect(w, r, target, http.StatusMovedPermanently)
	}
}
