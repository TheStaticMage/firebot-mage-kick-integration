import fs from "fs";
import path from "path";

import { firebot } from "../main";

export function getDataFilePath(filename: string): string {
    const { scriptDataDir } = firebot;
    if (!fs.existsSync(scriptDataDir)) {
        fs.mkdirSync(scriptDataDir, { recursive: true });
    }

    return path.join(scriptDataDir, filename);
}
