// @ts-expect-error - Raw file import handled by webpack
import templateHtml from "./templates/kick-main.html";
// @ts-expect-error - Raw file import handled by webpack
import stylesCss from "./templates/kick-styles.css";

export const loadTemplate = (): string => {
    return `${templateHtml}\n\n<style>\n${stylesCss}\n</style>`;
};
