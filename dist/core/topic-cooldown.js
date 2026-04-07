"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldDeepReadTopic = void 0;
const shouldDeepReadTopic = (lastDeepReadAt, cooldownMinutes, now) => {
    if (!lastDeepReadAt) {
        return true;
    }
    const diff = now.getTime() - new Date(lastDeepReadAt).getTime();
    return diff >= cooldownMinutes * 60 * 1000;
};
exports.shouldDeepReadTopic = shouldDeepReadTopic;
//# sourceMappingURL=topic-cooldown.js.map