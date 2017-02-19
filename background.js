chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('index.html', {
    id: 'main',
    outerBounds: { width: 600, height: 800 }
  });

});
