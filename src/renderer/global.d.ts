export {};

declare global {
  interface Window {
    monitorApi: {
      getSnapshot: () => Promise<any>;
      onSnapshot: (listener: (snapshot: any) => void) => () => void;
      openTopic: (topicId: number) => Promise<void>;
      openCdk: (topicId: number) => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      openDebugDirectory: () => Promise<void>;
      openDebugLog: () => Promise<void>;
      triggerRescan: () => Promise<void>;
      retryClaim: (topicId: number) => Promise<void>;
      openLoginWindow: () => Promise<void>;
      confirmLogin: () => Promise<void>;
      reinitializeBrowser: () => Promise<void>;
      updateSettings: (config: Record<string, unknown>) => Promise<any>;
    };
  }
}
