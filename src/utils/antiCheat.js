
const detectTabChange = () => {
  let isTabActive = true;
  
  document.addEventListener('visibilitychange', () => {
    isTabActive = !document.hidden;
    if (!isTabActive) {
      return { type: 'tab-change', timestamp: new Date() };
    }
  });
  
  return isTabActive;
};

const detectFullscreenExit = () => {
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      return { type: 'fullscreen-exit', timestamp: new Date() };
    }
  });
};

const monitorCamera = (videoElement) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  setInterval(() => {
    if (videoElement && videoElement.videoWidth > 0) {
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      ctx.drawImage(videoElement, 0, 0);
      
    }
  }, 1000);
  
  return {
    start: () => console.log('Camera monitoring started'),
    stop: () => console.log('Camera monitoring stopped')
  };
};

const logSuspiciousActivity = (activity) => {
  return {
    type: activity.type,
    timestamp: activity.timestamp || new Date(),
    details: activity.details || {}
  };
};

module.exports = {
  detectTabChange,
  detectFullscreenExit,
  monitorCamera,
  logSuspiciousActivity
}