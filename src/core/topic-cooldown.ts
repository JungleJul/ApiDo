export const shouldDeepReadTopic = (
  lastDeepReadAt: string | null,
  cooldownMinutes: number,
  now: Date
): boolean => {
  if (!lastDeepReadAt) {
    return true;
  }

  const diff = now.getTime() - new Date(lastDeepReadAt).getTime();
  return diff >= cooldownMinutes * 60 * 1000;
};
