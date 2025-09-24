package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfig_loadUsers(t *testing.T) {
	tests := []struct {
		name             string
		fileContent      string
		expectedIDToName map[string]string
		expectedNameToID map[string]string
		expectError      bool
	}{
		{
			name: "valid users file",
			fileContent: `user1-uuid:alice
user2-uuid:bob
user3-uuid:charlie`,
			expectedIDToName: map[string]string{
				"user1-uuid": "alice",
				"user2-uuid": "bob",
				"user3-uuid": "charlie",
			},
			expectedNameToID: map[string]string{
				"alice":   "user1-uuid",
				"bob":     "user2-uuid",
				"charlie": "user3-uuid",
			},
			expectError: false,
		},
		{
			name: "mixed case usernames are normalized to lowercase",
			fileContent: `user1-uuid:Alice
user2-uuid:BOB
user3-uuid:ChArLiE`,
			expectedIDToName: map[string]string{
				"user1-uuid": "alice",
				"user2-uuid": "bob",
				"user3-uuid": "charlie",
			},
			expectedNameToID: map[string]string{
				"alice":   "user1-uuid",
				"bob":     "user2-uuid",
				"charlie": "user3-uuid",
			},
			expectError: false,
		},
		{
			name: "whitespace trimming",
			fileContent: `  user1-uuid  :  alice
	user2-uuid	:	bob
user3-uuid: charlie `,
			expectedIDToName: map[string]string{
				"user1-uuid": "alice",
				"user2-uuid": "bob",
				"user3-uuid": "charlie",
			},
			expectedNameToID: map[string]string{
				"alice":   "user1-uuid",
				"bob":     "user2-uuid",
				"charlie": "user3-uuid",
			},
			expectError: false,
		},
		{
			name: "empty lines and invalid lines are skipped",
			fileContent: `user1-uuid:alice

invalid-line-without-colon
user2-uuid:bob
:empty-uuid
empty-name:
user3-uuid:charlie`,
			expectedIDToName: map[string]string{
				"user1-uuid": "alice",
				"user2-uuid": "bob",
				"user3-uuid": "charlie",
			},
			expectedNameToID: map[string]string{
				"alice":      "user1-uuid",
				"bob":        "user2-uuid",
				"charlie":    "user3-uuid",
				"empty-uuid": "", // This gets added because kickName is not empty (it's "empty-uuid")
			},
			expectError: false,
		},
		{
			name: "commented lines are skipped",
			fileContent: `user1-uuid:alice
#user2-uuid:bob
# This is a comment
user3-uuid:charlie
#commented-uuid:commented-user`,
			expectedIDToName: map[string]string{
				"user1-uuid": "alice",
				"user3-uuid": "charlie",
			},
			expectedNameToID: map[string]string{
				"alice":   "user1-uuid",
				"charlie": "user3-uuid",
			},
			expectError: false,
		},
		{
			name:             "empty file",
			fileContent:      "",
			expectedIDToName: map[string]string{},
			expectedNameToID: map[string]string{},
			expectError:      false,
		},
		{
			name: "file with only comments and empty lines",
			fileContent: `# This is a comment
# Another comment

# Yet another comment`,
			expectedIDToName: map[string]string{},
			expectedNameToID: map[string]string{},
			expectError:      false,
		},
		{
			name: "colons in usernames are handled correctly",
			fileContent: `user1-uuid:alice:with:colons
user2-uuid:bob:another:colon`,
			expectedIDToName: map[string]string{
				"user1-uuid": "alice:with:colons",
				"user2-uuid": "bob:another:colon",
			},
			expectedNameToID: map[string]string{
				"alice:with:colons": "user1-uuid",
				"bob:another:colon": "user2-uuid",
			},
			expectError: false,
		},
		{
			name: "duplicate usernames - last one wins",
			fileContent: `user1-uuid:alice
user2-uuid:alice
user3-uuid:bob`,
			expectedIDToName: map[string]string{
				"user1-uuid": "alice",
				"user2-uuid": "alice",
				"user3-uuid": "bob",
			},
			expectedNameToID: map[string]string{
				"alice": "user2-uuid", // Last one wins
				"bob":   "user3-uuid",
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create temporary file
			tempDir := t.TempDir()
			tempFile := filepath.Join(tempDir, "users.txt")

			err := os.WriteFile(tempFile, []byte(tt.fileContent), 0644)
			require.NoError(t, err)

			// Create config and set the users file path
			cfg := &Config{
				UsersFile: tempFile,
			}

			// Call loadUsers
			err = cfg.loadUsers()

			if tt.expectError {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)

			// Test IDToKickName function
			for expectedID, expectedName := range tt.expectedIDToName {
				actualName, ok := cfg.IDToKickName(expectedID)
				assert.True(t, ok, "ID %s should be found", expectedID)
				assert.Equal(t, expectedName, actualName, "Name for ID %s should match", expectedID)
			}

			// Test that non-existent IDs return false
			nonExistentName, ok := cfg.IDToKickName("non-existent-id")
			assert.False(t, ok, "Non-existent ID should return false")
			assert.Empty(t, nonExistentName, "Non-existent ID should return empty string")

			// Test KickNameToID function
			for expectedName, expectedID := range tt.expectedNameToID {
				actualID, ok := cfg.KickNameToID(expectedName)
				assert.True(t, ok, "Name %s should be found", expectedName)
				assert.Equal(t, expectedID, actualID, "ID for name %s should match", expectedName)
			}

			// Test case insensitive lookup for KickNameToID
			for expectedName, expectedID := range tt.expectedNameToID {
				// Test uppercase
				actualID, ok := cfg.KickNameToID(strings.ToUpper(expectedName))
				if expectedName != "" {
					assert.True(t, ok, "Uppercase name %s should be found", strings.ToUpper(expectedName))
					assert.Equal(t, expectedID, actualID, "ID for uppercase name %s should match", strings.ToUpper(expectedName))
				}
			}

			// Test that non-existent names return false
			nonExistentID, ok := cfg.KickNameToID("non-existent-name")
			assert.False(t, ok, "Non-existent name should return false")
			assert.Empty(t, nonExistentID, "Non-existent name should return empty string")

			// Test KickNamesToIDs function
			actualNameToID := cfg.KickNamesToIDs()
			assert.Equal(t, tt.expectedNameToID, actualNameToID, "KickNamesToIDs should return expected map")

			// Verify that modifying the returned map doesn't affect the internal state
			if len(actualNameToID) > 0 {
				for name := range actualNameToID {
					actualNameToID[name] = "modified"
					break
				}
				// Get the map again and verify it's unchanged
				freshMap := cfg.KickNamesToIDs()
				assert.Equal(t, tt.expectedNameToID, freshMap, "Internal map should not be affected by modifications to returned map")
			}
		})
	}
}

