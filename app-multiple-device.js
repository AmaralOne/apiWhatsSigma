const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const axios = require('axios');
const port = process.env.PORT || 8000;
const fileUpload = require('express-fileupload');
const { body, validationResult } = require('express-validator');
const { engine } = require ('express-handlebars');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.engine('handlebars', engine({
  defaultLayout: 'main',
  runtimeOptions: {
      allowProtoPropertiesByDefault: true,

      allowProtoMethodsByDefault: true,
  }
}));
app.set('view engine', 'handlebars');
app.set("views", "./views");

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
  res.sendFile('inicio.html', {
    root: __dirname
  });
});
app.get('/Painel/', (req, res) => {

  let token = req.query.token;

  if(token !== "sigmaMestre") {
    res.send(`Acesso não Autorizado!!!`)
  }
  res.sendFile('index-multiple-account.html', {
    root: __dirname
  });
});





const sessions = [];
const SESSIONS_FILE = './whatsapp-sessions.json';

const createSessionsFileIfNotExists = function() {
  if (!fs.existsSync(SESSIONS_FILE)) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      console.log('Sessions file created successfully.');
    } catch(err) {
      console.log('Failed to create sessions file: ', err);
    }
  }
}

createSessionsFileIfNotExists();

const setSessionsFile = function(sessions) {
  fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function(err) {
    if (err) {
      console.log(err);
    }
  });
}

const getSessionsFile = function() {
  return JSON.parse(fs.readFileSync(SESSIONS_FILE));
}

const createSession = function(id, description) {
  console.log('Creating session: ' + id);
  const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
      ],
    },
    authStrategy: new LocalAuth({
      clientId: id
    })
  });

  client.initialize();

  client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      io.emit('qr', { id: id, src: url });
      io.emit('message', { id: id, text: '© BOT-SIGMA QRCode recebido, aponte a câmera  seu celular!' });
    });
  });

  client.on('ready', () => {
    io.emit('ready', { id: id });
    io.emit('message', { id: id, text: '© BOT-SIGMA Dispositivo pronto!' });

    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions[sessionIndex].ready = true;
    setSessionsFile(savedSessions);
  });

  client.on('authenticated', () => {
    io.emit('authenticated', { id: id });
    io.emit('message', { id: id, text: '© BOT-SIGMA Autenticado' });
  });

  client.on('auth_failure', function() {
    io.emit('message', { id: id, text: '© BOT-SIGMA Falha na autenticação, reiniciando...' });
  });

  client.on('disconnected', (reason) => {
    io.emit('message', { id: id, text: 'Whatsapp is disconnected!' });
    client.destroy();
    client.initialize();

    // Menghapus pada file sessions
    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions.splice(sessionIndex, 1);
    setSessionsFile(savedSessions);

    io.emit('remove-session', id);
  });

  // Tambahkan client ke sessions
  sessions.push({
    id: id,
    description: description,
    client: client
  });

  // Menambahkan session ke file
  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex(sess => sess.id == id);

  if (sessionIndex == -1) {
    savedSessions.push({
      id: id,
      description: description,
      ready: false,
    });
    setSessionsFile(savedSessions);
  }
}

const init = function(socket) {
  const savedSessions = getSessionsFile();

  if (savedSessions.length > 0) {
    if (socket) {
      socket.emit('init', savedSessions);
    } else {
      savedSessions.forEach(sess => {
        createSession(sess.id, sess.description);
      });
    }
  }
}

init();

// Socket IO
io.on('connection', function(socket) {
  init(socket);

  socket.on('create-session', function(data) {
    console.log('Create session: ' + data.id);
    createSession(data.id, data.description);
  });
});

