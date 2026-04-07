"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortTopicRows = void 0;
const getPrimaryTime = (row) => {
    const reference = row.status === "WAITING" && row.startAt ? row.startAt : row.discoveredAt;
    return new Date(reference).getTime();
};
const sortTopicRows = (rows) => [...rows].sort((left, right) => {
    const primaryDelta = getPrimaryTime(right) - getPrimaryTime(left);
    if (primaryDelta !== 0) {
        return primaryDelta;
    }
    if (left.status === "WAITING" && right.status !== "WAITING") {
        return -1;
    }
    if (left.status !== "WAITING" && right.status === "WAITING") {
        return 1;
    }
    if (left.isNew !== right.isNew) {
        return left.isNew ? -1 : 1;
    }
    return right.topicId - left.topicId;
});
exports.sortTopicRows = sortTopicRows;
//# sourceMappingURL=topic-row-sort.js.map