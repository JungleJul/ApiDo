export const isTopicNew = (publishedAt: string | null, now: Date = new Date()): boolean => {
  if (!publishedAt) {
    return false;
  }

  return now.getTime() - new Date(publishedAt).getTime() <= 60 * 60 * 1000;
};

export const delay = async (milliseconds: number): Promise<void> => {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};
