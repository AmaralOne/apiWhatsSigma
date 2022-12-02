const { Client, LocalAuth, MessageMedia, NoAuth } = require('whatsapp-web.js');
const fs = require('fs');
const ini = require('ini');
const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const mime = require('mime-types');
const port = process.env.PORT || config.port;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);


app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({
  limit: '50mb',
  parameterLimit:50000,
extended: true
}));
app.use(fileUpload({
debug: true
}));
app.use("/", express.static(__dirname + "/"))

app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: __dirname
  });
});

//const client = new Client({
  //authStrategy: new LocalAuth({ clientId: config.clientName }),
//});

//const client = new Client();

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'bot-zdg' }),
  puppeteer: { headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ] }
});



//const client = new Client({
 // authStrategy: new NoAuth()
//});


client.initialize();

client.on('qr', (qr) => {
  console.log('QR RECEIVED', qr);
});

io.on('connection', function(socket) {
  socket.emit('message', '© BOT-SIGMA - Iniciado');
  socket.emit('qr', './logo_sigma.png');
  console.log("nomeclient:",config.clientName)


client.on('qr', (qr) => {
  console.log('Qr:',qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', '© BOT-SIGMA QRCode recebido, aponte a câmera  seu celular!');
    });
  
});

client.on('ready', () => {
    socket.emit('ready', '© BOT-SIGMA Dispositivo pronto!');
    socket.emit('message', '© BOT-SIGMA Dispositivo pronto!');
    socket.emit('qr', './check.svg')	
    console.log('© BOT-SIGMA Dispositivo pronto');
});

client.on('authenticated', () => {
    socket.emit('authenticated', '© BOT-SIGMA Autenticado!');
    socket.emit('message', '© BOT-SIGMA Autenticado!');
    console.log('© BOT-SIGMA Autenticado');
});

client.on('auth_failure', function() {
    socket.emit('message', '© BOT-SIGMA Falha na autenticação, reiniciando...');
    console.error('© BOT-SIGMA Falha na autenticação');
});

client.on('change_state', state => {
  console.log('© BOT-SIGMA Status de conexão: ', state );
});

client.on('disconnected', (reason) => {
  socket.emit('message', '© BOT-ZDG Cliente desconectado!');
  console.log('© BOT-SIGMA Cliente desconectado', reason);
  config.clientName = "SigmaBot"+new Date().getTime();
  fs.writeFileSync('./config.ini', ini.stringify(config))
  socket.emit('qr', './logo_sigma.png');
  client.initialize();
  //client.destroy();

});

});




app.get('/state', async(req, res) => {

  client.getState().then(response => {
    res.status(200).json({
      response: response
    });
    }).catch(err => {
    res.status(500).json({
        response: err.text
    });
    });

});

// Send message
app.post('/zdg-message', [
  body('number').notEmpty(),
  body('message').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message1: errors.mapped()
    });
  }

  const number = req.body.number;
  const numberDDI = number.substr(0, 2);
  const numberDDD = number.substr(2, 2);
  const numberUser = number.substr(-8, 8);
  const message = req.body.message;

  if (numberDDI !== "55") {
    const numberZDG = number + "@c.us";
    client.sendMessage(numberZDG, message).then(response => {
    res.status(200).json({
      status: true,
      message: 'BOT-SIGMA Mensagem enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'BOT-SIGMA Mensagem não enviada. Verifique se seu número do celular está sincronizado com Api.',
      response: err.text
    });
    });
  }
  else if (numberDDI === "55" && parseInt(numberDDD) <= 30) {
    const numberZDG = "55" + numberDDD + "9" + numberUser + "@c.us";
    client.sendMessage(numberZDG, message).then(response => {
    res.status(200).json({
      status: true,
      message: 'BOT-SIGMA Mensagem enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'BOT-SIGMA Mensagem não enviada. Verifique se seu número do celular está sincronizado com Api.',
      response: err.text
    });
    });
  }
  else if (numberDDI === "55" && parseInt(numberDDD) > 30) {
    const numberZDG = "55" + numberDDD + numberUser + "@c.us";
    client.sendMessage(numberZDG, message).then(response => {
    res.status(200).json({
      status: true,
      message: 'BOT-SIGMA Mensagem enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'BOT-SIGMA Mensagem não enviada. Verifique se seu número do celular está sincronizado com Api.',
      response: err.text
    });
    });
  }
});


