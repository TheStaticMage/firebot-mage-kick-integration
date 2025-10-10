import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { IntegrationConstants } from '../../constants';
import { platformAwareUserDisplayNameVariable, PlatformAwareUserDisplayNameVariable } from '../platform-aware-user-display-name';

describe('platformAwareUserDisplayName.evaluate', () => {
    const baseTrigger: Trigger = {
        type: 'event',
        metadata: {
            username: '',
            eventSource: { id: '', name: '' },
            eventData: {},
            platform: undefined,
            chatMessage: undefined
        }
    };

    describe('platform=kick (by username)', () => {
        it('resolves to Kick based on the username', async () => {
            const trigger = {
                ...baseTrigger,
                metadata: {
                    ...baseTrigger.metadata,
                    eventSource: { id: 'something', name: 'something' },
                    chatMessage: { displayName: 'KickUser' },
                    username: ''
                }
            };
            const mockKickUserManager = {
                getViewerByUsername: jest.fn().mockResolvedValue({ displayName: 'KickViewerName' })
            };
            const obj = new PlatformAwareUserDisplayNameVariable(null, null, mockKickUserManager as any);
            const result = await obj.evaluate(trigger, 'kickuser@kick');
            expect(result).toBe('KickViewerName');
        });
    });

    describe('platform=kick', () => {
        describe('username undefined', () => {
            it('extracts the username from eventData', async() => {
                const trigger = {
                    ...baseTrigger,
                    metadata: {
                        ...baseTrigger.metadata,
                        eventSource: { id: IntegrationConstants.INTEGRATION_ID, name: 'kick-event' },
                        eventData: { username: 'kickuser@kick' },
                        chatMessage: {},
                        username: ''
                    }
                };
                const mockKickUserManager = {
                    getViewerByUsername: jest.fn((username) => {
                        if (username !== 'kickuser@kick') {
                            throw new Error(`Unexpected username: ${username}`);
                        }
                        return Promise.resolve({ displayName: 'KickViewerName' });
                    })
                };
                const obj = new PlatformAwareUserDisplayNameVariable(null, null, mockKickUserManager as any);
                const result = await obj.evaluate(trigger);
                expect(result).toBe('KickViewerName');
            });

            it('extracts the username from chatMessage', async() => {
                const trigger = {
                    ...baseTrigger,
                    metadata: {
                        ...baseTrigger.metadata,
                        eventSource: { id: IntegrationConstants.INTEGRATION_ID, name: 'kick-event' },
                        chatMessage: { username: 'kickuser@kick' },
                        username: ''
                    }
                };
                const mockKickUserManager = {
                    getViewerByUsername: jest.fn((username) => {
                        if (username !== 'kickuser@kick') {
                            throw new Error(`Unexpected username: ${username}`);
                        }
                        return Promise.resolve({ displayName: 'KickViewerName' });
                    })
                };
                const obj = new PlatformAwareUserDisplayNameVariable(null, null, mockKickUserManager as any);
                const result = await obj.evaluate(trigger);
                expect(result).toBe('KickViewerName');
            });

            it('extracts the username from metadata', async() => {
                const trigger = {
                    ...baseTrigger,
                    metadata: {
                        ...baseTrigger.metadata,
                        eventSource: { id: IntegrationConstants.INTEGRATION_ID, name: 'kick-event' },
                        chatMessage: {},
                        username: 'kickuser@kick'
                    }
                };
                const mockKickUserManager = {
                    getViewerByUsername: jest.fn((username) => {
                        if (username !== 'kickuser@kick') {
                            throw new Error(`Unexpected username: ${username}`);
                        }
                        return Promise.resolve({ displayName: 'KickViewerName' });
                    })
                };
                const obj = new PlatformAwareUserDisplayNameVariable(null, null, mockKickUserManager as any);
                const result = await obj.evaluate(trigger);
                expect(result).toBe('KickViewerName');
            });

            it('fails with no username extraction', async() => {
                const trigger = {
                    ...baseTrigger,
                    metadata: {
                        ...baseTrigger.metadata,
                        eventSource: { id: IntegrationConstants.INTEGRATION_ID, name: 'kick-event' },
                        chatMessage: {},
                        username: ''
                    }
                };
                const mockKickUserManager = {
                    getViewerByUsername: jest.fn((username) => {
                        throw new Error(`Should not be called, but was called with '${username}'`);
                    })
                };
                const obj = new PlatformAwareUserDisplayNameVariable(null, null, mockKickUserManager as any);
                const result = await obj.evaluate(trigger);
                expect(result).toBe('[No username available]');
            });
        });

        describe('username defined', () => {
            it('prefers the data in the user database', async () => {
                const trigger = {
                    ...baseTrigger,
                    metadata: {
                        ...baseTrigger.metadata,
                        eventSource: { id: IntegrationConstants.INTEGRATION_ID, name: 'kick-event' },
                        chatMessage: { displayName: 'KickUser' },
                        username: ''
                    }
                };
                const mockKickUserManager = {
                    getViewerByUsername: jest.fn().mockResolvedValue({ displayName: 'KickViewerName' })
                };
                const obj = new PlatformAwareUserDisplayNameVariable(null, null, mockKickUserManager as any);
                const result = await obj.evaluate(trigger, 'kickuser');
                expect(result).toBe('KickViewerName');
            });

            it('uses data from the chat message metadata', async () => {
                const trigger = {
                    ...baseTrigger,
                    metadata: {
                        ...baseTrigger.metadata,
                        eventSource: { id: IntegrationConstants.INTEGRATION_ID, name: 'kick-event' },
                        chatMessage: { displayName: 'KickUser' },
                        username: ''
                    }
                };
                const mockKickUserManager = {
                    getViewerByUsername: jest.fn()
                };
                const obj = new PlatformAwareUserDisplayNameVariable(null, null, mockKickUserManager as any);
                const result = await obj.evaluate(trigger, 'kickuser');
                expect(result).toBe('KickUser');
            });

            it('returns Kick display name from eventData.userDisplayName', async () => {
                const trigger = {
                    ...baseTrigger,
                    metadata: {
                        ...baseTrigger.metadata,
                        eventSource: { id: IntegrationConstants.INTEGRATION_ID, name: 'kick-event' },
                        eventData: { userDisplayName: 'KickEventUser' },
                        chatMessage: undefined,
                        username: ''
                    }
                };
                const mockKickUserManager = {
                    getViewerByUsername: jest.fn()
                };
                const obj = new PlatformAwareUserDisplayNameVariable(null, null, mockKickUserManager as any);
                const result = await obj.evaluate(trigger, 'kickuser');
                expect(result).toBe('KickEventUser');
            });

            it('returns Kick display name from metadata.userDisplayName', async () => {
                const trigger = {
                    ...baseTrigger,
                    metadata: {
                        ...baseTrigger.metadata,
                        eventSource: { id: IntegrationConstants.INTEGRATION_ID, name: 'kick-event' },
                        userDisplayName: 'MetaKickUser',
                        chatMessage: undefined,
                        username: ''
                    }
                };
                const mockKickUserManager = {
                    getViewerByUsername: jest.fn()
                };
                const obj = new PlatformAwareUserDisplayNameVariable(null, null, mockKickUserManager as any);
                const result = await obj.evaluate(trigger, 'kickuser');
                expect(result).toBe('MetaKickUser');
            });

            it('returns Kick viewer displayName from KickUserManager if username is provided', async () => {
                const trigger = {
                    ...baseTrigger,
                    metadata: {
                        ...baseTrigger.metadata,
                        eventSource: { id: IntegrationConstants.INTEGRATION_ID, name: 'kick-event' },
                        chatMessage: undefined,
                        username: 'kickuser'
                    }
                };
                const mockKickUserManager = {
                    getViewerByUsername: jest.fn().mockResolvedValue({ displayName: 'KickViewerName' })
                };
                const obj = new PlatformAwareUserDisplayNameVariable(null, null, mockKickUserManager as any);
                const result = await obj.evaluate(trigger, 'kickuser');
                expect(result).toBe('KickViewerName');
            });

            it('returns unkickified username if KickUserManager returns null', async () => {
                const trigger = {
                    ...baseTrigger,
                    metadata: {
                        ...baseTrigger.metadata,
                        eventSource: { id: IntegrationConstants.INTEGRATION_ID, name: 'kick-event' },
                        chatMessage: undefined,
                        username: 'kickuser'
                    }
                };
                const mockKickUserManager = {
                    getViewerByUsername: jest.fn().mockResolvedValue(null)
                };
                const obj = new PlatformAwareUserDisplayNameVariable(null, null, mockKickUserManager as any);
                const result = await obj.evaluate(trigger, 'kickuser');
                expect(result).toBe('kickuser');
            });

            it('returns "[No username available]" if no username or displayName is present', async () => {
                const trigger = {
                    ...baseTrigger,
                    metadata: {
                        ...baseTrigger.metadata,
                        eventSource: { id: IntegrationConstants.INTEGRATION_ID, name: 'kick-event' },
                        chatMessage: undefined,
                        username: ''
                    }
                };
                const result = await platformAwareUserDisplayNameVariable.evaluate(trigger, null);
                expect(result).toBe('[No username available]');
            });

            it('returns displayName for unkickified username if username is kickified', async () => {
                const trigger = {
                    ...baseTrigger,
                    metadata: {
                        ...baseTrigger.metadata,
                        eventSource: { id: IntegrationConstants.INTEGRATION_ID, name: 'kick-event' },
                        chatMessage: undefined,
                        username: 'kick_user'
                    }
                };
                const mockKickUserManager = {
                    getViewerByUsername: jest.fn().mockResolvedValue({ displayName: 'KickifiedUser' })
                };
                const obj = new PlatformAwareUserDisplayNameVariable(null, null, mockKickUserManager as any);
                const result = await obj.evaluate(trigger, 'kick_user');
                expect(result).toBe('KickifiedUser');
            });
        });
    });

    describe('platform=twitch', () => {
        it('returns Twitch display name from chatMessage.displayName', async () => {
            const trigger = {
                ...baseTrigger,
                metadata: {
                    ...baseTrigger.metadata,
                    eventSource: { id: 'twitch', name: 'twitch-event' },
                    chatMessage: { displayName: 'TwitchUser' },
                    username: ''
                }
            };
            const result = await platformAwareUserDisplayNameVariable.evaluate(trigger, null);
            expect(result).toBe('TwitchUser');
        });

        it('returns username if chatMessage.displayName is not present', async () => {
            const trigger = {
                ...baseTrigger,
                metadata: {
                    ...baseTrigger.metadata,
                    eventSource: { id: 'twitch', name: 'twitch' },
                    chatMessage: { displayName: undefined },
                    username: 'FallbackUser'
                }
            };
            const mockTwitchApi = {
                getDisplayName: jest.fn(),
                getClient: jest.fn(),
                channels: {},
                channelRewards: {},
                users: {}
                // Add any other required properties/methods if needed
            };
            const mockViewerDatabase = {
                getViewerByUsername: jest.fn().mockResolvedValue({ displayName: 'FallbackUser' })
            };
            const obj = new PlatformAwareUserDisplayNameVariable(mockTwitchApi as any, mockViewerDatabase as any);
            const result = await obj.evaluate(trigger, null);
            expect(result).toBe('FallbackUser');
        });

        it('prefers the viewer database entry', async () => {
            const trigger = {
                ...baseTrigger,
                metadata: {
                    ...baseTrigger.metadata,
                    eventSource: { id: 'twitch', name: 'twitch' },
                    chatMessage: { displayName: undefined },
                    username: 'theusername'
                }
            };
            const mockTwitchApi = {
                getDisplayName: jest.fn(),
                getClient: jest.fn(),
                channels: {},
                channelRewards: {},
                users: {}
                // Add any other required properties/methods if needed
            };
            const mockViewerDatabase = {
                getViewerByUsername: jest.fn().mockResolvedValue({ displayName: 'TheUserName' })
            };
            const obj = new PlatformAwareUserDisplayNameVariable(mockTwitchApi as any, mockViewerDatabase as any);
            const result = await obj.evaluate(trigger, null);
            expect(result).toBe('TheUserName');
        });

        it('falls back to the Twitch API', async () => {
            const trigger = {
                ...baseTrigger,
                metadata: {
                    ...baseTrigger.metadata,
                    eventSource: { id: 'twitch', name: 'twitch' },
                    chatMessage: { displayName: undefined },
                    username: 'theusername'
                }
            };
            const mockTwitchApi = {
                getDisplayName: jest.fn(),
                getClient: jest.fn(),
                channels: {},
                channelRewards: {},
                users: {
                    getUserByName: jest.fn().mockResolvedValue({ displayName: 'TheUserName' })
                }
            };
            const mockViewerDatabase = {
                getViewerByUsername: jest.fn()
            };
            const obj = new PlatformAwareUserDisplayNameVariable(mockTwitchApi as any, mockViewerDatabase as any);
            const result = await obj.evaluate(trigger, null);
            expect(result).toBe('TheUserName');
        });

        it('returns an error if the username could not be found', async () => {
            const trigger = {
                ...baseTrigger,
                metadata: {
                    ...baseTrigger.metadata,
                    eventSource: { id: 'twitch', name: 'twitch' },
                    chatMessage: { displayName: undefined },
                    username: ''
                }
            };

            const mockTwitchApi = {
                getDisplayName: jest.fn(),
                getClient: jest.fn(),
                channels: {},
                channelRewards: {},
                users: {
                    getUserByName: jest.fn()
                }
            };
            const mockViewerDatabase = {
                getViewerByUsername: jest.fn()
            };
            const obj = new PlatformAwareUserDisplayNameVariable(mockTwitchApi as any, mockViewerDatabase as any);
            const result = await obj.evaluate(trigger, 'ExplicitUser');
            expect(result).toBe('[No user found]');
        });

        it('returns appropriate string if no display name or username is available', async () => {
            const trigger = {
                ...baseTrigger,
                metadata: {
                    ...baseTrigger.metadata,
                    eventSource: { id: 'twitch', name: 'twitch' },
                    chatMessage: { displayName: undefined },
                    username: ''
                }
            };
            const result = await platformAwareUserDisplayNameVariable.evaluate(trigger, null);
            expect(result).toBe("[No username available]");
        });
    });
});
