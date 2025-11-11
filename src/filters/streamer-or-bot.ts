import { EventData, EventFilter, FilterEvent, FilterSettings, PresetValue } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { unkickifyUsername } from "../internal/util";
import { firebot, logger } from "../main";
import { platformVariable } from "../variables/platform";
import { ComparisonType } from "./common";

const events: string[] = [
    "chat-message",
    "follow",
    "viewer-arrived",
    "banned",
    "timeout",
    "raid"
];

const applicableEvents: FilterEvent[] = [
    ...events.map(eventId => ({
        eventSourceId: "twitch",
        eventId
    })),
    ...events.map(eventId => ({
        eventSourceId: IntegrationConstants.INTEGRATION_ID,
        eventId
    }))
];

export const streamerOrBotFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:streamer-or-bot`,
    name: "User",
    description: "Checks if the user triggering the event is the streamer and/or stream bot. (Works on both Twitch and Kick events.)",
    events: applicableEvents,
    comparisonTypes: [
        ComparisonType.IS,
        ComparisonType.IS_NOT
    ],
    valueType: "preset",
    getSelectedValueDisplay: (filterSettings: FilterSettings): string => {
        const presetValues: PresetValue[] = [
            { value: "streamer", display: "Streamer" },
            { value: "bot", display: "Stream Bot" },
            { value: "either", display: "Streamer or Stream Bot" }
        ];
        return presetValues.find(pv => pv.value === String(filterSettings.value))?.display ?? `??? (${String(filterSettings.value)})`;
    },
    valueIsStillValid: (filterSettings: FilterSettings): boolean => {
        return ["streamer", "bot", "either"].includes(String(filterSettings.value));
    },
    presetValues(): PresetValue[] {
        return [
            { value: "streamer", display: "Streamer" },
            { value: "bot", display: "Stream Bot" },
            { value: "either", display: "Streamer or Stream Bot" }
        ];
    },
    predicate: async (
        filterSettings,
        eventData: EventData
    ): Promise<boolean> => {
        const { comparisonType, value } = filterSettings;
        const trigger: Trigger = {
            type: "event",
            metadata: {
                eventSource: { id: eventData.eventSourceId, name: eventData.eventSourceId },
                eventData: eventData.eventMeta,
                username: typeof eventData.eventMeta.username === "string" ? eventData.eventMeta.username : ""
            }
        };

        const platform = platformVariable.evaluator(trigger);
        let username = "";
        const checkName: string[] = [];

        if (platform === "kick") {
            const kickStreamer = integration.kick.broadcaster?.name;
            const kickBot = integration.kick.bot?.name ?? "";
            username = unkickifyUsername(trigger.metadata.username).toLowerCase();
            switch (value) {
                case "streamer":
                    checkName.push(unkickifyUsername(kickStreamer).toLowerCase());
                    break;
                case "bot":
                    checkName.push(unkickifyUsername(kickBot).toLowerCase());
                    break;
                case "either":
                    checkName.push(unkickifyUsername(kickStreamer).toLowerCase());
                    checkName.push(unkickifyUsername(kickBot).toLowerCase());
                    break;
            }
        } else if (platform === "twitch") {
            const twitchStreamer = firebot.firebot.accounts.streamer.username;
            const twitchBot = firebot.firebot.accounts.bot.username;
            username = trigger.metadata.username.toLowerCase();
            switch (value) {
                case "streamer":
                    checkName.push(twitchStreamer.toLowerCase());
                    break;
                case "bot":
                    checkName.push(twitchBot.toLowerCase());
                    break;
                case "either":
                    checkName.push(twitchStreamer.toLowerCase());
                    checkName.push(twitchBot.toLowerCase());
                    break;
            }
        } else {
            logger.debug(`streamerOrBotFilter: Unknown platform: ${JSON.stringify(trigger)}`);
            return (comparisonType === ComparisonType.IS as any) ? false : true;
        }

        if (username === '') {
            logger.debug(`streamerOrBotFilter: No username found in trigger metadata: ${JSON.stringify(trigger)}`);
            return (comparisonType === ComparisonType.IS as any) ? false : true;
        }

        let match = false;
        for (const name of checkName) {
            match ||= name === username;
        }

        logger.debug(`streamerOrBotFilter: ${match ? "match" : "no match"} found for username=${username} value=${value}`);
        return (comparisonType === ComparisonType.IS as any) ? match : !match;
    }
};