// Send media
app.post('/zdg-media', [
  body('number').notEmpty(),
  body('caption').notEmpty(),
  body('file').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = req.body.number;
  const numberDDI = number.substr(0, 2);
  const numberDDD = number.substr(2, 2);
  const numberUser = number.substr(-8, 8);
  const caption = req.body.caption;
  const fileUrl = req.body.file;

  let mimetype;
  const attachment = await axios.get(fileUrl, {
    responseType: 'arraybuffer'
  }).then(response => {
    mimetype = response.headers['content-type'];
    return response.data.toString('base64');
  });

  const media = new MessageMedia(mimetype, attachment, 'Media');

  if (numberDDI !== "55") {
    const numberZDG = number + "@c.us";
    client.sendMessage(numberZDG, media, {caption: caption}).then(response => {
    res.status(200).json({
      status: true,
      message: 'BOT-SIGMA Mídia enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'BOT-SIGMA Mídia não enviada. Verifique se seu número do celular está sincronizado com Api.',
      response: err.text
    });
    });
  }
  else if (numberDDI === "55" && parseInt(numberDDD) <= 30) {
    const numberZDG = "55" + numberDDD + "9" + numberUser + "@c.us";
    client.sendMessage(numberZDG, media, {caption: caption}).then(response => {
    res.status(200).json({
      status: true,
      message: 'BOT-SIGMA Mídia enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'BOT-SIGMA Mídia não enviada. Verifique se seu número do celular está sincronizado com Api.',
      response: err.text
    });
    });
  }
  else if (numberDDI === "55" && parseInt(numberDDD) > 30) {
    const numberZDG = "55" + numberDDD + numberUser + "@c.us";
    client.sendMessage(numberZDG, media, {caption: caption}).then(response => {
    res.status(200).json({
      status: true,
      message: 'BOT-SIGMA Mídia enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'BOT-SIGMA Mídia não enviada. Verifique se seu número do celular está sincronizado com Api.',
      response: err.text
    });
    });
  }
});


// Send media
app.post('/zdg-media-image', [
  body('number').notEmpty(),
  body('caption').notEmpty(),
  body('file').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = req.body.number;
  const numberDDI = number.substr(0, 2);
  const numberDDD = number.substr(2, 2);
  const numberUser = number.substr(-8, 8);
  const caption = req.body.caption;
  const filebase64 = req.body.file;



  const media = new MessageMedia('image', filebase64, 'Media');

  if (numberDDI !== "55") {
    const numberZDG = number + "@c.us";
    client.sendMessage(numberZDG, media, {caption: caption}).then(response => {
    res.status(200).json({
      status: true,
      message: 'BOT-SIGMA Imagem enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'BOT-SIGMA Imagem não enviada. Verifique se seu número do celular está sincronizado com Api.',
      response: err.text
    });
    });
  }
  else if (numberDDI === "55" && parseInt(numberDDD) <= 30) {
    const numberZDG = "55" + numberDDD + "9" + numberUser + "@c.us";
    client.sendMessage(numberZDG, media, {caption: caption}).then(response => {
    res.status(200).json({
      status: true,
      message: 'BOT-SIGMA Imagem enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'BOT-SIGMA Imagem não enviada. Verifique se seu número do celular está sincronizado com Api.',
      response: err.text
    });
    });
  }
  else if (numberDDI === "55" && parseInt(numberDDD) > 30) {
    const numberZDG = "55" + numberDDD + numberUser + "@c.us";
    client.sendMessage(numberZDG, media, {caption: caption}).then(response => {
    res.status(200).json({
      status: true,
      message: 'BOT-SIGMA Imagem enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'BOT-SIGMA Imagem não enviada. Verifique se seu número do celular está sincronizado com Api.',
      response: err.text
    });
    });
  }
});



// Send media
app.post('/zdg-media-pdf', [
  body('number').notEmpty(),
  body('caption').notEmpty(),
  body('file').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = req.body.number;
  const numberDDI = number.substr(0, 2);
  const numberDDD = number.substr(2, 2);
  const numberUser = number.substr(-8, 8);
  const caption = req.body.caption;
  const filebase64 = req.body.file;



  const media = new MessageMedia('application/pdf', filebase64, 'Pdf');

  if (numberDDI !== "55") {
    const numberZDG = number + "@c.us";
    client.sendMessage(numberZDG, media, {caption: caption}).then(response => {
    res.status(200).json({
      status: true,
      message: 'BOT-SIGMA PDF enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'BOT-SIGMA PDF não enviado. Verifique se seu número do celular está sincronizado com Api.',
      response: err.text
    });
    });
  }
  else if (numberDDI === "55" && parseInt(numberDDD) <= 30) {
    const numberZDG = "55" + numberDDD + "9" + numberUser + "@c.us";
    client.sendMessage(numberZDG, media, {caption: caption}).then(response => {
    res.status(200).json({
      status: true,
      message: 'BOT-SIGMA PDF enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'BOT-SIGMA PDF não enviado. Verifique se seu número do celular está sincronizado com Api.',
      response: err.text
    });
    });
  }
  else if (numberDDI === "55" && parseInt(numberDDD) > 30) {
    const numberZDG = "55" + numberDDD + numberUser + "@c.us";
    client.sendMessage(numberZDG, media, {caption: caption}).then(response => {
    res.status(200).json({
      status: true,
      message: 'BOT-SIGMA PDF enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'BOT-SIGMA PDF não enviado. Verifique se seu número do celular está sincronizado com Api.',
      response: err.text
    });
    });
  }
});

client.on('message', async msg => {
  if(msg.type.toLowerCase()== "e2e_notification") return null;
  if(msg.body === "") return null;

  const nomecontato = msg._data.notifyName;
  const user = msg.from.replace(/\D/g,'');
  const hoje = new Date();

   if (msg.body !== null && msg.body === "Oi") {
    const saudacaoes = ["😁 Olá, tudo bem "+nomecontato+"?","Oi "+nomecontato+", como vai você?","Opa "+nomecontato+", tudo bem?"]
    const saudacao = saudacaoes[Math.floor(Math.random()*saudacaoes.length)]
    msg.reply(saudacao);
	}
});

    
server.listen(port, function() {
        console.log('App running on *: ' + port);
});
