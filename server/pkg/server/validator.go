package server

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
)

const pubKeyText = `
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----
`

var pubKey *rsa.PublicKey

func init() {
	key, err := parsePublicKey([]byte(pubKeyText))
	if err != nil {
		panic(err)
	}
	pubKey = &key
}

func verifyWebhook(messageID, timestamp, body, inputSignature string) error {
	// Create the Signature to compare
	signature := fmt.Appendf(nil, "%s.%s.%s", messageID, timestamp, body)

	// Verify the Header
	return verify(pubKey, signature, []byte(inputSignature))
}

func parsePublicKey(bs []byte) (rsa.PublicKey, error) {
	block, _ := pem.Decode(bs)
	if block == nil {
		return rsa.PublicKey{}, errors.New("not decodable key")
	}

	if block.Type != "PUBLIC KEY" {
		return rsa.PublicKey{}, errors.New("not public key")
	}

	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return rsa.PublicKey{}, err
	}

	publicKey, ok := parsed.(*rsa.PublicKey)
	if !ok {
		return rsa.PublicKey{}, errors.New("not expected public key interface")
	}

	return *publicKey, nil
}

func verify(publicKey *rsa.PublicKey, body []byte, signature []byte) error {
	decoded := make([]byte, base64.StdEncoding.DecodedLen(len(signature)))

	n, err := base64.StdEncoding.Decode(decoded, signature)
	if err != nil {
		return err
	}

	signature = decoded[:n]
	hashed := sha256.Sum256(body)

	return rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, hashed[:], signature)
}