func TestConfig_loadUsers_FileNotFound(t *testing.T) {
	cfg := &Config{
		UsersFile: "/non/existent/file.txt",
	}

	err := cfg.loadUsers()
	assert.Error(t, err)
	assert.True(t, os.IsNotExist(err), "Error should be file not found error")
}

func TestConfig_loadUsers_EmptyUsersFile(t *testing.T) {
	cfg := &Config{
		UsersFile: "",
	}

	err := cfg.loadUsers()
	assert.NoError(t, err, "Empty UsersFile should not cause error")

	// Maps should be empty when UsersFile is empty
	assert.Empty(t, cfg.idToKickName)
	assert.Empty(t, cfg.kickNameToID)
}

func TestConfig_loadUsers_ConcurrentAccess(t *testing.T) {
	// Create temporary file
	tempDir := t.TempDir()
	tempFile := filepath.Join(tempDir, "users.txt")

	content := `user1-uuid:alice
user2-uuid:bob
user3-uuid:charlie`

	err := os.WriteFile(tempFile, []byte(content), 0644)
	require.NoError(t, err)

	cfg := &Config{
		UsersFile: tempFile,
	}

	// Load users
	err = cfg.loadUsers()
	require.NoError(t, err)

	// Test concurrent access to the maps
	done := make(chan bool, 2)

	// Goroutine 1: Read operations
	go func() {
		defer func() { done <- true }()
		for i := 0; i < 100; i++ {
			_, _ = cfg.KickNameToID("alice")
			_, _ = cfg.IDToKickName("user1-uuid")
			_ = cfg.KickNamesToIDs()
		}
	}()

	// Goroutine 2: More read operations
	go func() {
		defer func() { done <- true }()
		for i := 0; i < 100; i++ {
			_, _ = cfg.KickNameToID("bob")
			_, _ = cfg.IDToKickName("user2-uuid")
			_ = cfg.KickNamesToIDs()
		}
	}()

	// Wait for both goroutines to complete
	<-done
	<-done

	// Verify data integrity after concurrent access
	name, ok := cfg.IDToKickName("user1-uuid")
	assert.True(t, ok)
	assert.Equal(t, "alice", name)

	id, ok := cfg.KickNameToID("alice")
	assert.True(t, ok)
	assert.Equal(t, "user1-uuid", id)
}

