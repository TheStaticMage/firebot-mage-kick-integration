import { AngularJsFactory } from "@crowbartools/firebot-custom-scripts-types/types/modules/ui-extension-manager";

export interface CopyToClipboardOptions {
    url: string;
    buttonId: string;
    $timeout: any;
    copyButtonTimeout: any;
    originalText?: string;
}

export interface CopyToClipboardResult {
    timeout: any;
}

export const kickUtilitiesService: AngularJsFactory = {
    name: "kickUtilitiesService",
    function: () => {
        return {
            normalizeManagementState: (rawState: any): Record<string, any> => {
                if (!rawState) {
                    return {};
                }

                let state = rawState;

                if (Array.isArray(rawState)) {
                    const stateObj: any = {};
                    rawState.forEach((item: any) => {
                        if (!item) {
                            return;
                        }
                        if (item.firebotRewardId) {
                            stateObj[item.firebotRewardId] = item;
                            return;
                        }
                        Object.keys(item).forEach((key) => {
                            stateObj[key] = item[key];
                        });
                    });
                    state = stateObj;
                }

                if (typeof state !== "object" || state === null) {
                    return {};
                }

                Object.keys(state).forEach((rewardId) => {
                    if (!state[rewardId].overrides) {
                        state[rewardId].overrides = {};
                    }
                });

                return state;
            },

            copyToClipboard: (options: CopyToClipboardOptions): CopyToClipboardResult => {
                const { url, buttonId, $timeout, copyButtonTimeout, originalText = "Copy Link" } = options;
                const copyButton = document.getElementById(buttonId);

                let newTimeout = copyButtonTimeout;

                window.focus();

                if (navigator.clipboard) {
                    navigator.clipboard.writeText(url).then(() => {
                        if (copyButton) {
                            $timeout(() => {
                                copyButton.textContent = "Copied!";
                            });
                            if (newTimeout) {
                                $timeout.cancel(newTimeout);
                            }
                            newTimeout = $timeout(() => {
                                copyButton.textContent = originalText;
                                newTimeout = null;
                            }, 2000);
                        }
                    }).catch(() => {
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
                                if (newTimeout) {
                                    $timeout.cancel(newTimeout);
                                }
                                newTimeout = $timeout(() => {
                                    copyButton.textContent = originalText;
                                    newTimeout = null;
                                }, 2000);
                            }
                        } catch {
                            // Silently ignore if both methods fail
                        }
                        document.body.removeChild(textarea);
                    });
                }

                return { timeout: newTimeout };
            }
        };
    }
};
