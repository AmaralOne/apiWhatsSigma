var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name:'Bot WhatsApp Sigma Sistemas',
  description: 'Bot WhatsApp Sigma',
  script: 'app-multiple-device.js'
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
  svc.start();
});

svc.install();