const path = require('path');
const express = require('express');
const pug = require('pug');
const bodyParser = require('body-parser');
const moment = require('moment');
const crypto = require('crypto');
const base64url = require('base64-url');

const pjson = require('./package.json');
var program = require('commander');

const app = express();

var options = {
	port: 3000,
	host: "127.0.0.1",
	url: ""
};

program.version(pjson.version)
	.option('-p, --port <3000>', 'Port to host')
	.option('-H, --host <127.0.0.1>', "Ip to host")
	.option('-u, --url <path>', 'If this parameter is blank, will be use random id as url path');

program.on('--help', function() {
	console.log('  Examples:');
	console.log('');
	console.log('    $ npm start -- -p 80');
	console.log('    $ npm start -- -p 8080 -u notification');
	console.log('');
});

program.parse(process.argv);

Object.keys(options)
	.forEach(function(key) {
		options[key] = program[key] || options[key];
	});

const host = options.host;
const port = options.port;

app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', 'pug')

function log(message) {
	console.log(moment().format() + ': ' + message);
}

function generateID() {
	if(!options.url){
		const bytes = crypto.randomBytes(30);
		const string = base64url.encode(bytes);
		return string.substring(0, 8);
	}
	return options.url;
}

app.use('/', express.static(path.join(__dirname, 'public')));
app.get('/*', (req, res) => {
	res.render('index', { secureID: generateID() })
});

app.post('*', (req, res) => {
	let id = req.path.substring(1, 20); // Ignore first, truncate after 20
	let data = Object.keys(req.body)[0];

	if (data && data.substring(0,2) === 'd:') {
		if (io.sockets.adapter.rooms[id]) {
			let message = data.substring(2);

			log('[NOTICA] Message sent to ' + id + ': ' + message);

			io.in(id).emit('message', message);

			res.end();
		} else {
			log('No one in room to send data to: ' + id);
			res.send('No devices have that Notica ID open. Please open this URL: https://notica.us/' + id + '\n');
		}
	} else {
		log('Ignoring bad POST data to: ' + id);
		res.send('Bad POST data. Expecting prefix of "d:".\n');
	}
});

const server = app.listen(port, host, (err) => {
	if (err) {
		log('[ERROR] Server error: ' + err);
		return;
	}
	console.info('==> Listening on port %s. Open up http://%s:%s/ in your browser.', port, host, port);
});

const io = require('socket.io').listen(server);

io.on('connection', (socket) => {
	var address = socket.handshake.address;
	log('New connection from ' + address);
	socket.on('room', (room) => {
		log('Joining on room: '+room)		
		socket.join(room);
	});
});