func TestConfig_SetUser(t *testing.T) {
	tests := []struct {
		name             string
		initialUsers     map[string]string // uuid -> username
		operations       []setUserOperation
		expectedIDToName map[string]string
		expectedNameToID map[string]string
	}{
		{
			name: "add new user",
			initialUsers: map[string]string{
				"user1-uuid": "alice",
			},
			operations: []setUserOperation{
				{username: "bob", uuid: "user2-uuid", shouldDelete: false},
			},
			expectedIDToName: map[string]string{
				"user1-uuid": "alice",
				"user2-uuid": "bob",
			},
			expectedNameToID: map[string]string{
				"alice": "user1-uuid",
				"bob":   "user2-uuid",
			},
		},
		{
			name: "update existing user",
			initialUsers: map[string]string{
				"user1-uuid": "alice",
				"user2-uuid": "bob",
			},
			operations: []setUserOperation{
				{username: "charlie", uuid: "user1-uuid", shouldDelete: false},
			},
			expectedIDToName: map[string]string{
				"user1-uuid": "charlie",
				"user2-uuid": "bob",
			},
			expectedNameToID: map[string]string{
				"charlie": "user1-uuid", // New name points to the UUID
				"bob":     "user2-uuid", // Old "alice" mapping should be removed
			},
		},
		{
			name: "delete existing user",
			initialUsers: map[string]string{
				"user1-uuid": "alice",
				"user2-uuid": "bob",
				"user3-uuid": "charlie",
			},
			operations: []setUserOperation{
				{username: "alice", uuid: "user1-uuid", shouldDelete: true},
			},
			expectedIDToName: map[string]string{
				"user2-uuid": "bob",
				"user3-uuid": "charlie",
			},
			expectedNameToID: map[string]string{
				"bob":     "user2-uuid",
				"charlie": "user3-uuid",
			},
		},
		{
			name: "delete non-existent user (no error)",
			initialUsers: map[string]string{
				"user1-uuid": "alice",
			},
			operations: []setUserOperation{
				{username: "bob", uuid: "user2-uuid", shouldDelete: true},
			},
			expectedIDToName: map[string]string{
				"user1-uuid": "alice",
			},
			expectedNameToID: map[string]string{
				"alice": "user1-uuid",
			},
		},
		{
			name:         "case normalization on add",
			initialUsers: map[string]string{},
			operations: []setUserOperation{
				{username: "ALICE", uuid: "user1-uuid", shouldDelete: false},
				{username: "Bob", uuid: "user2-uuid", shouldDelete: false},
			},
			expectedIDToName: map[string]string{
				"user1-uuid": "alice",
				"user2-uuid": "bob",
			},
			expectedNameToID: map[string]string{
				"alice": "user1-uuid",
				"bob":   "user2-uuid",
			},
		},
		{
			name: "case normalization on delete",
			initialUsers: map[string]string{
				"user1-uuid": "alice",
				"user2-uuid": "bob",
			},
			operations: []setUserOperation{
				{username: "ALICE", uuid: "user1-uuid", shouldDelete: true},
			},
			expectedIDToName: map[string]string{
				"user2-uuid": "bob",
			},
			expectedNameToID: map[string]string{
				"bob": "user2-uuid",
			},
		},
		{
			name: "multiple operations",
			initialUsers: map[string]string{
				"user1-uuid": "alice",
				"user2-uuid": "bob",
			},
			operations: []setUserOperation{
				{username: "charlie", uuid: "user3-uuid", shouldDelete: false}, // add
				{username: "alice", uuid: "user1-uuid", shouldDelete: true},    // delete
				{username: "diana", uuid: "user2-uuid", shouldDelete: false},   // update
			},
			expectedIDToName: map[string]string{
				"user2-uuid": "diana",
				"user3-uuid": "charlie",
			},
			expectedNameToID: map[string]string{
				"diana":   "user2-uuid", // New name points to the UUID (old "bob" removed)
				"charlie": "user3-uuid",
			},
		},
		{
			name: "username collision - last one wins",
			initialUsers: map[string]string{
				"user1-uuid": "alice",
			},
			operations: []setUserOperation{
				{username: "alice", uuid: "user2-uuid", shouldDelete: false}, // Same username, different UUID
			},
			expectedIDToName: map[string]string{
				"user2-uuid": "alice", // Only the new UUID mapping remains
				// user1-uuid is cleaned up to prevent orphans
			},
			expectedNameToID: map[string]string{
				"alice": "user2-uuid", // Last one wins
			},
		},
		{
			name: "old username mapping is properly removed on update",
			initialUsers: map[string]string{
				"user1-uuid": "alice",
				"user2-uuid": "bob",
				"user3-uuid": "charlie",
			},
			operations: []setUserOperation{
				{username: "alice_updated", uuid: "user1-uuid", shouldDelete: false}, // Update alice
				{username: "bob_updated", uuid: "user2-uuid", shouldDelete: false},   // Update bob
			},
			expectedIDToName: map[string]string{
				"user1-uuid": "alice_updated",
				"user2-uuid": "bob_updated",
				"user3-uuid": "charlie",
			},
			expectedNameToID: map[string]string{
				"alice_updated": "user1-uuid",
				"bob_updated":   "user2-uuid",
				"charlie":       "user3-uuid",
				// "alice" and "bob" should NOT be present
			},
		},
		{
			name: "multiple users with empty UUID",
			initialUsers: map[string]string{
				"user1-uuid": "alice",
			},
			operations: []setUserOperation{
				{username: "bob", uuid: "", shouldDelete: false},     // Add user with empty UUID
				{username: "charlie", uuid: "", shouldDelete: false}, // Add another user with empty UUID
			},
			expectedIDToName: map[string]string{
				"user1-uuid": "alice", // Only non-empty UUIDs appear here
				// Empty UUIDs should NOT appear in idToKickName
			},
			expectedNameToID: map[string]string{
				"alice":   "user1-uuid",
				"bob":     "", // Users with empty UUID still appear in kickNameToID
				"charlie": "", // Users with empty UUID still appear in kickNameToID
			},
		},
		{
			name: "reassign username from real UUID to empty UUID (orphan cleanup)",
			initialUsers: map[string]string{
				"bob-uuid": "bob",
			},
			operations: []setUserOperation{
				{username: "bob", uuid: "", shouldDelete: false}, // Reassign bob to empty UUID
			},
			expectedIDToName: map[string]string{
				// bob-uuid should be removed to prevent orphans
			},
			expectedNameToID: map[string]string{
				"bob": "", // bob now maps to empty UUID
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Initialize config with initial users
			cfg := &Config{
				idToKickName: make(map[string]string),
				kickNameToID: make(map[string]string),
			}

			// Set up initial state
			for uuid, username := range tt.initialUsers {
				cfg.idToKickName[uuid] = strings.ToLower(username)
				cfg.kickNameToID[strings.ToLower(username)] = uuid
			}

			// Perform operations
			for _, op := range tt.operations {
				cfg.SetUser(op.username, op.uuid, op.shouldDelete)
			}

			// Test IDToKickName function
			for expectedID, expectedName := range tt.expectedIDToName {
				actualName, ok := cfg.IDToKickName(expectedID)
				assert.True(t, ok, "ID %s should be found", expectedID)
				assert.Equal(t, expectedName, actualName, "Name for ID %s should match", expectedID)
			}

			// Test that deleted IDs are not found
			for uuid := range tt.initialUsers {
				if _, exists := tt.expectedIDToName[uuid]; !exists {
					_, ok := cfg.IDToKickName(uuid)
					assert.False(t, ok, "Deleted ID %s should not be found", uuid)
				}
			}

			// Test KickNameToID function
			for expectedName, expectedID := range tt.expectedNameToID {
				actualID, ok := cfg.KickNameToID(expectedName)
				assert.True(t, ok, "Name %s should be found", expectedName)
				assert.Equal(t, expectedID, actualID, "ID for name %s should match", expectedName)
			}

			// Test case insensitive lookup for KickNameToID
			for expectedName, expectedID := range tt.expectedNameToID {
				if expectedName != "" {
					// Test uppercase
					actualID, ok := cfg.KickNameToID(strings.ToUpper(expectedName))
					assert.True(t, ok, "Uppercase name %s should be found", strings.ToUpper(expectedName))
					assert.Equal(t, expectedID, actualID, "ID for uppercase name %s should match", strings.ToUpper(expectedName))
				}
			}

			// Test that explicitly deleted names are not found
			for _, op := range tt.operations {
				if op.shouldDelete {
					_, ok := cfg.KickNameToID(strings.ToLower(op.username))
					assert.False(t, ok, "Explicitly deleted name %s should not be found", op.username)
				}
			}

			// Test KickNamesToIDs function
			actualNameToID := cfg.KickNamesToIDs()
			assert.Equal(t, tt.expectedNameToID, actualNameToID, "KickNamesToIDs should return expected map")

			// Additional check: verify old usernames are removed after updates
			if tt.name == "old username mapping is properly removed on update" {
				// Verify that "alice" and "bob" are no longer found
				_, ok := cfg.KickNameToID("alice")
				assert.False(t, ok, "Old username 'alice' should not be found after update")

				_, ok = cfg.KickNameToID("bob")
				assert.False(t, ok, "Old username 'bob' should not be found after update")
			}

			// Additional check: verify empty UUIDs are not in IDToKickName
			if tt.name == "multiple users with empty UUID" {
				// Empty UUID should not be found in IDToKickName
				_, ok := cfg.IDToKickName("")
				assert.False(t, ok, "Empty UUID should not be found in IDToKickName")
			}
		})
	}
}

