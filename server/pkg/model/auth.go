package model

type AuthTokenRequest struct {
	Code         string `json:"code,omitempty"`
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	RedirectURI  string `json:"redirect_uri,omitempty"`
	GrantType    string `json:"grant_type"`
	CodeVerifier string `json:"code_verifier,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
}

type AuthTokenResponse struct {
	AccessToken  string `json:"access_token,omitempty"`
	TokenType    string `json:"token_type,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
	ExpiresIn    int    `json:"expires_in,omitempty"`
	Scope        string `json:"scope,omitempty"`
	ProxyPollKey string `json:"proxy_poll_key,omitempty"`
}

type UserInfo struct {
	Data []struct {
		Email          string `json:"email,omitempty"`
		Name           string `json:"name,omitempty"`
		ProfilePicture string `json:"profile_picture,omitempty"`
		ID             string `json:"id,omitempty"`
	} `json:"data,omitempty"`
	Message string `json:"message,omitempty"`
}
