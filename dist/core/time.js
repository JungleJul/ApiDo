"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay = exports.isTopicNew = void 0;
const isTopicNew = (publishedAt, now = new Date()) => {
    if (!publishedAt) {
        return false;
    }
    return now.getTime() - new Date(publishedAt).getTime() <= 60 * 60 * 1000;
};
exports.isTopicNew = isTopicNew;
const delay = async (milliseconds) => {
    if (milliseconds <= 0) {
        return;
    }
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
};
exports.delay = delay;
//# sourceMappingURL=time.js.map