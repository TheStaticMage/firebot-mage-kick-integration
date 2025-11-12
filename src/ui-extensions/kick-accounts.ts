import {
    AngularJsPage,
    UIExtension
} from "@crowbartools/firebot-custom-scripts-types/types/modules/ui-extension-manager";

const kickAccountsPage: AngularJsPage = {
    id: "kick-accounts",
    name: "Kick Accounts",
    controller: ($scope: any, backendCommunicator: any, $timeout: any) => {
        $scope.connections = {
            connected: false,
            streamer: {
                ready: false,
                status: "Authorization required",
                tokenExpiresAt: undefined
            },
            bot: {
                ready: false,
                status: "Authorization required",
                tokenExpiresAt: undefined
            }
        };

        $scope.showModal = false;
        $scope.modalTitle = "";
        $scope.authUrl = "";
        $scope.currentAuthType = null;
        let statusCheckInterval: any = null;
        let copyButtonTimeout: any = null;

        // Initialize - request current status
        backendCommunicator.fireEvent("kick:get-connections", {});

        // Listen for connection updates
        backendCommunicator.on("kick:connections-update", (data: any) => {
            $scope.connections = data;

            // Close modal if authorization completed
            if ($scope.currentAuthType && $scope.connections[$scope.currentAuthType].ready) {
                closeAuthModal();
            }
        });

        // Listen for streamer auth URL
        backendCommunicator.on("kick:streamer-auth-url", (url: string) => {
            $timeout(() => {
                showAuthModal("Authorize Streamer Connection", url);
                $scope.currentAuthType = "streamer";
            });
        });

        // Listen for bot auth URL
        backendCommunicator.on("kick:bot-auth-url", (url: string) => {
            $timeout(() => {
                showAuthModal("Authorize Bot Connection", url);
                $scope.currentAuthType = "bot";
            });
        });

        function showAuthModal(title: string, url: string) {
            $scope.modalTitle = title;
            $scope.authUrl = url;
            $scope.showModal = true;

            // Start polling for connection status updates while modal is open
            if (!statusCheckInterval) {
                statusCheckInterval = setInterval(() => {
                    backendCommunicator.fireEvent("kick:get-connections", {});
                }, 2000);
            }
        }

        function closeAuthModal() {
            $scope.showModal = false;
            $scope.currentAuthType = null;

            // Stop polling when modal is closed
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
                statusCheckInterval = null;
            }

            // Clear any pending button text reset timeout and reset button to original state
            if (copyButtonTimeout) {
                $timeout.cancel(copyButtonTimeout);
                copyButtonTimeout = null;
            }
            const copyButton = document.getElementById("btn-copy-url");
            if (copyButton) {
                copyButton.textContent = "Copy Link";
            }
        }

        $scope.closeModal = closeAuthModal;

        $scope.authorizeStreamer = () => {
            backendCommunicator.fireEventSync("kick:authorize-streamer", {});
        };

        $scope.deauthorizeStreamer = () => {
            if (confirm("Are you sure you want to deauthorize the streamer connection?")) {
                backendCommunicator.fireEvent("kick:deauthorize-streamer", {});
            }
        };

        $scope.authorizeBot = () => {
            backendCommunicator.fireEventSync("kick:authorize-bot", {});
        };

        $scope.deauthorizeBot = () => {
            if (confirm("Are you sure you want to deauthorize the bot connection?")) {
                backendCommunicator.fireEvent("kick:deauthorize-bot", {});
            }
        };

        $scope.copyUrl = () => {
            const url = $scope.authUrl;
            const originalText = "Copy Link";
            const copyButton = document.getElementById("btn-copy-url");

            // Ensure window has focus before attempting clipboard operation
            window.focus();

            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => {
                    if (copyButton) {
                        // Use $timeout to ensure Angular detects changes
                        $timeout(() => {
                            copyButton.textContent = "Copied!";
                        });
                        // Clear any existing timeout before setting a new one
                        if (copyButtonTimeout) {
                            $timeout.cancel(copyButtonTimeout);
                        }
                        copyButtonTimeout = $timeout(() => {
                            copyButton.textContent = originalText;
                            copyButtonTimeout = null;
                        }, 2000);
                    }
                }).catch(() => {
                    // Fallback: create a temporary textarea to copy the URL
                    // This is necessary after deauthorizing and then reauthorizing
                    const textarea = document.createElement('textarea');
                    textarea.value = url;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.focus();
                    textarea.select();
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-deprecated
                        document.execCommand('copy');
                        if (copyButton) {
                            $timeout(() => {
                                copyButton.textContent = "Copied!";
                            });
                            if (copyButtonTimeout) {
                                $timeout.cancel(copyButtonTimeout);
                            }
                            copyButtonTimeout = $timeout(() => {
                                copyButton.textContent = originalText;
                                copyButtonTimeout = null;
                            }, 2000);
                        }
                    } catch {
                        // Silently ignore if both methods fail
                    }
                    document.body.removeChild(textarea);
                });
            }
        };

        $scope.getStreamerStatusClass = () => {
            if (!$scope.connections.connected) {
                return "status-disconnected";
            }
            if ($scope.connections.streamer.ready) {
                return "status-ready";
            }
            if ($scope.connections.streamer.status === "Awaiting connection") {
                return "status-awaiting";
            }
            return "status-not-ready";
        };

        $scope.getStreamerStatusText = () => {
            if (!$scope.connections.connected) {
                return "Disconnected";
            }
            if ($scope.connections.streamer.ready) {
                return "Ready";
            }
            if ($scope.connections.streamer.status === "Awaiting connection") {
                return "Awaiting";
            }
            return "Not Ready";
        };

        $scope.getBotStatusClass = () => {
            if (!$scope.connections.connected) {
                return "status-disconnected";
            }
            if ($scope.connections.bot.ready) {
                return "status-ready";
            }
            if ($scope.connections.bot.status === "Awaiting connection") {
                return "status-awaiting";
            }
            return "status-not-ready";
        };

        $scope.getBotStatusText = () => {
            if (!$scope.connections.connected) {
                return "Disconnected";
            }
            if ($scope.connections.bot.ready) {
                return "Ready";
            }
            if ($scope.connections.bot.status === "Awaiting connection") {
                return "Awaiting";
            }
            return "Not Ready";
        };
    },
    type: "angularjs",
    icon: "fa-key",
    template: `
        <div class="kick-accounts-container">
            <!-- Streamer Connection Section -->
            <div class="connection-section">
                <div class="connection-header">
                    <div class="connection-title">Streamer Connection</div>
                    <div class="status-badge" ng-class="getStreamerStatusClass()">
                        {{ getStreamerStatusText() }}
                    </div>
                </div>

                <div class="status-message">
                    {{ connections.streamer.status }}
                </div>

                <div class="button-group">
                    <button class="btn btn-authorize" ng-click="authorizeStreamer()" ng-disabled="connections.streamer.tokenExpiresAt">
                        Authorize Streamer
                    </button>
                    <button class="btn btn-deauthorize" ng-click="deauthorizeStreamer()" ng-disabled="!connections.streamer.tokenExpiresAt">
                        Deauthorize
                    </button>
                </div>
            </div>

            <!-- Bot Connection Section -->
            <div class="connection-section">
                <div class="connection-header">
                    <div class="connection-title">Bot Connection</div>
                    <div class="status-badge" ng-class="getBotStatusClass()">
                        {{ getBotStatusText() }}
                    </div>
                </div>

                <div class="status-message">
                    {{ connections.bot.status }}
                </div>

                <div class="button-group">
                    <button class="btn btn-authorize" ng-click="authorizeBot()" ng-disabled="connections.bot.tokenExpiresAt">
                        Authorize Bot
                    </button>
                    <button class="btn btn-deauthorize" ng-click="deauthorizeBot()" ng-disabled="!connections.bot.tokenExpiresAt">
                        Deauthorize
                    </button>
                </div>
            </div>

            <!-- Authorization Modal -->
            <div class="auth-modal" ng-show="showModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>{{ modalTitle }}</h2>
                        <span class="close" ng-click="closeModal()">&times;</span>
                    </div>

                    <div class="auth-instructions">
                        <p><strong>To authorize your connection:</strong></p>
                        <ol>
                            <li>Sign in to the <span ng-show="currentAuthType === 'streamer'">streamer</span><span ng-show="currentAuthType === 'bot'">bot</span> account on kick.com in your browser</li>
                            <li>Click the "Copy Link" button below</li>
                            <li>Paste the link into your browser</li>
                            <li>Complete the authorization on Kick</li>
                            <li>This modal will close automatically when authorization is complete</li>
                        </ol>
                        <div class="auth-note" ng-show="currentAuthType === 'bot'">
                            <strong>Note:</strong> We recommend completing this authorization in an incognito window to avoid conflicts with your streamer account.
                        </div>
                    </div>

                    <div class="auth-url-container">
                        <div class="auth-url">{{ authUrl }}</div>
                        <button id="btn-copy-url" class="btn btn-copy" ng-click="copyUrl()">Copy Link</button>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .kick-accounts-container {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                padding: 20px;
            }

            .kick-accounts-container .connection-section {
                background: #f5f5f5;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
                border: 1px solid #ddd;
            }

            .kick-accounts-container .connection-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }

            .kick-accounts-container .connection-title {
                font-size: 18px;
                font-weight: bold;
                color: #333;
            }

            .kick-accounts-container .status-badge {
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
            }

            .kick-accounts-container .status-ready {
                background: #53fc18;
                color: #000;
            }

            .kick-accounts-container .status-not-ready {
                background: #dc3545;
                color: #fff;
            }

            .kick-accounts-container .status-awaiting {
                background: #ffc107;
                color: #000;
            }

            .kick-accounts-container .status-disconnected {
                background: #808080;
                color: #fff;
            }

            .kick-accounts-container .status-message {
                margin: 10px 0;
                padding: 10px;
                background: #fff;
                border-radius: 4px;
                font-size: 14px;
                color: #666;
            }

            .kick-accounts-container .button-group {
                display: flex;
                gap: 10px;
                margin-top: 15px;
            }

            .kick-accounts-container .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                transition: opacity 0.2s;
            }

            .kick-accounts-container .btn:hover:not(:disabled) {
                opacity: 0.8;
            }

            .kick-accounts-container .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .kick-accounts-container .btn-authorize {
                background: #53fc18;
                color: #000;
            }

            .kick-accounts-container .btn-deauthorize {
                background: #dc3545;
                color: #fff;
            }

            .kick-accounts-container .btn-copy {
                background: #007bff;
                color: #fff;
                padding: 10px 20px;
                white-space: nowrap;
            }

            .kick-accounts-container .auth-modal {
                display: block;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 1000;
                pointer-events: none;
            }

            .kick-accounts-container .modal-content {
                background: #f5f5f5;
                margin: 10% auto;
                padding: 30px;
                border-radius: 8px;
                max-width: 600px;
                border: 1px solid #ddd;
                color: #333;
                pointer-events: auto;
            }

            .kick-accounts-container .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }

            .kick-accounts-container .modal-header h2 {
                margin: 0;
                color: #333;
            }

            .kick-accounts-container .close {
                color: #aaa;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
            }

            .kick-accounts-container .close:hover {
                color: #000;
            }

            .kick-accounts-container .auth-instructions {
                margin: 20px 0;
                line-height: 1.6;
                color: #333;
            }

            .kick-accounts-container .auth-note {
                margin-top: 15px;
                padding: 10px;
                background: #e8f4f8;
                border-left: 4px solid #0084d6;
                border-radius: 4px;
                font-size: 13px;
                color: #333;
            }

            .kick-accounts-container .auth-url-container {
                display: flex;
                gap: 10px;
                margin: 20px 0;
            }

            .kick-accounts-container .auth-url {
                flex: 1;
                padding: 10px;
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 4px;
                color: #008000;
                word-break: break-all;
                font-family: monospace;
                font-size: 12px;
                max-height: 100px;
                overflow-y: auto;
            }
        </style>
    `
};

export const kickAccountsExtension: UIExtension = {
    id: "kick-accounts-extension",
    pages: [kickAccountsPage]
};
