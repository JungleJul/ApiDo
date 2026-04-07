import type { TopicRow } from "../shared/types";

const getPrimaryTime = (row: TopicRow): number => {
  const reference = row.status === "WAITING" && row.startAt ? row.startAt : row.discoveredAt;
  return new Date(reference).getTime();
};

export const sortTopicRows = (rows: TopicRow[]): TopicRow[] =>
  [...rows].sort((left, right) => {
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
