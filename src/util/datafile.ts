import { IntegrationConstants } from "../constants";
import { firebot } from "../main";
declare const SCRIPTS_DIR: string; // Old method for compatibility

export function getDataFilePath(filename: string): string {
    const { fs, path } = firebot.modules;
    const filepath = `script-data/${IntegrationConstants.INTEGRATION_URI}/${filename}`; // Old path for compatibility
    let result = "";

    try {
        // Requires a version of Firebot that exposes the script directory.
        // See https://github.com/crowbartools/Firebot/issues/3180
        const { path, scriptDataDir } = firebot.modules;
        result = path.join(scriptDataDir, filename);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        // Fall back to the legacy method, compatible with older versions of Firebot.
        const profileDirectory = path.join(SCRIPTS_DIR, '..');
        const pathSplit = filepath.split('/');
        result = path.join(profileDirectory, ...pathSplit);
    }

    const dir = path.dirname(result);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return result;
}
