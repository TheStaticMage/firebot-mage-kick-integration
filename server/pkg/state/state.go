package state

import (
	"mage-kick-webhook-proxy/pkg/model"
)

type State interface {
	GetAndClear(user string) []model.Webhook
	Put(user string, webhook model.Webhook)
}