app.post('/criar-sessao', 
 async (req, res) => {
       
        const id = req.body.id;
        const token = req.body.token;

        try{
            createSession(id, token);
            res.status(200).json({
                status:true, message:'bot sessão criada '+id+' - Token: '+token
            })
        }catch(err){
            console.log(err)
            res.status(500).json({
                status:false, 
                message:'Bot Sessão não foi criada'
            })
        }
    });

    app.post('/deletar-sessao', 
    async (req, res) => {
          
           const id = req.body.id;
           const token = req.body.token;
           const client = sessions.find(sess => sess.id === id)?.client;
           const savedSessions = getSessionsFile();
           const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
           const tokenN = savedSessions.splice(sessionIndex, 1)[0].description;

           if(tokenN !== token){
            res.status(422).json({
                status:false,
                message: 'Bot Token inválido'
            })

            return;
           }
   
           try{
                client.destroy();
                client.initialize();
                const savedSessions = getSessionsFile();
                const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
                savedSessions.splice(sessionIndex, 1);
                setSessionsFile(savedSessions);

                res.status(200).json({
                    status:true, message:'bot sessão deletada '+id
                })

           }catch(err){
               console.log(err)
               res.status(500).json({
                   status:false, 
                   message:'Bot Sessão não foi deletada'
               })
           }
       });

       app.post('/status-sessao', 
       async (req, res) => {
             
              const id = req.body.id;
              const token = req.body.token;
              const client = sessions.find(sess => sess.id === id)?.client;
              const savedSessions = getSessionsFile();
              const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
              const tokenN = savedSessions.splice(sessionIndex, 1)[0].description;
   
              if(tokenN !== token){
               res.status(422).json({
                   status:false,
                   message: 'Bot Token inválido'
               })
   
               return;
              }
      
              try{
                   const status = await client.getState();
                   
   
                   res.status(200).json({
                       status:true, message:'bot sessão status: '+status
                   })
   
              }catch(err){
                  console.log(err)
                  res.status(500).json({
                      status:false, 
                      message:'Bot Sessão não pode informar status'
                  })
              }
          });

          app.get("/Sessao/",function(req,res){
            let id = req.query.id;
            let token = req.query.token;

            const client = sessions.find(sess => sess.id == id)?.client;

            // Make sure the sender is exists & ready
            if (!client) {
              res.send(`Acesso não Autorizado!!!`)
            }

            const savedSessions = getSessionsFile();
            const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
            const tokenN = savedSessions.splice(sessionIndex, 1)[0].description;

            if(tokenN !== token){
              res.send(`Acesso não Autorizado!!!`)
            }
          
            res.render('home',{id:id, token:token});
            //res.sendFile(__dirname+'\\index-multiple-account copy.html')
          })          
// Send message
app.post('/send-message',  [
  body('sender').notEmpty(),
  body('number').notEmpty(),
  body('message').notEmpty(),
  body('token').notEmpty(),
], async (req, res) => {
  const sender = req.body.sender;
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;
  const token = req.body.token

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

  const client = sessions.find(sess => sess.id == sender)?.client;

  // Make sure the sender is exists & ready
  if (!client) {
    return res.status(422).json({
      status: false,
      message: `The sender: ${sender} is not found!`
    })
  }

  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex(sess => sess.id == sender);
  const tokenN = savedSessions.splice(sessionIndex, 1)[0].description;

  if(tokenN !== token){
   res.status(422).json({
       status:false,
       message: 'Bot Token inválido'
   })

   return;
  }

  /**
   * Check if the number is already registered
   * Copied from app.js
   * 
   * Please check app.js for more validations example
   * You can add the same here!
   */
  const isRegisteredNumber = await client.isRegisteredUser(number);

  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: 'The number is not registered'
    });
  }

  client.sendMessage(number, message).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

// Send message
app.post('/zdg-message', [
  body('sender').notEmpty(),
  body('number').notEmpty(),
  body('message').notEmpty(),
  body('token').notEmpty(),
], async (req, res) => {

  const sender = req.body.sender;
  const token = req.body.token
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

  const client = sessions.find(sess => sess.id == sender)?.client;

  // Make sure the sender is exists & ready
  if (!client) {
    return res.status(422).json({
      status: false,
      message: `A sessão: ${sender} não foi Encontrado!`
    })
  }

  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex(sess => sess.id == sender);
  const tokenN = savedSessions.splice(sessionIndex, 1)[0].description;

  if(tokenN !== token){
   res.status(422).json({
       status:false,
       message: 'Bot Token inválido'
   })

   return;
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
app.post('/zdg-media-imagem', [
  body('sender').notEmpty(),
  body('number').notEmpty(),
  body('caption').notEmpty(),
  body('file').notEmpty(),
  body('token').notEmpty(),
], async (req, res) => {
  const sender = req.body.sender;
  const token = req.body.token
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

  const client = sessions.find(sess => sess.id == sender)?.client;

  // Make sure the sender is exists & ready
  if (!client) {
    return res.status(422).json({
      status: false,
      message: `A sessão: ${sender} não foi Encontrado!`
    })
  }

  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex(sess => sess.id == sender);
  const tokenN = savedSessions.splice(sessionIndex, 1)[0].description;

  if(tokenN !== token){
   res.status(422).json({
       status:false,
       message: 'Bot Token inválido'
   })

   return;
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
  body('sender').notEmpty(),
  body('number').notEmpty(),
  body('caption').notEmpty(),
  body('file').notEmpty(),
  body('token').notEmpty(),
], async (req, res) => {
  const sender = req.body.sender;
  const token = req.body.token
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

  const client = sessions.find(sess => sess.id == sender)?.client;

  // Make sure the sender is exists & ready
  if (!client) {
    return res.status(422).json({
      status: false,
      message: `A sessão: ${sender} não foi Encontrado!`
    })
  }

  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex(sess => sess.id == sender);
  const tokenN = savedSessions.splice(sessionIndex, 1)[0].description;

  if(tokenN !== token){
   res.status(422).json({
       status:false,
       message: 'Bot Token inválido'
   })

   return;
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


server.listen(port, function() {
  console.log('App running on *: ' + port);
});