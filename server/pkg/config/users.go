package config

import (
	"bufio"
	"os"
	"strings"
)

func (cfg *Config) KickNameToID(kickName string) (string, bool) {
	cfg.kickNameToIDMu.RLock()
	defer cfg.kickNameToIDMu.RUnlock()
	id, ok := cfg.kickNameToID[strings.ToLower(kickName)]
	return id, ok
}

func (cfg *Config) KickNamesToIDs() map[string]string {
	cfg.kickNameToIDMu.RLock()
	defer cfg.kickNameToIDMu.RUnlock()
	// Return a copy to avoid modification
	copy := make(map[string]string)
	for k, v := range cfg.kickNameToID {
		copy[k] = v
	}
	return copy
}

func (cfg *Config) IDToKickName(id string) (string, bool) {
	cfg.idToKickNameMu.RLock()
	defer cfg.idToKickNameMu.RUnlock()
	kickName, ok := cfg.idToKickName[id]
	return kickName, ok
}

func (cfg *Config) SetUser(username, uuid string, shouldDelete bool) {
	cfg.idToKickNameMu.Lock()
	defer cfg.idToKickNameMu.Unlock()
	cfg.kickNameToIDMu.Lock()
	defer cfg.kickNameToIDMu.Unlock()

	username = strings.ToLower(username)

	if shouldDelete {
		// Only delete from idToKickName if UUID is not empty
		if uuid != "" {
			delete(cfg.idToKickName, uuid)
		}
		delete(cfg.kickNameToID, username)
		return
	}

	// Check if this username is currently mapped to a different UUID and clean up
	if oldUUID, exists := cfg.kickNameToID[username]; exists && oldUUID != uuid {
		// Remove the old mapping from idToKickName (only if oldUUID is not empty)
		if oldUUID != "" {
			delete(cfg.idToKickName, oldUUID)
		}
	}

	// Check if this UUID already exists and remove the old username mapping
	// Only do this for non-empty UUIDs to allow multiple users with empty UUID
	if uuid != "" {
		if oldUsername, exists := cfg.idToKickName[uuid]; exists {
			delete(cfg.kickNameToID, oldUsername)
		}
		cfg.idToKickName[uuid] = username
	}

	cfg.kickNameToID[username] = uuid
}

func (cfg *Config) loadUsers() error {
	cfg.idToKickName = make(map[string]string)
	cfg.kickNameToID = make(map[string]string)

	if cfg.UsersFile == "" {
		return nil
	}

	file, err := os.Open(cfg.UsersFile)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		uuid := strings.TrimSpace(parts[0])
		kickName := strings.TrimSpace(parts[1])
		if strings.HasPrefix(uuid, "#") {
			continue
		}
		if uuid != "" && kickName != "" {
			cfg.idToKickName[uuid] = strings.ToLower(kickName)
		}
		if kickName != "" {
			cfg.kickNameToID[strings.ToLower(kickName)] = uuid
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}

	return nil
}