func TestConfig_SetUser_ConcurrentAccess(t *testing.T) {
	cfg := &Config{
		idToKickName: make(map[string]string),
		kickNameToID: make(map[string]string),
	}

	// Initialize with some data
	cfg.SetUser("alice", "user1-uuid", false)
	cfg.SetUser("bob", "user2-uuid", false)

	done := make(chan bool, 3)

	// Goroutine 1: Add users
	go func() {
		defer func() { done <- true }()
		for i := 0; i < 50; i++ {
			cfg.SetUser("charlie", "user3-uuid", false)
		}
	}()

	// Goroutine 2: Delete and re-add users
	go func() {
		defer func() { done <- true }()
		for i := 0; i < 50; i++ {
			cfg.SetUser("alice", "user1-uuid", true)  // delete
			cfg.SetUser("alice", "user1-uuid", false) // re-add
		}
	}()

	// Goroutine 3: Read operations
	go func() {
		defer func() { done <- true }()
		for i := 0; i < 50; i++ {
			_, _ = cfg.KickNameToID("bob")
			_, _ = cfg.IDToKickName("user2-uuid")
			_ = cfg.KickNamesToIDs()
		}
	}()

	// Wait for all goroutines to complete
	<-done
	<-done
	<-done

	// Verify final state - alice and bob should exist
	name, ok := cfg.IDToKickName("user1-uuid")
	assert.True(t, ok)
	assert.Equal(t, "alice", name)

	id, ok := cfg.KickNameToID("alice")
	assert.True(t, ok)
	assert.Equal(t, "user1-uuid", id)

	name, ok = cfg.IDToKickName("user2-uuid")
	assert.True(t, ok)
	assert.Equal(t, "bob", name)

	id, ok = cfg.KickNameToID("bob")
	assert.True(t, ok)
	assert.Equal(t, "user2-uuid", id)
}

