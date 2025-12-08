import { firebot, logger } from "../main";
import { KickRewardManagementData, KickRewardsManagementState } from "../shared/types";
import { getDataFilePath } from "../util/datafile";

export class KickRewardsState {
    private managementState: KickRewardsManagementState = {};
    private readonly filename = "kick-rewards-management.json";

    loadManagementState(): void {
        const { fs } = firebot.modules;
        const filePath = getDataFilePath(this.filename);

        if (!fs.existsSync(filePath)) {
            logger.debug(`Kick rewards management state file not found at ${filePath}. Initializing empty state.`);
            this.managementState = {};
            return;
        }

        try {
            const data = fs.readFileSync(filePath, "utf-8");
            this.managementState = JSON.parse(data);
            logger.debug(`Loaded Kick rewards management state: ${Object.keys(this.managementState).length} rewards managed`);
        } catch (error) {
            logger.error(`Failed to load Kick rewards management state: ${error}`);
            this.managementState = {};
        }
    }

    saveManagementState(): void {
        const { fs } = firebot.modules;
        const filePath = getDataFilePath(this.filename);

        try {
            fs.writeFileSync(filePath, JSON.stringify(this.managementState, null, 2));
        } catch (error) {
            logger.error(`Failed to save Kick rewards management state: ${error}`);
        }
    }

    getManagementData(firebotRewardId: string): KickRewardManagementData | undefined {
        return this.managementState[firebotRewardId];
    }

    setManagementData(firebotRewardId: string, data: KickRewardManagementData): void {
        this.managementState[firebotRewardId] = data;
        this.saveManagementState();
    }

    removeManagementData(firebotRewardId: string): void {
        if (this.managementState[firebotRewardId]) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete this.managementState[firebotRewardId];
            this.saveManagementState();
        }
    }

    getManagedCount(): number {
        return Object.values(this.managementState).filter(data => data.managedOnKick).length;
    }

    async canManageMore(getTotalKickRewards: () => Promise<number>): Promise<boolean> {
        // Kick has a limit of 15 custom rewards
        const totalKickRewards = await getTotalKickRewards();
        return totalKickRewards < 15;
    }

    getAllManagementData(): KickRewardsManagementState {
        return { ...this.managementState };
    }

    clearState(): void {
        this.managementState = {};
    }
}
