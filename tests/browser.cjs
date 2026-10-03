exports.launchOptions = () => {
  const requested = process.env.CRAWLER_BROWSER_CHANNEL;
  const channel = requested === 'bundled' ? null : requested || (process.platform === 'win32' ? 'msedge' : null);
  return { headless: true, ...(channel ? { channel } : {}) };
};