func TestConfig_SetUser_EmptyValues(t *testing.T) {
	cfg := &Config{
		idToKickName: make(map[string]string),
		kickNameToID: make(map[string]string),
	}

	// Test with empty username
	cfg.SetUser("", "user1-uuid", false)

	// Should still add to idToKickName with empty string
	name, ok := cfg.IDToKickName("user1-uuid")
	assert.True(t, ok)
	assert.Equal(t, "", name)

	// Should add to kickNameToID with empty key
	id, ok := cfg.KickNameToID("")
	assert.True(t, ok)
	assert.Equal(t, "user1-uuid", id)

	// Test with empty UUID - should NOT be stored in idToKickName
	cfg.SetUser("alice", "", false)

	// Should NOT be found in idToKickName
	name, ok = cfg.IDToKickName("")
	assert.False(t, ok, "Empty UUID should not be found in IDToKickName")
	assert.Empty(t, name)

	// Should still be found in kickNameToID
	id, ok = cfg.KickNameToID("alice")
	assert.True(t, ok)
	assert.Equal(t, "", id)
}

func TestConfig_SetUser_OrphanCleanup(t *testing.T) {
	cfg := &Config{
		idToKickName: make(map[string]string),
		kickNameToID: make(map[string]string),
	}

	// Set up initial state: bob -> bob-uuid
	cfg.SetUser("bob", "bob-uuid", false)

	// Verify initial state
	name, ok := cfg.IDToKickName("bob-uuid")
	assert.True(t, ok)
	assert.Equal(t, "bob", name)

	id, ok := cfg.KickNameToID("bob")
	assert.True(t, ok)
	assert.Equal(t, "bob-uuid", id)

	// Now call SetUser("bob", "") - this should clean up the orphan
	cfg.SetUser("bob", "", false)

	// Verify that the old mapping is cleaned up
	_, ok = cfg.IDToKickName("bob-uuid")
	assert.False(t, ok, "Old UUID 'bob-uuid' should not be found after reassigning username")

	// But bob should still map to empty UUID
	id, ok = cfg.KickNameToID("bob")
	assert.True(t, ok)
	assert.Equal(t, "", id)

	// Test the reverse scenario: user with empty UUID gets reassigned to real UUID
	cfg.SetUser("alice", "", false)
	cfg.SetUser("alice", "alice-uuid", false)

	// alice should now map to alice-uuid
	id, ok = cfg.KickNameToID("alice")
	assert.True(t, ok)
	assert.Equal(t, "alice-uuid", id)

	name, ok = cfg.IDToKickName("alice-uuid")
	assert.True(t, ok)
	assert.Equal(t, "alice", name)

	// Test username reassignment between two real UUIDs
	cfg.SetUser("charlie", "uuid1", false)
	cfg.SetUser("charlie", "uuid2", false)

	// charlie should now map to uuid2
	id, ok = cfg.KickNameToID("charlie")
	assert.True(t, ok)
	assert.Equal(t, "uuid2", id)

	// uuid2 should map to charlie
	name, ok = cfg.IDToKickName("uuid2")
	assert.True(t, ok)
	assert.Equal(t, "charlie", name)

	// uuid1 should no longer exist
	_, ok = cfg.IDToKickName("uuid1")
	assert.False(t, ok, "Old UUID 'uuid1' should not exist after reassignment")
}

func TestConfig_SetUser_MultipleEmptyUUIDs(t *testing.T) {
	cfg := &Config{
		idToKickName: make(map[string]string),
		kickNameToID: make(map[string]string),
	}

	// Add multiple users with empty UUIDs
	cfg.SetUser("alice", "", false)
	cfg.SetUser("bob", "", false)
	cfg.SetUser("charlie", "", false)

	// IDToKickName should return false for empty UUID
	name, ok := cfg.IDToKickName("")
	assert.False(t, ok, "Empty UUID should not be found in IDToKickName")
	assert.Empty(t, name, "Empty UUID should return empty name")

	// All users should be found in KickNameToID
	id, ok := cfg.KickNameToID("alice")
	assert.True(t, ok, "alice should be found")
	assert.Equal(t, "", id, "alice should have empty UUID")

	id, ok = cfg.KickNameToID("bob")
	assert.True(t, ok, "bob should be found")
	assert.Equal(t, "", id, "bob should have empty UUID")

	id, ok = cfg.KickNameToID("charlie")
	assert.True(t, ok, "charlie should be found")
	assert.Equal(t, "", id, "charlie should have empty UUID")

	// KickNamesToIDs should contain all users
	allUsers := cfg.KickNamesToIDs()
	expectedUsers := map[string]string{
		"alice":   "",
		"bob":     "",
		"charlie": "",
	}
	assert.Equal(t, expectedUsers, allUsers, "All users with empty UUIDs should be in KickNamesToIDs")

	// Test deletion of user with empty UUID
	cfg.SetUser("alice", "", true)

	// alice should no longer be found
	_, ok = cfg.KickNameToID("alice")
	assert.False(t, ok, "alice should not be found after deletion")

	// Other users should still exist
	_, ok = cfg.KickNameToID("bob")
	assert.True(t, ok, "bob should still exist")

	_, ok = cfg.KickNameToID("charlie")
	assert.True(t, ok, "charlie should still exist")

	// KickNamesToIDs should only contain remaining users
	allUsers = cfg.KickNamesToIDs()
	expectedUsers = map[string]string{
		"bob":     "",
		"charlie": "",
	}
	assert.Equal(t, expectedUsers, allUsers, "Only remaining users should be in KickNamesToIDs")
}

type setUserOperation struct {
	username     string
	uuid         string
	shouldDelete bool
}
